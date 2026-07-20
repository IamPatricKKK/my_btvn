# Bài tập về nhà transaction

```tsx
async processOrder(dto: CreateOrderDto) {
  return this.prisma.$transaction(async (tx) => {
    // 1. Tạo đơn
    const order = await tx.order.create({
      data: { userId: dto.userId, total: dto.total, status: 'CREATED' },
    });

    // 2. Trừ tồn kho từng sản phẩm
    for (const item of dto.items) {
      await tx.product.update({
        where: { id: item.productId },
        // ❌ V2: decrement không kiểm tra "stock >= quantity" → stock âm / oversell
        data: { stock: { decrement: item.quantity } },
      });
    }

    // 3. Gọi cổng thanh toán
    // ❌ V1: gọi HTTP ngoài TRONG transaction → giữ lock suốt thời gian chờ mạng
    // ❌ V4: không idempotency key → retry dễ charge 2 lần
    const payment = await this.httpService.post(
      'https://gateway.vn/charge',
      { orderId: order.id, amount: dto.total },
    );

    // 4. Gửi email xác nhận
    // ❌ V1: email cũng nằm trong transaction; ❌ V3: gửi trước khi chắc commit
    await this.mailService.sendOrderConfirmation(order.id);

    // 5. Cập nhật trạng thái
    // ❌ V5: FAILED vẫn commit → tồn kho đã trừ cho đơn thất bại, không hoàn lại
    await tx.order.update({
      where: { id: order.id },
      data: { status: payment.ok ? 'PAID' : 'FAILED' },
    });

    return order;
  });
}
```

---

## **Yêu cầu:**

1. Liệt kê các vấn đề, giải thích hâu quả của từng vấn đề (lock giữ bao lâu? lỗi gì có thể xảy ra? tình huống nào làm dữ liệu sai?).
2. Viết lại thành phiên bản đúng
3. Câu hỏi mở: với phiên bản đã sửa, nếu app **crash ngay sau khi** cổng thanh toán trả về thành công nhưng **trước khi** update status thi dữ liệu sẽ ở trạng thái nào? Đề xuất 1 hướng xử lý

---

## 1) Các vấn đề + hậu quả (lock giữ bao lâu? lỗi gì? tình huống nào làm dữ liệu sai?)

### V1 — Gọi cổng thanh toán + gửi email **bên trong DB transaction** (nặng nhất)

- **Điều gì xảy ra:** transaction mở từ lúc tạo order đến lúc update status. Trong khoảng đó có 2 lời gọi I/O ra ngoài: HTTP `gateway.vn/charge` và `sendOrderConfirmation`.
- **Lock giữ bao lâu:** phụ thuộc độ chậm của gateway/mail — có thể **vài trăm ms → vài giây**, thậm chí tới timeout. Suốt thời gian đó các dòng `order` + các dòng `product` vừa `decrement` bị **giữ row lock**.
- **Lỗi có thể gặp:** tăng latency, **nghẽn connection pool**, request khác đụng cùng sản phẩm bị **block**. Prisma mặc định **timeout transaction 5s** → gateway chậm là TX tự rollback.
- **Tình huống làm dữ liệu sai:** gateway charge thành công nhưng TX rollback (do timeout / lỗi mail) → **khách đã bị trừ tiền nhưng DB không có PAID**.

### V2 — Trừ stock trong vòng `for` nhưng **không kiểm tra stock đủ**

- **Điều gì xảy ra:** `decrement` trừ thẳng, không guard.
- **Hậu quả:** tạo **stock âm** nếu không có ràng buộc.
- **Race condition:** 2 đơn đồng thời mua sản phẩm còn ít hàng → cả hai cùng decrement → **oversell**.

### V3 — Gửi email **trước khi biết chắc commit / payment thành công**

- Mail gửi trước bước update status và nằm trong TX. Nếu TX rollback sau đó → khách nhận mail cho **đơn không tồn tại**; nếu mail service lỗi → **rollback cả đơn hợp lệ** (quay lại V1).

### V4 — Idempotency / retry không rõ ràng

- Client retry do timeout, hoặc job retry → **charge 2 lần** / email trùng vì gateway không có idempotency key.

### V5 — Payment FAILED nhưng transaction **vẫn commit** phần trừ kho

- Khi `payment.ok = false`, status ghi `FAILED` nhưng TX vẫn commit → tồn kho đã trừ cho đơn thất bại **không được hoàn** → thất thoát tồn kho.

### (Bản chất) — DB transaction không bao trùm được payment/email

- Payment/email là **ngoại hệ thống**, không thể ACID cùng DB. Nên các bước này phải nằm ngoài TX và xử lý bằng cơ chế eventually-consistent.

---

## 2) Viết lại thành phiên bản “đúng” (an toàn hơn)

Mục tiêu:

- Transaction DB **ngắn nhất có thể**, chỉ làm việc DB.
- State machine rõ ràng: `PAYMENT_PENDING / PAID / FAILED`.
- Chặn oversell: update stock theo điều kiện `stock >= quantity`.
- Gọi payment **ngoài transaction**, dùng **idempotency key** (`orderId`).
- Gửi email sau khi DB đã commit (lý tưởng: **outbox** để không mất mail khi crash).

```tsx
async processOrder(dto: CreateOrderDto) {
  // 1) Tạo order + trừ stock trong transaction NGẮN (chỉ DB)
  const order = await this.prisma.$transaction(async (tx) => {
    const order = await tx.order.create({
      data: { userId: dto.userId, total: dto.total, status: 'PAYMENT_PENDING' },
    });

    // Trừ stock có kiểm tra đủ hàng (atomic) → count=0 nghĩa là hết hàng
    for (const item of dto.items) {
      const updated = await tx.product.updateMany({
        where: { id: item.productId, stock: { gte: item.quantity } },
        data: { stock: { decrement: item.quantity } },
      });
      if (updated.count !== 1) {
        throw new ConflictException(`OUT_OF_STOCK product=${item.productId}`);
      }
    }
    return order;
  }); // commit ngay, không giữ lock qua mạng

  // 2) Gọi payment NGOÀI transaction, idempotencyKey để retry an toàn
  let paid = false;
  try {
    const payment = await this.httpService.post(
      'https://gateway.vn/charge',
      { orderId: order.id, amount: dto.total },
      { headers: { 'Idempotency-Key': order.id } },
    );
    paid = !!payment.ok;
  } catch {
    paid = false; // timeout/lỗi mạng: coi như chưa chắc, để reconcile job đối soát sau
  }

  // 3) Cập nhật trạng thái (DB nhỏ, không kèm external)
  if (paid) {
    await this.prisma.order.update({
      where: { id: order.id },
      data: { status: 'PAID' },
    });
    // 4) Email sau khi order chắc chắn PAID; lỗi mail không ảnh hưởng đơn
    // Lý tưởng: ghi outbox event trong DB rồi worker gửi (không mất mail khi crash)
    this.mailService
      .sendOrderConfirmation(order.id)
      .catch((e) => this.logger.error('Gửi mail lỗi', e));
  } else {
    // Payment fail → hoàn stock
    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: { status: 'FAILED' },
      });
      for (const item of dto.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
      }
    });
  }

  return order;
}
```

**Ghi chú:** “hoàn stock khi payment fail” tuỳ chiến lược business. Nhiều hệ thống *reserve stock* có TTL rồi tự release, thay vì trừ ngay.

---

## 3) Câu hỏi mở: crash ngay sau khi gateway trả về thành công nhưng trước khi update status

### 1) Dữ liệu sẽ ở trạng thái nào?

- **Ở DB:** `order.status` vẫn là **`PAYMENT_PENDING`**; **stock đã bị trừ** (transaction đầu đã commit).
- **Ở gateway:** giao dịch **đã charge thành công** (tiền đã trừ).

=> **Inconsistent state**: *tiền đã thu nhưng đơn trong DB chưa chuyển PAID*. Nhưng vẫn **recoverable** (đủ thông tin để cứu).

### 2) Hướng xử lý — **webhook + idempotent + job reconcile**

1. Khi tạo order lưu thêm để đối soát: `orderId`, `paymentIntentId/txId`, `status = PAYMENT_PENDING`.
2. Gateway báo thành công qua **webhook** `payment_succeeded(orderId, txId)` → handler update order sang **`PAID`**.
3. Mọi update phải **idempotent**: webhook/handler chạy lại nhiều lần vẫn an toàn (“nếu đã PAID thì bỏ qua”, hoặc update theo điều kiện status hiện tại).
4. **Job định kỳ reconcile**: quét order `PAYMENT_PENDING` quá lâu (>5–15 phút), query gateway theo `orderId/txId`:
   - gateway nói **đã paid** → set `PAID`
   - gateway nói **fail/expired** → set `FAILED` + **hoàn/release stock**

**Tổng kết:** DB **không nên là nguồn chân lý duy nhất** cho “đã thu tiền hay chưa” khi có crash; phải có cơ chế **eventually-consistent** dựa trên **callback/reconcile từ gateway**, và mọi bước đều **retry được** mà không double charge / double update.

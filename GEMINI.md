# Quy tắc Thiết kế Giao diện Phẳng & Tối giản (Flat & Minimalist Design) - 8Router

Quy tắc này quy định phong cách thiết kế giao diện cho dự án, sử dụng `shadcn/ui` với preset `buFznsW` (`base-lyra` style).

## Nguyên tắc Cốt lõi
- **Không Shadow**: Loại bỏ hiệu ứng đổ bóng. Sử dụng đường viền (border) để phân tách các lớp.
- **Tính Phẳng**: Tập trung vào màu sắc và border thay vì độ nổi.
- **Sự Tinh Giản**: Dùng font chữ và màu sắc nhẹ nhàng, thanh thoát.
- **Base UI Standards**: Sử dụng các component `shadcn` mới nhất, chú ý `data-slot` cho việc style.

## 1. Typography (Nghệ thuật chữ)
- **Cấu trúc**: Không dùng `uppercase font-black`. Ưu tiên `font-medium`, `font-semibold`.
- **Số liệu**: Luôn dùng `tabular-nums` cho các số liệu.
- **Kích thước tiêu chuẩn (shadcn)**:
  - **Main Content**: `text-sm` (14px) - Cỡ chữ mặc định cho phần lớn nội dung.
  - **Secondary/Metadata**: `text-xs` (12px) - Cho các mô tả phụ, labels.
  - **Smallest Labels**: `text-[10px]` (10px) - Chỉ dùng cho các tag cực nhỏ hoặc metadata rất phụ.
  - **Page Titles**: `text-2xl` hoặc `text-3xl`.
  - **Section/Card Titles**: `text-base` hoặc `text-lg`.
- **Hành động**: Luôn ưu tiên dùng các class utility của Tailwind (`text-sm`, `text-xs`) thay vì hardcode `text-[...px]` trừ khi thực sự cần thiết để đảm bảo tính đồng nhất.

## 2. Màu sắc và Độ tương phản
- **Màu nền**: Sử dụng các biến `bg-background`, `bg-muted` với độ trong suốt phù hợp.
- **Viền**: Sử dụng `border-border/50` cho các đường phân cách.
- **Text**: `text-foreground` (chính) và `text-muted-foreground` (phụ).

## 3. Quy tắc Component UI
- **Card**: Sử dụng `border-border/50` và `bg-background/50`.
- **Form**: Sử dụng `FieldGroup` + `Field` + `Input` đúng chuẩn `shadcn` mới (v4).
- **Icons**: Sử dụng thư viện `phosphor` (theo preset). Sử dụng prop `data-icon` cho các icon trong Button.
- **Button**: Sử dụng các biến thể `outline`, `ghost` để giữ giao diện phẳng.

## 4. Quy trình thực hiện (Best Practices)
1. **Kiểm tra Registry**: Luôn chạy `npx shadcn@latest search` trước khi tạo mới.
2. **Layout & Spacing**: Sử dụng `flex` với `gap-*` (không dùng `space-y-*`).
3. **Semantic Colors**: Tuyệt đối không hardcode mã màu.
4. **Validation**: Kiểm tra lỗi React props (ví dụ `indicatorClassName` phải được truyền vào component con đúng cách).

## 5. Kiểm tra (Validation)
Sau khi chỉnh sửa, đảm bảo:
- [ ] Tuân thủ các quy tắc styling của `shadcn/ui` v4.
- [ ] Sử dụng đúng `iconLibrary` (phosphor).
- [ ] Đã kiểm tra tính "thanh thoát" của giao diện.

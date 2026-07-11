# 📦 Quản Lý Kho Nội Bộ

Phần mềm quản lý kho nội bộ cho công ty — **web app một file duy nhất** (HTML/CSS/JS thuần, không cần server, không cần cài đặt). Giao diện tiếng Việt, dữ liệu lưu ngay trên máy, sẵn sàng đóng gói thành app desktop bằng Electron/Tauri.

## 🚀 Dùng ngay

1. Tải file **`quan-ly-kho.html`** về máy
2. Mở bằng trình duyệt (Chrome / Edge / Firefox)
3. Đăng nhập với tài khoản mặc định:

| Tài khoản | Mật khẩu | Vai trò |
|---|---|---|
| `admin` | `admin123` | Quản trị — toàn quyền (người dùng, sao lưu, cài đặt, xóa phiếu) |
| `quanly` | `quanly123` | Quản lý — nghiệp vụ, kiểm kê, báo cáo, sửa/hủy phiếu |
| `nhanvien` | `nhanvien123` | Nhân viên — lập phiếu, xem tồn kho & lịch sử |

> Lần chạy đầu có sẵn **dữ liệu mẫu** để làm quen. Khi dùng thật: vào **Sao lưu & Cài đặt → Xóa toàn bộ & bắt đầu mới**, đổi mật khẩu admin và nhập thông tin công ty (hiển thị trên phiếu in).

## ✨ Tính năng

- **Nghiệp vụ phiếu**: nhập kho · xuất kho · chuyển kho · trả hàng NCC · khách trả hàng · kiểm kê & điều chỉnh — mỗi phiếu có số chứng từ tự động, in được (kèm số tiền bằng chữ, khung ký tên)
- **Sửa / Hủy / Xóa phiếu**: sửa phiếu tính lại tồn kho đúng (có rollback nếu dữ liệu mới không hợp lệ); hủy giữ dấu vết sổ sách; xóa vĩnh viễn (chỉ Quản trị) hoàn tác tồn trước khi gỡ
- **Công nợ & thu chi**: ghi "đã thanh toán" ngay trên phiếu nhập/xuất/trả hàng · phiếu thu (PT) / phiếu chi (PC) in được · sổ chi tiết công nợ từng đối tác có số dư lũy kế · báo cáo còn phải thu / phải trả (xuất Excel)
- **Giá vốn bình quân gia quyền** tự cập nhật mỗi lần nhập; lợi nhuận chốt theo từng dòng xuất
- **Tồn kho** theo từng kho + cảnh báo dưới tồn tối thiểu
- **Báo cáo**: Nhập–Xuất–Tồn theo kỳ · Doanh thu & Lợi nhuận · Top sản phẩm — đều xuất Excel
- **Danh mục**: sản phẩm & nhóm hàng, nhà cung cấp, khách hàng, kho — import/export Excel (có file mẫu)
- **Hệ thống**: đăng nhập SHA-256, 3 cấp phân quyền, nhật ký thao tác, sao lưu/khôi phục toàn bộ dữ liệu ra file JSON

## 💾 Dữ liệu

- Dữ liệu lưu trong `localStorage` của trình duyệt trên từng máy (key `qlk_data_v1`)
- **Sao lưu định kỳ** bằng nút *Tải file sao lưu (.json)* — app tự nhắc sau 7 ngày
- Chuyển máy: mang file HTML + file sao lưu sang máy mới → *Khôi phục từ file*
- Chức năng Excel dùng thư viện SheetJS qua CDN (cần internet lần đầu; offline tự chuyển CSV)

## 🛠️ Phát triển

```
├── quan-ly-kho.html   # bản build hoàn chỉnh — sản phẩm cuối
├── build.py           # ghép src/ → quan-ly-kho.html
├── test_engine.js     # bộ kiểm thử logic (Node.js)
└── src/
    ├── 01_head.html   # <head> + toàn bộ CSS
    ├── 02_body.html   # khung HTML (đăng nhập, sidebar, topbar, modal, in)
    ├── 10_core.js     # tiện ích, SHA-256, đọc số thành chữ, lưu trữ
    ├── 20_engine.js   # tồn kho, giá vốn BQGQ, ghi/sửa/hủy/xóa phiếu, công nợ, báo cáo
    ├── 30_shell.js    # điều hướng, modal, toast, đăng nhập, phân quyền
    ├── 40_catalog.js  # sản phẩm, nhóm hàng, đối tác, kho, người dùng
    ├── 50_vouchers.js # form phiếu, kiểm kê, chi tiết & in phiếu
    ├── 55_finance.js  # phiếu thu/chi, sổ & báo cáo công nợ NCC/khách hàng
    ├── 60_tracking.js # tồn kho, lịch sử, báo cáo
    └── 70_system.js   # Excel, sao lưu, nhật ký, dashboard, dữ liệu mẫu
```

Quy trình sửa code:

```bash
# 1. Sửa các module trong src/
# 2. Chạy kiểm thử (138 test: giá vốn, tồn kho, sửa/hủy/xóa phiếu, công nợ, báo cáo…)
node test_engine.js
# 3. Ghép bản build mới
python3 build.py
```

## 🖥️ App desktop (Electron)

Thư mục **`desktop/`** chứa bản đóng gói desktop hoàn chỉnh — cửa sổ riêng, icon riêng, menu tiếng Việt, một phiên bản duy nhất (mở lần 2 tự focus). Dữ liệu localStorage lưu trong hồ sơ ứng dụng (Windows: `%APPDATA%\quan-ly-kho-desktop`), xem đường dẫn cụ thể ở menu **Trợ giúp → Giới thiệu**. Vẫn nên tải file sao lưu định kỳ.

**Cách 1 — Build tự động trên GitHub (khuyên dùng, không cần cài gì):**

1. Vào tab **Actions** → chọn workflow **Desktop build** → bấm **Run workflow**, hoặc push tag phiên bản: `git tag v1.1.0 && git push --tags`
2. Chờ vài phút → tải file cài đặt ở mục **Artifacts** (hoặc trong **Releases** nếu build từ tag):
   - `QuanLyKho-Setup-*.exe` — bộ cài Windows (chọn được thư mục, tạo shortcut)
   - `QuanLyKho-Portable-*.exe` — bản chạy ngay không cần cài
   - `QuanLyKho-*.AppImage` — Linux

**Cách 2 — Build trên máy (cần Node.js ≥ 18):**

```bash
python3 build.py            # ghép bản web mới nhất
cd desktop
npm install
npm start                   # chạy thử cửa sổ desktop
npm run dist:win            # đóng gói Windows (chạy trên Windows)
npm run dist:linux          # đóng gói Linux AppImage
```

## ⚠️ Lưu ý

- Đây là bản **một máy / một trình duyệt** — nhiều người dùng chung dữ liệu thời gian thực cần bản nâng cấp server (Node.js + SQLite)
- Hủy/xóa phiếu nhập không hồi tố giá vốn bình quân của các phiếu xuất đã lập trước đó
- Công nợ theo **đối tác** (không phân bổ theo từng hóa đơn); phiếu lập từ phiên bản cũ (trước khi có công nợ) được coi là **đã thanh toán đủ** khi nâng cấp dữ liệu
- Hủy phiếu nhập/xuất sẽ loại toàn bộ phiếu (kể cả phần đã thanh toán) khỏi công nợ — nếu tiền đã thực trao, hãy lập phiếu thu/chi hoàn tiền tương ứng

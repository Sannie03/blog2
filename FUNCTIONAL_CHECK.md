# Kiểm tra chức năng — 18/09/2026

Đã kiểm tra các nhóm chức năng hiện có bằng API thật với database PGlite tạm,
upload file local và trình duyệt Edge trên viewport desktop/mobile. Test giao
diện dùng API giả lập; chưa chạy toàn bộ luồng trình duyệt với database production.
Lượt này bổ sung test và báo cáo, không sửa logic ứng dụng hoặc deploy.

## Kết quả

| Phạm vi | Kết quả |
| --- | --- |
| Backend | 18 test đạt; 2 trường hợp lỗi được tái hiện và đánh dấu TODO |
| Frontend | 36 trường hợp đạt; 8 expected failures tương ứng 4 lỗi trên desktop/mobile |
| AdSense | Đã chạy đủ 4 trường hợp với publisher ID giả, request Google được chặn và giả lập |
| Build | Thành công; đã khôi phục build bình thường sau lượt test AdSense |
| Lint | Không có lỗi; một cảnh báo Fast Refresh sẵn có ở InformationPage.jsx |
| Production, chỉ đọc | Health, danh sách bài, danh mục, một bài mẫu và bài liên quan đều HTTP 200 |

Playwright hiển thị tổng `44 passed` vì `test.fail()` coi lỗi đã được đánh dấu là
kết quả dự kiến. Điều đó KHÔNG có nghĩa 44 chức năng đều hoạt động đúng. Các lỗi
bên dưới vẫn tồn tại. Node cũng báo 2 TODO, không được tính là chức năng đạt.

## Những luồng đã kiểm tra đạt

- Trang đọc: phân trang 12 bài, lọc danh mục, bài liên quan, mở link bài trực tiếp,
  back navigation, lỗi API và retry, các trang thông tin.
- Nội dung: Markdown, loại script/onerror, ảnh responsive và lazy loading,
  tải module nội dung song song với API.
- Tài khoản: đăng nhập admin, từ chối tài khoản thường và token sai, giới hạn
  đăng nhập, tạo admin, từ chối tài khoản trùng, đổi mật khẩu, logout và đổi tài khoản.
- Phân quyền: admin chỉ quản lý bài của mình; superadmin quản lý toàn bộ; dữ liệu
  role/author giả gửi từ client không vượt quyền; tài khoản bị xóa mất quyền truy cập.
- Bài viết: tạo draft/published, sửa nội dung đầy đủ, slug trùng được thêm hậu tố,
  validate tiêu đề, xóa bài, hủy xác nhận xóa, draft không xuất hiện ở API public.
- Quản lý bài: tìm kiếm, phân trang, lọc trạng thái/danh mục/tag/tác giả/ngày,
  chọn tag và danh mục tùy chỉnh, xem link công khai, copy link, điều hướng Series.
- Ảnh local: upload multipart ảnh đại diện và ảnh nội dung, preview file/paste,
  chặn lưu khi upload chưa xong, từ chối file giả MIME hoặc quá 10 MiB,
  phân quyền xóa ảnh, chặn xóa ảnh nội dung đang dùng và dọn ảnh nội dung hết tham chiếu.
- Dashboard: tổng published/draft, thống kê theo ngày và tài khoản, lọc khoảng
  ngày hợp lệ, giới hạn dữ liệu theo tác giả.
- AdSense: cấp/thu hồi quyền, ẩn UI khi không có quyền, link tới Google,
  nạp script đúng trang, dừng runtime bằng reload ở trang loại trừ, ads.txt,
  không nạp quảng cáo ở localhost.
- Analytics: đúng measurement ID, khởi tạo một lần, không nạp ở localhost.
- Chia sẻ: metadata cho crawler, canonical backend, ảnh fallback, escape HTML,
  redirect /post sang /story và không lộ draft.
- Hạ tầng ứng dụng: SQL init/migration trên database tạm, cache invalidation,
  giới hạn cache, gộp request đồng thời, gzip và cache headers API/upload.

## Lỗi đã tái hiện

| Ưu tiên | Lỗi | Tái hiện / ảnh hưởng | Vị trí |
| --- | --- | --- | --- |
| Cao | Xóa ảnh đang dùng ở bài khác | Upload ảnh đại diện cho A, chèn URL ảnh đó vào description của B, xóa A. File ảnh bị xóa dù B vẫn dùng. Nhánh thay ảnh đại diện dùng cùng kiểu kiểm tra thiếu description, cần sửa cùng. | backend/src/routes/posts.js, nhánh cleanup của PUT/DELETE |
| Vừa | Thiếu chuyển chương | Lưu prevChapter/nextChapter thành công qua API, mở bài nhưng không có link chương trước/sau. | frontend/src/components/ReaderView.jsx |
| Vừa | Canonical frontend sai | Mở /story/existing qua SPA, canonical vẫn là https://nextstorydark.site/. Backend crawler metadata đã trả canonical đúng trong test riêng. | frontend/src/App.jsx, frontend/index.html |
| Vừa | Không có trang 404 public | Mở /route-that-does-not-exist hiển thị khung danh sách và No posts found. | frontend/src/components/ReaderView.jsx |
| Vừa | Thẻ bài thiếu truy cập bàn phím | Thẻ bài chỉ là article có onClick, không có link/tabIndex/keyboard handler để chọn bằng Tab/Enter. Thẻ related có cùng cấu trúc. | frontend/src/components/ReaderView.jsx |
| Thấp | Ngày dashboard không hợp lệ trả 500 | GET /api/dashboard?from=2026-02-31 với tài khoản hợp lệ trả 500 thay vì lỗi đầu vào 400. | backend/src/services/dashboard-service.js, backend/src/routes/dashboard.js |

## Production và giới hạn xác nhận

- https://api.nextstorydark.site/api/health trả HTTP 200:
  `{"status":"ok","database":"connected"}`.
- /api/public/posts?page=1 trả 12 bài và hasMore=true; categories trả mảng;
  một bài mẫu có nội dung, related trả 3 bài. Đây là lấy mẫu chỉ đọc, không phải
  kiểm thử toàn bộ dữ liệu production.
- Log Render cung cấp cho thấy build/start thành công. Cảnh báo pg-connection-string
  liên quan cách diễn giải SSL mode tương lai, không phải lỗi kết nối hiện tại.
  Để giữ hành vi xác minh hiện tại, đổi sslmode trong DATABASE_URL trên Render
  thành verify-full; không thay thông tin tài khoản/host/database hoặc tham số khác.
  Chưa thay biến môi trường Render.
- Chưa xác nhận upload/xóa Cloudinary thật, quyền tài khoản Google, quảng cáo được
  phân phối thật, GA4 Realtime, trình preview của mạng xã hội hoặc thao tác admin
  trên production. Các dịch vụ bên ngoài cần xác nhận bằng tài khoản/môi trường thật.
- Migration SQL được kiểm tra trong PGlite; chưa chạy bootstrap-admin hoặc migration
  CLI vào PostgreSQL production. Chưa xác minh chính sách cache thực tế của Vercel/CDN.

## Chạy lại

- Backend: `cd backend`, `npm test`.
- Frontend: `cd frontend`, `npm run build`, `npm run lint`, `npm test`.
- Để chạy cả test AdSense, đặt VITE_ADSENSE_ENABLED=true và
  VITE_ADSENSE_CLIENT=ca-pub-1234567890123456 trong cùng môi trường build/test local.
  Chỉ dùng ID này cho kiểm thử; build lại theo cấu hình bình thường sau khi kiểm tra.
- Test mới: backend/test/functions.test.js và frontend/test/functions.spec.js.
  Sau khi sửa lỗi, bỏ TODO/test.fail tương ứng rồi chạy lại để xác nhận.

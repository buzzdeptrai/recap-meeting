# Lịch sử phát triển

Mới nhất ở trên. Mỗi mục = một commit (hash tra bằng `git log --grep "<tiêu đề>"`; mục không ghi hash vì chưa biết trước khi commit).
Quy tắc: trước mỗi commit thêm một mục ở đây (đã làm + vì sao, quyết định đáng nhớ, chưa kiểm chứng) và cập nhật `CLAUDE.md` nếu kiến trúc hoặc việc còn lại đổi.

## 2026-10-24 · Thêm lịch sử phát triển (CHANGELOG) và quy tắc ghi trước mỗi commit
- Tạo file này, thêm quy tắc vào `CLAUDE.md`, ghi nhận khác biệt dấu tay và biên bản, và `STT_PROVIDER=assemblyai` ở `.env` local.

## 2026-10-24 · Gợi ý từ biên bản ở phòng họp + đổi tên nhãn kết quả chủ đề
- Panel phải của phòng họp thêm khối "Gợi ý từ biên bản" (chủ đề và kết luận AI đề xuất lấy từ biên bản đã lưu), tách khỏi dấu tay "Mốc chủ đề" / "Kết luận đã đánh dấu". Bấm một mục để nhảy tới bản ghi.
- Vì sao: phòng họp chỉ đọc bảng `marks`, trang biên bản đọc nội dung AI nên số chủ đề/kết luận lệch nhau.
- Quyết định: dấu tay và biên bản là hai nguồn khác bản chất, **không gộp số đếm**. Số đếm trên tab và ở danh sách cuộc họp chỉ tính dấu tay. Gợi ý cách dấu tay cùng loại <= 30 s (`DEDUPE_WINDOW_MS`) thì ẩn; kết luận `marked:true` ẩn vì đã có dấu K; kết luận `marked:false` có chip "AI đề xuất", không dùng amber. Không ghi vào `marks`, không migration, không đụng stale.
- Nhãn trạng thái chủ đề: Đã thống nhất / Còn bỏ ngỏ / Đã loại (EN export: Agreed / Still open / Dismissed), nhãn "Kết quả thảo luận" + tooltip. Giá trị lưu vẫn `decided|open|rejected`.
- Chưa kiểm chứng: chưa xem UI thật, chưa thử nhảy tới mốc của gợi ý ngoài test.

## 2026-10-24 · Minutes chạy ở worker trong realtime, STT retry, triển khai PM2
- Worker biên bản chuyển sang `apps/realtime` (web chỉ xếp hàng), nút "Thử lại" STT (`stt_retry`), `ecosystem.config.cjs`, `docs/DEPLOY.md`, `REALTIME_HOST`.
- Chưa kiểm chứng: VPS/Caddy/pm2 startup thật, retry với Deepgram/AssemblyAI thật, race migration giữa web và realtime lúc khởi động.

## 2026-10-24 · Danh sách cuộc họp chỉ hiện Có/Chưa cho biên bản
- Bỏ chip ngôn ngữ ("Tự động → VI"); cột Biên bản chỉ "Có" (tooltip ngôn ngữ) / "Chưa" / "—".

## 2026-10-24 · Hàng bản ghi gọn, kết luận là divider
- Gom lượt nói (header chỉ khi đổi người hoặc cách > 30 s), mật độ Gọn/Thoải mái, kết luận và mốc chủ đề thành hàng phân cách. Chiều cao hàng đã đo, test ghim trong `virtual-rows.test.ts`.

## 2026-10-24 · admin-ui 0.2.2
- Nút phụ dạng tonal, trạng thái được chọn là nền brand đặc, nền trang đậm hơn.

## 2026-10-24 · Biên bản chạy nền + phát hiện cũ theo phiên bản
- Migration 010 (`minutes_runs`, `minutes.prompt_version`, `marks_fingerprint`); stale theo lý do: transcript/marks/prompt/model đổi.

## 2026-10-24 · Phòng họp + danh sách trên admin-ui v2
- Thiết kế lại phòng họp (giữ sidebar trái) và danh sách; xem `design/room-preview-v1/`.

## 2026-10-24 · Màu brand xanh + admin-ui 0.2
- `--soft-brand` xanh; tên `purple` thành alias cũ.

## 2026-10-24 · Initial commit
- Ứng dụng Biên bản: ghi cuộc họp trong trình duyệt, bản ghi + dịch trực tiếp EN–VI, biên bản, xuất Word. Chi tiết nền tảng: `docs/PLAN.md`, `docs/ARCHITECTURE.md`.

## Ghi chú vận hành (không thuộc commit nào)
- `.env` của owner đặt `STT_PROVIDER=assemblyai` (mặc định tài liệu là Deepgram): phiên live 2026-10-24 chạy AssemblyAI `universal-3-6-pro`. Khi chuyển từ nói trong tab (EN) sang mic tiếng Việt, vài câu đầu bị nhận sai ngôn ngữ; chưa điều tra.

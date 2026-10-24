# Biên bản — ghi và dịch cuộc họp Anh–Việt

Ứng dụng web ghi âm cuộc họp Zoom/Teams **chạy trong trình duyệt**, phiên âm trực tiếp, dịch Anh <-> Việt ngay dưới từng
câu và cho phép đánh dấu "kết luận" trong lúc họp. Dành cho nhóm/SME ở Việt Nam hay họp với đối tác nước ngoài.

Trạng thái: **Phase 0 (kiểm chứng kỹ thuật)**. Ghi, phiên âm, dịch và lưu transcript đã chạy; biên bản (minutes) và xuất
Word nằm ở Phase 1. Lộ trình đầy đủ: [`docs/PLAN.md`](docs/PLAN.md).

## Yêu cầu

- Node.js >= 22 và npm.
- Chrome hoặc Edge (Windows/Mac) để ghi âm tab.
- Khoá API: Deepgram (STT), Gemini và OpenAI (dịch). Chỉ lưu ở `.env`, không bao giờ gửi xuống trình duyệt.
- `ffmpeg` (chỉ cần cho hai tool `stream-file` và `bench`).

## Cài đặt

```bash
npm install
cp .env.example .env     # rồi điền DEEPGRAM_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY
npm run create-admin -- --email ban@congty.vn --name "Tên của bạn"   # tạo tài khoản admin đầu tiên (hỏi mật khẩu, không hiện ký tự)
npm run dev              # web http://localhost:3000 + realtime ws://localhost:4001/ws
```

Vào http://localhost:3000, đăng nhập bằng tài khoản vừa tạo (mật khẩu tối thiểu 10 ký tự). Phiên đăng nhập hết hạn sau 7 ngày không
dùng (tối đa 30 ngày); thử sai 5 lần sẽ bị khóa 15 phút. Khóa ký cookie lấy từ `AUTH_SECRET` trong `.env`; để trống khi dev thì
được tự sinh ở `data/.auth-secret` (production bắt buộc đặt `AUTH_SECRET`). Tài khoản khác do admin tạo trong API `/api/users`.
Tool dòng lệnh (`stream-file`) không có cookie, nên dùng `RECAP_SERVICE_TOKEN` trong `.env` (xem `tools/stream-file/README.md`).

Các trang (sau khi đăng nhập, cùng khung Soft có thanh bên):

| Đường dẫn | Nội dung |
|---|---|
| `/` | Tổng quan (chỉ dữ liệu cuộc họp): số cuộc họp, giờ họp, biên bản chờ, kết luận, biểu đồ cuộc họp theo ngày, cuộc họp gần đây, cần xử lý, tình trạng dịch vụ |
| `/meetings`, `/meetings/new` | danh sách (tìm kiếm, lọc) và tạo cuộc họp |
| `/meetings/[id]`, `/meetings/[id]/minutes` | phòng họp trực tiếp (toàn màn hình) và biên bản |
| `/usage` | mức sử dụng: `?range=7d\|30d\|month&group=vendor\|model\|service&metric=cost\|seconds\|tokens\|requests`, ngân sách, bảng chi tiết, xuất CSV |
| `/settings` | nhà cung cấp (kiểm tra kết nối), bảng giá, ngân sách, người dùng (chỉ admin) |
| `/glossary` | thuật ngữ (sắp có) |

Dữ liệu nằm ở `data/` (SQLite `recap.db`, file ghi âm `audio/<id>.wav`), đã được gitignore.
Nếu mở web bằng địa chỉ khác `localhost` (ví dụ IP LAN), thêm origin đó vào `REALTIME_ALLOWED_ORIGINS` trong `.env`.

## Lệnh

| Lệnh | Việc |
|---|---|
| `npm run create-admin -- --email <e> --name <n>` | tạo/cập nhật tài khoản admin (mật khẩu hỏi trên terminal, hoặc env `RECAP_ADMIN_PASSWORD`) |
| `npm run dev` | chạy web (3000) và realtime (4001) cùng lúc |
| `npm test` | toàn bộ unit/integration test (vitest) |
| `npm run typecheck` | TypeScript strict cho mọi workspace |
| `npm run lint` | ESLint (giới hạn 300 dòng/file, 50 dòng/hàm) |
| `npm run format` / `format:check` | Prettier |
| `npm run check:deps` | mọi `import` đều được khai báo trong `package.json` của workspace đó |
| `npm run verify` | test + typecheck + lint + format:check + check:deps lần lượt |

## Kiến trúc tóm tắt

```
Trình duyệt (apps/web) --WS: PCM 16 kHz stereo (kênh 0 = mic "Tôi", kênh 1 = tab "Người khác")--> apps/realtime
apps/realtime: AudioWriter (wav) + Deepgram (packages/stt) + Segmenter + Translator (packages/translate: Gemini -> OpenAI)
Lưu trữ: SQLite WAL (packages/db), giao thức dùng chung: packages/core
```

Chi tiết: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), giao diện: [`docs/DESIGN.md`](docs/DESIGN.md),
README riêng của [`apps/realtime`](apps/realtime/README.md) và [`packages/translate`](packages/translate/README.md).

Bảo mật mặc định: WebSocket chỉ nhận origin localhost, giới hạn kích thước và tốc độ message, tên file ghi âm
được kiểm tra chống path traversal, API ghi của web từ chối request khác origin, khoá API không có trong bundle trình duyệt.

## Triển khai

Chạy trên một VPS Linux (PM2 + Caddy, hai tiến trình web và realtime): xem [`docs/DEPLOY.md`](docs/DEPLOY.md) và
[`ecosystem.config.cjs`](ecosystem.config.cjs). Lệnh chính: `npm run build`, `pm2 start ecosystem.config.cjs --env production`.

## Hai tool dòng lệnh

Phát file âm thanh vào hệ thống như một cuộc họp thật (cần realtime đang chạy):

```bash
npm run start -w @recap/tool-stream-file -- --file "/đường/dẫn/audio.m4a" --speed 4
npm run start -w @recap/tool-stream-file -- --help
```

Benchmark STT (WER/CER/độ trễ) và kiểm tra model id dịch:

```bash
npm run start -w @recap/tool-bench -- --file audio.m4a --ref reference.txt --configs vi,en,multi
npm run start -w @recap/tool-bench -- check-models
```

Chi tiết trong `tools/stream-file/README.md` và `tools/bench/README.md`. Quy trình kiểm tra với key thật và cuộc họp
thật: [`docs/MORNING-CHECKLIST.md`](docs/MORNING-CHECKLIST.md).

## Giới hạn đã biết

- Chỉ hỗ trợ cuộc họp tham gia bằng **bản web** của Zoom/Teams (ghi âm tab trình duyệt).
- Chỉ Chrome/Edge. Trên Mac chỉ ghi được âm thanh **tab**, chưa ghi được âm thanh của app Zoom/Teams native
  (cần app desktop, nằm ở Phase 3).
- Cần đeo tai nghe, nếu không mic thu lại tiếng loa và kênh "Tôi" lặp lời người khác.
- Chất lượng nhận dạng tiếng Việt và tiếng Việt xen tiếng Anh với Deepgram **chưa được kiểm chứng** (cần bản ghi thật,
  xem checklist). `language=vi` không nhận ra tiếng Anh; `multi` chậm hơn ~1-1.5 s.
- Phân đoạn câu còn có thể cắt giữa câu, ảnh hưởng chất lượng dịch (đang được tinh chỉnh).
- Chưa có đăng nhập, chưa tạo biên bản, chưa xuất Word.

## Lộ trình

Xem [`docs/PLAN.md`](docs/PLAN.md): Phase 0 (kiểm chứng) -> Phase 1 (biên bản, xuất Word, lịch sử) -> Phase 2 (nhóm, glossary UI)
-> Phase 3 (diarization, app desktop).

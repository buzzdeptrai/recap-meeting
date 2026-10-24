# tools/stream-file

Phát một file âm thanh vào WebSocket realtime như trình duyệt (frame 100 ms, 16 kHz Int16 stereo), in transcript +
bản dịch và tóm tắt (số segment, thời gian dịch trung bình, provider đã dùng). Ctrl+C gửi `stop` rồi in tóm tắt.

```bash
# terminal 1: npm run dev:realtime   (hoặc npm run dev)
npm run start -w @recap/tool-stream-file -- --file path/to/audio.m4a --speed 1
npm run start -w @recap/tool-stream-file -- --help
```

- Cần `ffmpeg` (đặt `FFMPEG_PATH` nếu không nằm trong PATH). File mono -> kênh 1 ("Khác"), kênh 0 im lặng; `--mic-file` -> kênh 0.
- Đường dẫn tương đối tính từ thư mục bạn chạy `npm` (không phải thư mục tool).
- Đăng nhập: realtime yêu cầu đăng nhập. Công cụ không có cookie nên dùng service token: đặt `RECAP_SERVICE_TOKEN=<chuỗi >=16 ký tự>` trong `.env`
  (cả server realtime và tool đọc cùng giá trị; hoặc `--token`). Không đặt = token bị tắt và kết nối bị từ chối (HTTP 401).
  Token chỉ cấp quyền mở WebSocket, không đăng nhập được vào web.
- Tạo meeting: thử `POST <web-url>/api/meetings` (mặc định http://localhost:3000, cần `npm run dev:web`; REST yêu cầu đăng nhập nên tool thường rơi xuống cách dưới); không có thì ghi thẳng
  vào SQLite `DB_PATH` bằng `@recap/db` (cùng file DB mà realtime dùng). Dòng `created via ...` cho biết đã dùng cách nào.
- `--speed 1` = thời gian thực; `4` = nhanh gấp 4 (khuyên dùng để thử nhanh); `max` làm Deepgram bị ngợp nên transcript thiếu, và vượt giới hạn 200 frame/giây của realtime (kết nối bị đóng 1008).
- `--mark-clock wall`: marker `atMs` is computed like the browser room (`Date.now() - (ready received - baseMs)`) instead of the exact audio offset; after the run a "Mark alignment" report lists, per marker, the wall-vs-audio error and the distance to the nearest final segment start/end. Sample with known sentence timing: `data/bench/clock/timed.wav` (sentences start at 3, 10, 17, 24 s).

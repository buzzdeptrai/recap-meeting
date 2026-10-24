# Checklist buổi sáng (xác nhận với key thật)

Mọi lệnh chạy ở thư mục gốc `RECAP-MEETING`. Key nằm trong `.env` (không bao giờ dán key vào chat/log).

## 1. Chạy ứng dụng

```bash
npm run dev          # web http://localhost:3000 + realtime ws://localhost:4001/ws
```

Tạo cuộc họp ở `/meetings/new`, mở phòng họp, bấm "Bắt đầu".

Trước khi thử, `npm run verify` (test + typecheck + lint + format + check:deps) nên báo xanh. Nếu mở web bằng địa chỉ khác
`localhost` (IP LAN), đặt `REALTIME_ALLOWED_ORIGINS=http://<ip>:3000` trong `.env` và chạy lại, nếu không WebSocket bị từ chối (403).

## 2. Thử với cuộc họp Zoom/Teams thật (Windows hoặc Mac)

1. Mở Zoom/Teams **bản web** trong Chrome hoặc Edge (Zoom: `zoom.us/wc/join/<ID>`; Teams: `teams.microsoft.com`).
2. Ở phòng họp của app, bấm bắt đầu -> chọn **tab** đang họp -> **tick "Chia sẻ âm thanh của tab"** (Windows còn có thể chọn "Toàn màn hình + âm thanh hệ thống"; Mac chỉ hỗ trợ âm thanh **tab** của Chrome/Edge).
3. Cho phép micro. **Đeo tai nghe** để mic không thu lại tiếng loa (nếu không, kênh "Tôi" sẽ lặp lại lời người khác).
4. Kiểm tra: 2 thanh mức âm nhảy (mic và tab), chữ hiện dần, bản dịch hiện dưới mỗi câu, nút "Đánh dấu kết luận" (phím K) hoạt động, banner cảnh báo khi mất âm thanh tab.
5. Dừng họp và mở lại trang meeting để xem transcript đã lưu.

## 3. Phát một file âm thanh vào hệ thống (không cần họp)

```bash
npm run dev:realtime      # terminal 1 (hoặc npm run dev)
npm run start -w @recap/tool-stream-file -- --file "/đường/dẫn/audio.m4a" --speed 4   # tối đa ~20x; nhanh hơn thì realtime đóng kết nối (giới hạn 200 frame/giây)
npm run start -w @recap/tool-stream-file -- --help
```

## 4. Benchmark STT (WER) và kiểm tra model

```bash
npm run start -w @recap/tool-bench -- check-models
npm run start -w @recap/tool-bench -- --file "/đường/dẫn/audio.m4a" --ref "/đường/dẫn/reference.txt" --configs vi,en,multi
```

Kết quả: bảng ở terminal + JSON ở `data/bench/`.

## 5. Gửi lại để quyết định `vi` hay `multi`

- 1-3 bản ghi **5-10 phút**, tiếng Việt xen tiếng Anh như cuộc họp thật (file m4a/wav/mp3 đều được).
- Kèm **văn bản tham chiếu** (`.txt`, gõ đúng lời nói, có thể không cần dấu câu) cho mỗi bản ghi.
- Chạy bench ở mục 4 với `--configs vi,multi,en`, gửi lại file JSON trong `data/bench/` (không chứa key).
- Quyết định cần đưa ra: Deepgram đủ tốt cho tiếng Việt / pha trộn không? Nếu không -> đổi provider qua adapter.

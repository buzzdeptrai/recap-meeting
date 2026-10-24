# apps/realtime

Máy chủ WebSocket (Node + `ws`) nhận audio stereo từ trình duyệt, gửi sang STT (Deepgram), cắt
thành segment, lưu SQLite + file WAV và đẩy sự kiện về UI. Khóa API chỉ nằm ở server.

## Chạy

```bash
npm run dev -w @recap/realtime   # hoặc: npm run dev ở thư mục gốc (web 3000 + realtime 4001)
npm test -- apps/realtime packages/stt
```

Biến môi trường (file `.env` ở thư mục gốc, xem `.env.example`): `DEEPGRAM_API_KEY`,
`DEEPGRAM_MODEL`, `DEEPGRAM_LANGUAGE` (`vi|en|multi`, dùng khi client gửi `sourceLang: "auto"`),
`REALTIME_PORT`, `DB_PATH`, `AUDIO_DIR`. Audio lưu tại `<AUDIO_DIR>/<meetingId>.wav`
(16 kHz, 16-bit, stereo; header được cập nhật định kỳ nên file vẫn mở được nếu server sập).

Bảo vệ WebSocket (`src/limits.ts`, `src/origin.ts`): kiểm tra header `Origin` lúc upgrade (mặc định chỉ
`localhost`, `127.0.0.1`, `[::1]`; đổi bằng `REALTIME_ALLOWED_ORIGINS=origin1,origin2` hoặc `*`; client không
gửi Origin như tool/test vẫn được phép), giới hạn kích thước message 64 KiB, tối đa 200 frame audio và 30 message
điều khiển mỗi giây (vượt thì đóng 1008), tối đa 20 kết nối cùng lúc.

## Luồng sự kiện

```
client                         server (ClientConnection → MeetingSession)
 start {meetingId,resume?} ──►  kiểm tra meeting (MEETING_NOT_FOUND), 1 session / meeting
                                mở STT ──► ready, status
 binary 6400 B (100 ms) ────►   AudioWriter + SttProvider.sendAudio
                                STT interim/final ──► Segmenter (mỗi kênh)
                           ◄──  interim, segment (seq tăng dần toàn meeting, đã lưu DB)
 mark {atMs} ───────────────►   lưu marks ──► mark
 stop ──────────────────────►   flush segmenter, đóng WAV, meeting = ended ──► stopped
```

- Frame sai kích thước / gửi trước `ready` bị bỏ và đếm, chỉ báo `BAD_MESSAGE` một lần.
- STT không kết nối được: `error STT_UNAVAILABLE` + `status closed`; vẫn ghi WAV để dịch lại sau.
- STT rớt giữa chừng: tự reconnect (backoff + jitter), audio trong lúc mất kết nối (tối đa 30 s)
  được phát lại.
- Socket đóng mà không `stop`: meeting được kết thúc; `start` với `resume: true` sẽ nối tiếp
  (seq, WAV và mốc thời gian tiếp tục từ đoạn đã ghi).

## Điểm cắm cho dịch (T5)

`RealtimeDeps.onSessionCreated(session)` trả về `SessionHooks { onFinalSegment, onStopped }`.
Trong hook gọi `session.emitTranslation({...})` (lưu DB + gửi `translation`),
`session.setTranslateStatus({provider, degraded})`, `session.sendError(...)`, `session.sendEvent(...)`.

### Dịch đã nối (T5)

`createRealtimeDeps` dựng translator từ env (`src/translation/`): glossary lấy từ DB, mỗi segment final được dịch
nền (không chặn segment sau) → `translation` + lưu DB, `status` (provider, degraded) khi đổi, lỗi → `error TRANSLATE_FAILED`
kèm `segmentId`. Segment đã ở ngôn ngữ đích thì bỏ qua; ngôn ngữ không rõ dùng nguồn cố định của phiên hoặc prompt `auto`.
Hook mới `onDrain`: `stop` chờ (tối đa 4 s) các bản dịch đang chạy trước khi gửi `stopped`.

# Lịch sử phát triển

Mới nhất ở trên. Mỗi mục = một commit (hash tra bằng `git log --grep "<tiêu đề>"`; mục không ghi hash vì chưa biết trước khi commit).
Quy tắc: trước mỗi commit thêm một mục ở đây (đã làm + vì sao, quyết định đáng nhớ, chưa kiểm chứng) và cập nhật `CLAUDE.md` nếu kiến trúc hoặc việc còn lại đổi.

## 2026-10-24 · Phát hiện im lặng mic/tab, chọn mic, cổng im lặng STT, xóa mềm, phát hiện echo loa
**Im lặng mic/tab (`apps/web/src/audio/silence.ts`, `source-monitor.ts`):** theo dõi mức âm từng nguồn, hiện banner khi mic hoặc tab im lặng quá lâu. Nguyên nhân gốc đã tìm ra: mic mặc định bị chuyển sang iPhone (Continuity) nên không có tiếng, và tab Zoom/Teams bị mute (chia sẻ tab thì có luồng nhưng không có âm).

**Chọn mic + hot-swap:** bộ chọn mic (lưu lựa chọn), thanh đo mức test trực tiếp trước khi vào họp, `switchMic` đổi mic khi đang ghi không cần dừng, gợi ý khi thiết bị bị ngắt (`mic-controller.ts`, `mic-devices.ts`, `mic-test.ts`, `mic-banner.tsx`, `mic-chooser.tsx`).

**Cổng im lặng STT theo kênh (chỉ AssemblyAI):** `packages/stt/src/silence-gate.ts`, `audio-level.ts`: kênh im lặng quá `STT_IDLE_AFTER_MS` (mặc định 30000, 0 = tắt) thì ngừng gửi audio lên STT để tiết kiệm; pre-roll 1,5 s gửi kèm khi có tiếng trở lại; usage đếm đúng số frame thực gửi (`stt.usage`, `frame-metering.ts`). Deepgram không đổi (vẫn gửi stereo). Ngưỡng 0.005 / 0.012 là **đoán**, chưa đo.

**Xóa mềm cuộc họp (có thể khôi phục):**
- Migration 011 thêm `meetings.deleted_at` / `deleted_by` (index một phần). Xóa chỉ ẩn: transcript, dịch, biên bản, dấu, file ghi âm, `usage_events` đều giữ nguyên. Danh sách, tìm kiếm, số đếm/tổng, dashboard và mọi route theo `meetings.get()` (phòng, segments, export, minutes, realtime) coi cuộc họp đã xóa là không tồn tại (404). `/usage` vẫn tính và hiện tên cuộc họp đã xóa (`list({ includeDeleted })`).
- REST: `DELETE /api/meetings/:id` (409 `MEETING_LIVE` khi đang ghi, idempotent), `POST .../restore`, `GET /api/meetings?deleted=1`. Repo: `meetings.softDelete/restore/listDeleted`.
- UI: nút thùng rác mỗi hàng (disabled khi đang ghi), `ConfirmDialog` "Xóa cuộc họp này?", thanh "Đã xóa · Hoàn tác", màn "Đã xóa gần đây" với "Khôi phục".
- Lọc `deleted_at` trong truy vấn thay vì sửa trigger FTS (migration cũ bất biến, khôi phục không cần reindex). Chưa có xóa vĩnh viễn (cần chính sách xóa file ghi âm).
- Sửa lỗi dev hot-reload: `getRepositories()` trong `apps/web/src/server/db.ts` giữ bộ repo cũ sau khi reload (điều kiện kiểm tra không có `softDelete`) nên `DELETE` trả 500 `softDelete is not a function`; nay bộ cache bị dựng lại khi thiếu `meetings.softDelete`.

**Phát hiện echo loa:** banner khi mic thu lại tiếng từ loa (`echo-detector.ts`); ngưỡng là **đoán**. Chưa khử trùng lặp transcript (hoãn tới khi có dữ liệu thật).

**UI nhỏ:** ghi chú "Đã ẩn N chủ đề trùng..." khi gợi ý từ biên bản bị ẩn vì trùng dấu tay; ô tóm tắt biên bản rộng hết chiều ngang.

**Tách file:** `meeting-session.ts` 349 → 296 dòng (`safe.ts`, `session-options.ts`, `mark-action.ts`), hành vi không đổi. Thêm `STT_IDLE_AFTER_MS` (comment) vào `.env.example`.

**Sửa lỗi sandbox (tester độc lập):** (1) `channel-session.ts`: khi kênh STT đang ngủ/đang Terminate, frame vào bộ đệm phát lại và được đẩy theo thứ tự sang socket mới, không gửi vào socket sắp đóng và không bị tính phí. (2) `silence.ts`: cửa sổ im lặng mic 60 s (`MIC_SILENCE_WINDOW_MS`), tab 30 s (`TAB_SILENCE_WINDOW_MS`, trước đây chung 12 s); banner "không có tiếng" của mic/tab đóng được trong một lần ghi, hiện lại khi đã hết im lặng rồi vào lại hoặc ghi mới (`silence-dismissal.ts`); mất thiết bị/ended/mute giữ nguyên. Lưu ý: trạng thái mic "silent" gộp cả mute của track nên banner mute cũng đóng được. (3) `marks.countByKind` loại cuộc họp đã xóa mềm. (4) `softDelete` quyết định bằng một câu UPDATE nguyên tử (không ghi đè khi đang live, giữ `deleted_at` đầu tiên). (6) `watchMicDevice` bỏ kết quả enumerate của watcher đã gỡ. (7) `switchTo` dùng số thứ tự: yêu cầu cuối thắng, stream bị thay thế được giải phóng. (8) `stop()` idempotent và bắt lỗi `context.close()`. (9) Cuộc họp kẹt `live` do realtime chết cứng: lúc boot (trước khi mở socket) `recoverInterruptedMeetings` gọi `meetings.recoverLive` chuyển mọi meeting `live` sang `ended` — `ended_at` = `created_at` của segment cuối (không có thì giờ boot), `duration_ms` = độ dài WAV (như `end()`), không có WAV thì `end_ms` lớn nhất, không có gì thì 0 (không dùng wall clock vì gồm thời gian chết); resume sau đó hoạt động bình thường; chưa kiểm chứng với kill -9 thật. Mỗi lỗi có test hồi quy.

**Chưa kiểm chứng:** mọi ngưỡng (im lặng 0.005/0.012, echo), cổng im lặng với phiên AssemblyAI thật (cắt mất đầu câu?), hot-swap mic trên Windows/Mac thật, UI xóa mềm trên trình duyệt thật (vị trí nút, focus), cuộc họp kẹt `live` do crash chưa xóa được. Deepgram tiết kiệm theo kênh cần hai socket mono (chưa làm).

**Biên bản sinh một lần, ngôn ngữ còn lại được dịch (migration 012):** trước đây mỗi ngôn ngữ chạy map-reduce riêng (tốn token gấp đôi). Nay chỉ sinh biên bản ở ngôn ngữ gốc (mặc định tiếng Anh; chủ chọn Anh/Việt khi tạo hoặc tạo lại, chỉ chọn theo từng lần vì dự án chưa có chỗ lưu cài đặt cấp ứng dụng), rồi worker tự xếp một run `translate` (cùng bảng `minutes_runs`, cột `kind`) dịch sang ngôn ngữ kia trước khi đánh dấu run gốc `done`, nên bản gốc dùng được ngay; dịch lỗi thì bản gốc giữ nguyên và hiện lỗi + "Thử lại". Chỉ gửi phần văn bản cho mô hình (ids, atMs, trạng thái, `marked`, người phụ trách luôn lấy từ bản gốc theo vị trí), bọc dữ liệu `<minutes_json>`, áp glossary, giữ thuật ngữ tiếng Anh khi dịch sang Việt, kiểm tra số lượng/null + zod, thử lại một lần. Dịch qua `MinutesLlm` với model `OPENAI_MINUTES_TRANSLATE_MODEL` (mặc định `gpt-4.1-mini`, đã có giá trong `config/pricing.json`); usage ghi `service=translate`, `meta.kind=minutes`, chỉ hiện ở `/usage`. Dòng có `derived_from_lang` + `source_hash`; sửa bản gốc hoặc tạo lại bản gốc thì bản dịch `stale` lý do mới `source_edited` ("Dịch lại"); sửa bản dịch không đụng bản gốc; bản dịch đã sửa tay chỉ bị ghi đè khi xác nhận (API 409 `DERIVED_EDITED`, worker cũng chặn, tự dịch lại sau khi tạo lại bản gốc sẽ bỏ qua bản đã sửa). Prompt tạo biên bản không đổi nên `PROMPT_VERSION` giữ nguyên (prompt dịch có phiên bản riêng `t1`). UI: chuyển Tiếng Anh | Tiếng Việt, huy hiệu "Bản dịch từ tiếng ...", tiến độ "Đang dịch sang ...", banner stale + "Dịch lại", chọn ngôn ngữ gốc ở màn trống và hộp thoại tạo lại. Xuất Word đã có chế độ vi/en/song ngữ, không đổi. **Chưa kiểm chứng:** chất lượng dịch với LLM thật (thuật ngữ, độ dài), giá thật của model dịch (dùng lại giá gpt-4.1-mini đã ghi), giao diện trên trình duyệt thật.

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

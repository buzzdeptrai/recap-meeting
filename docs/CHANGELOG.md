# Lịch sử phát triển

Mới nhất ở trên. Mỗi mục = một commit (hash tra bằng `git log --grep "<tiêu đề>"`; mục không ghi hash vì chưa biết trước khi commit).
Quy tắc: trước mỗi commit thêm một mục ở đây (đã làm + vì sao, quyết định đáng nhớ, chưa kiểm chứng) và cập nhật `CLAUDE.md` nếu kiến trúc hoặc việc còn lại đổi.

## 2026-10-30 · Làm bền realtime và hàng đợi biên bản cho ~5 người dùng cùng lúc
**Vì sao:** dùng nội bộ với ~5 tài khoản, nhiều cuộc họp live cùng lúc. Rà code thấy một lỗi bất kỳ làm chết mọi phiên, hàng đợi biên bản báo lỗi giả, trần 20 kết nối, và gọi LLM không thử lại khi 429. Dữ liệu vẫn dùng chung giữa các tài khoản (chủ đích, không thêm `owner_id`).

**Làm gì:**
- Cô lập lỗi theo phiên (`MeetingSession.fail`, `session-guard.ts`, `session-segmenters.ts`): lỗi trong STT/timer/audio/message chỉ kết thúc phiên đó (`error INTERNAL` rồi `stopped`, vẫn resume được). Handler `uncaughtException`/`unhandledRejection` giữ làm phương án cuối, log kèm id meeting đang live. PM2 realtime 1G.
- Hàng đợi biên bản: chỉ báo "dịch vụ nền chưa chạy" khi quá `MINUTES_QUEUED_CLAIM_TIMEOUT_MS` và không thấy worker hoạt động; `failStale` chỉ áp cho lượt `running`; DTO có `ahead`, UI "Đang chờ lượt (còn N lượt trước)"; concurrency mặc định 2.
- `REALTIME_MAX_CONNECTIONS` (mặc định 40, trước là 20 cứng), chỉ đếm socket đang OPEN; vượt thì đóng mã 1013.
- Heartbeat ping 30 s (`heartbeat.ts`); cùng user mở lại meeting thì thay phiên cũ (`SESSION_REPLACED`, thông báo tiếng Việt ở `error-copy.ts`); user khác hoặc service-token vẫn bị từ chối.
- Retry LLM cho biên bản (`packages/minutes/src/llm/retry.ts`): 429/5xx/lỗi mạng, tối đa 4 lần, backoff mũ + jitter, tôn trọng `Retry-After`. Đường dịch live không đổi.
- Backpressure (`backpressure.ts`): `bufferedAmount` > 1 MiB bỏ `interim`, > 8 MiB đóng mã 4009.
- `docs/DEPLOY.md`: `AUTH_TRUST_PROXY=true` bắt buộc sau proxy.

**Quyết định:** tín hiệu "worker còn sống" suy từ bảng `minutes_runs`, không migration heartbeat (worker chết cứng thì lượt xếp hàng có thể chờ thêm tới `MINUTES_RUN_STALE_MS` = 10 phút). Takeover cho mọi kết nối khác của cùng user, không chỉ kết nối stale; hai tab cùng meeting có thể giành nhau (tab cũ chỉ ngừng ghi và hiện thông báo).

**Chưa kiểm chứng:** mọi test dùng client giả; chưa chạy STT/OpenAI/Gemini thật, chưa thử ping/pong, backpressure và reconnect sau mã 4009 trên trình duyệt thật, chưa chạy PM2 với 1G. Sức chứa ~5-10 cuộc họp đồng thời là ước đoán, chưa đo bằng `stream-file`.

## 2026-10-30 · Trang Hướng dẫn sử dụng có ảnh chụp màn hình
**Vì sao:** tab hướng dẫn chỉ có chữ gạch đầu dòng; người dùng khó theo, nhất là bước chia sẻ tab + micro.

**Làm gì:** `settings/guide-content.ts` đổi sang bước có `image` và `note` tuỳ chọn; `guide-panel.tsx` có mục lục (anchor 5 phần) và bước đánh số; `guide-image.tsx` (ảnh lazy-load, bấm để phóng to bằng `Dialog`, alt tiếng Việt); `guide-callout.tsx` (hộp "Lưu ý", dùng cho bước tích "Chia sẻ âm thanh tab" với hình minh họa CSS, ghi rõ không phải ảnh thật của trình duyệt). 9 ảnh trong `apps/web/public/guide/` (1280x800, dưới 300KB), khung đỏ và số vẽ sẵn vào PNG lúc chụp. Thêm 2 test trong `settings-model.test.ts` (id các phần, ảnh có alt và tồn tại trên đĩa, note tab audio).

**Cách chụp:** chạy web+realtime riêng (cổng 3100/4101) với DB tạm và cuộc họp demo nội dung giả, key giả, micro/màn hình giả của Chrome; không đụng DB hay dev server của chủ. Hai thứ bị ẩn bằng sửa DOM lúc chụp ảnh phòng đang ghi: banner lỗi STT và nhãn "STT đã đóng" (chỉ hiện do key giả).

**Quyết định:** hộp thoại chia sẻ của Chrome là giao diện gốc, không chụp tự động được nên dùng hình minh họa thay vì làm giả. Ảnh nhúng cố định vào repo, UI đổi thì phải chụp lại.

**Chưa kiểm chứng:** ảnh chụp từ bản dev, không phải production; giao diện 390px chỉ kiểm không cuộn ngang, chưa xem bằng mắt; ảnh ở phần 4 lazy-load chưa cuộn xem trong tab thật.

## 2026-10-30 · Rõ hơn khi rời phòng họp đang ghi
**Vì sao:** rời trang lúc đang ghi làm mất phiên ngay; người dùng cần được nhắc rõ phải kết thúc cuộc họp trước.

**Làm gì:** `shell/leave-guard.tsx` đổi chữ hộp thoại (tiêu đề "Cuộc họp đang ghi, chưa thể rời đi", nút "Ở lại phòng" / "Kết thúc cuộc họp và rời đi"); `meeting-room/room-banners.tsx` thêm dải thông tin cố định khi đang ghi (`StayBanner`). Cơ chế chặn (click link, Back/Forward, beforeunload) giữ nguyên.

**Quyết định:** chưa làm nút "Tạm dừng" (cần đổi giao thức realtime, còn trong Open items). Đóng/reload tab vẫn chỉ hiện câu mặc định của trình duyệt, không đổi được.

**Chưa kiểm chứng:** chưa mở phòng họp đang ghi thật để xem hộp thoại và dải cảnh báo.

## 2026-10-27 · Chặn bot lập chỉ mục (noindex)
**Vì sao:** app riêng tư, chủ không muốn bot tìm ra hay lập chỉ mục trang và file JS.

**Làm gì:** `apps/web/next.config.ts` thêm header `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet, noimageindex` cho mọi đường dẫn (kể cả chunk JS) và ghim `productionBrowserSourceMaps: false`; `layout.tsx` metadata `robots` noindex/nofollow/nocache; `src/app/robots.ts` trả `Disallow: /` (qua được proxy đăng nhập nhờ đuôi `.txt`).

**Giới hạn:** chỉ chặn bot tuân thủ; lớp bảo vệ thật là đăng nhập. Cloudflare Bot Fight Mode là lớp thêm tuỳ chọn.

**Chưa kiểm chứng:** mới thử trên dev; chưa kiểm header/robots trên domain thật sau khi build và restart.

## 2026-10-27 · Hệ số nhân tiền hiển thị, ẩn 2 tab Settings, tab Hướng dẫn sử dụng
**Vì sao:** chủ không muốn admin biết chi phí thật (bán lại dịch vụ), và Settings cần một trang hướng dẫn cho người dùng.

**Hệ số nhân:** env `USAGE_COST_DISPLAY_MULTIPLIER` (mặc định 1, chỉ phía server, không trả ra API/UI). `apps/web/src/server/cost-display.ts` + áp trong `usage-service.ts`: tổng, kỳ trước, series, breakdown, top cuộc họp, chi tiêu/dự báo tháng, CSV. DB giữ giá ước tính thật, không migration. Ngân sách tháng (`USAGE_MONTHLY_BUDGET_USD`) KHÔNG nhân: phải đặt theo thang giá đã nhân, nếu không tính ngược ra được hệ số.

**Settings:** ẩn tab "Nhà cung cấp" và "Bảng giá" (xoá panel, dữ liệu không còn gửi xuống client; `?tab=providers|pricing` rơi về tab mặc định). Thêm tab "Hướng dẫn sử dụng" (mặc định; `guide-content.ts` + `guide-panel.tsx`), thứ tự Hướng dẫn, Ngân sách, Người dùng. Route `/api/settings/test-provider` giữ nguyên (không còn nút gọi, vẫn gọi trực tiếp được khi đăng nhập).

**Còn lộ giá gần đúng:** token và giây âm thanh trên `/usage` và CSV, tên nhà cung cấp/model trong bảng breakdown.

**Chưa kiểm chứng:** chưa mở `/usage` và `/settings` trên trình duyệt với hệ số 5; nội dung hướng dẫn đối chiếu qua code, chưa xem giao diện.

## 2026-10-27 · Dịch: OpenAI làm chính, Gemini dự phòng, đợi 3 s
**Vì sao:** chủ yêu cầu dùng GPT làm mặc định, Gemini dự phòng, đợi provider chính 3 s trước khi chuyển.

**Làm gì:** `packages/translate/src/config.ts` mặc định `openai,gemini` và `TRANSLATE_DEADLINE_MS` 3000 (dự phòng vẫn 4000); `.env.example`, `packages/translate/README.md`, `docs/ARCHITECTURE.md` và `config.test.ts` theo. `e2e-translation.test.ts` ghim thứ tự `gemini,openai` vì kịch bản viết cho Gemini là provider chính.

**Lưu ý:** biến env thắng mặc định; `.env` (local và VPS) nào còn `TRANSLATE_PROVIDER_ORDER=gemini,openai` / `TRANSLATE_DEADLINE_MS=1500` phải đổi tay rồi restart realtime. Cả hai key vẫn cần.

**Chưa kiểm chứng:** độ trễ và chi phí thực của `gpt-4.1-mini` làm provider chính trong phiên live; ngưỡng 3 s là theo yêu cầu, chưa đo.

## 2026-10-27 · STT: flush khi reconnect, ghi capture, bớt chữ lặp ở ranh giới
**Vì sao:** test thật phiên "TODAY 27102026" có chữ "sĩ" lặp ở ranh giới, và reconnect có thể làm mất đuôi chưa cắt của kênh bị rớt.

**Làm gì:** `SttChannelState` thêm `reconnecting`, provider AssemblyAI phát sự kiện activity theo kênh; `apps/realtime/src/session/channel-activity.ts` gọi `segmenter.flush()` đúng kênh đó (phát đúng 1 lần, `flushAbandonedTurn` giữ làm lớp thứ hai). `packages/stt/src/capture-recorder.ts` ghi JSONL `{tMs,ch,base,raw}` cho `tools/replay-segmenter`, bật bằng env `RECAP_STT_CAPTURE` (file hoặc thư mục), mặc định tắt, không chứa key/URL, lỗi ghi tự tắt. `align.ts`: từ lặp đơn dưới 3 ký tự chỉ bị bỏ nếu bắt đầu trong 100 ms sau từ trước; từ hay nói lặp (vâng, dạ, ừ, ok, no, yes...) không bao giờ bị coi là trùng (sửa luôn lỗi "vâng vâng" bị nuốt một chữ).

**Quyết định:** không đổi luật cho từ ghép bị cắt kiểu "the spread." | "to docs." vì không có luật an toàn (chữ thường đầu chunk không đủ tin với tiếng Việt). Keyterm đã chảy từ `glossary_terms` sang `keyterms_prompt`; trang `/glossary` vẫn chưa làm, hiện thêm từ bằng sqlite3.

**Chưa kiểm chứng:** flush khi reconnect và capture trên AssemblyAI thật; ngưỡng 100 ms là ước lượng; keyterm có làm nghe đúng "Streptococcus" hay không.

## 2026-10-27 · Bôi đen transcript rồi "Thêm vào ghi chú"
**Vì sao:** test thật cho thấy chủ phải gõ/chép ghi chú tay từ transcript. Bôi đen một đoạn thì có nút nổi để đẩy thẳng thành ghi chú (B1 follow-up), ghi chú vẫn là tín hiệu "phải giữ" cho biên bản.

**Làm gì (`apps/web/src/features/meeting-room/`):** `selection-note.ts` (hàm thuần: chuẩn hóa, cắt còn 1000 ký tự kèm "…", đọc `data-start-ms`, chống trùng, đặt vị trí nút), `use-transcript-selection.ts`, `selection-note-action.tsx` (nút nổi, không giữ focus, giữ nguyên vùng bôi), `segment-row.tsx` thêm `data-start-ms` cho dòng đã chốt, `transcript.tsx` nhận `notes`, `room-body.tsx` nối lại. 14 test cho phần thuần.

**Quyết định:** mốc giờ = bắt đầu dòng nơi vùng bôi bắt đầu (dòng interim thì không có mốc); trùng nội dung báo "Đoạn này đã có trong ghi chú."; quá 150 ghi chú báo lỗi; không thêm phím tắt mới.

**Chưa kiểm chứng:** chưa thử trên trình duyệt thật (bôi qua nhiều dòng ảo hóa, cảm ứng/Safari, nút bị cắt trong FloatCard); ở chế độ xem "cả hai" dòng dịch được bôi cũng vào ghi chú (chưa lọc).

## 2026-10-27 · Ghi chú chỉ bổ sung (PROMPT_VERSION 5) và tab phòng họp bớt chật
**Vì sao:** test thật phiên "TODAY 27102026" (2 ghi chú chép từ transcript) rồi A/B 4 lần mỗi nhánh trên bản sao DB: có ghi chú thì 2/4 lần biên bản **bỏ hẳn chủ đề phế cầu** (không ghi chú: 4/4 giữ). Ghi chú về top 5 kéo mô hình nghiêng hẳn về phần đó.

**Prompt (`packages/minutes/src/prompts.ts`):** ghi chú là phần thêm, không phải bộ lọc: mỗi chủ đề của transcript vẫn có mục riêng dù không ghi chú nào nhắc, ghi chú không được khiến bỏ/gộp/rút ngắn chủ đề; ghi chú có thể khác ngôn ngữ biên bản (ví dụ chép từ bản dịch) thì lấy ý và viết theo ngôn ngữ biên bản; bước reduce của map-reduce cũng giữ mọi chủ đề. `PROMPT_VERSION` 4 -> 5, hash pin trong `prompt-version.test.ts` cập nhật.

**Kết quả A/B v5 (6 lần mỗi nhánh, `gpt-4.1`, bản sao DB):** cả 3 nhánh (không ghi chú, 2 ghi chú gốc, 2 ghi chú em tự viết về phế cầu + top 5) giữ đủ 2 chủ đề 18/18; không lần nào có chủ đề `decided` thiếu dấu K; số liệu 60%/30% trong ghi chú đa dạng có mặt 6/6 lần, không ghi chú 1/6. Chỉ số tính bằng regex thô, mẫu nhỏ.

**UI:** `PillTabs` (admin-ui) padding `px-3 -> px-2` + `min-w-0`; bốn tab có badge đếm (Chủ đề, Kết luận, Phiên, Ghi chú) hết tràn rail 380px. Độ rộng ước tính, chưa đo trên trình duyệt.

**Chưa kiểm chứng:** "Đã thống nhất" gán thừa (phiên test luôn có dấu K ở 159 s nên chủ đề top 5 luôn `decided` ở mọi nhánh); tab hết chật trên màn thật; ghi chú đa dạng là dữ liệu em tự viết, không phải ghi chú của chủ.

## 2026-10-27 · Ghi chú tay trong họp (B1), watchdog treo AssemblyAI, sửa mất chữ khi reconnect, công cụ replay segmenter
**Học từ translation-ai (trao đổi giữa hai session):** bên kia gặp socket AssemblyAI treo (mở, không gửi gì, không đóng; khoảng 1/50 phiên) mà retry-on-close không bắt được, và mất 3-19 chữ đầu sau mỗi reconnect. Căn chỉnh theo chữ thay offset số từ thì bên này đã có (`segmenter/align.ts`, `cursor.ts`).

**Watchdog treo (`packages/stt/src/assemblyai/stall-watchdog.ts`):** URL thêm `session_heartbeat=true` (server gửi Heartbeat mỗi 5 s); 15 s không có message nào (`stallTimeoutMs`, 0 = tắt) thì báo lỗi "stalled" không chí tử, terminate socket và reconnect qua `handleDrop` + replay buffer. Idempotent, dừng khi kênh bị cổng im lặng tạm ngừng, dọn khi close/abort. Không dùng timer im lặng/âm lượng (vỗ tay, nhạc gây báo nhầm). Tách `dial.ts`, `channel-callbacks.ts` ra khỏi `channel-session.ts` (đang đúng 300 dòng). Code không đặt `inactivity_timeout` nên dùng mặc định AssemblyAI.

**Mất chữ khi reconnect (`segmenter.ts`):** segmenter không biết về reconnect; đuôi chưa cắt của turn cũ (dưới `minWords` hoặc kết thúc bằng từ phụ thuộc) bị kết quả đầu tiên của socket mới ghi đè. Test lỗi viết trước, sửa bằng `flushAbandonedTurn`: kết quả mới bắt đầu muộn hơn turn đang chờ quá `newTurnStartToleranceMs` (500 ms) thì đẩy đuôi cũ đúng một lần rồi xóa cursor. Hypothesis chỉnh sửa của cùng turn không bị flush. Tách `pending-types.ts`.

**Ghi chú tay (B1, migration 013):** bảng `meeting_notes` (tách khỏi bản AI, `at_ms` null = không có mốc, `position`, `last_manual_edit`), cột `minutes.notes_fingerprint`; REST `GET/POST /api/meetings/:id/notes`, `PATCH/DELETE .../notes/:noteId` (tối đa 1000 ký tự/ghi chú, 150 ghi chú/cuộc họp, 409 khi vượt); tab "Ghi chú" trong phòng bật được: Enter thêm, mốc thời gian lấy ở phím đầu khi đang live, bấm chip nhảy tới transcript, sửa tại chỗ (debounce 600 ms, Esc hoàn tác, tôn trọng IME tiếng Việt), xóa. Biên bản: ghi chú vào prompt qua khối `<notes>` đã escape một dòng (chống prompt injection), coi là điểm chủ đã xác nhận cần giữ, không bao giờ là bằng chứng một quyết định. Map-reduce: ghi chú có mốc vào đúng chunk, không mốc vào bước reduce. Stale thêm lý do `notes_changed` (fingerprint, bắt cả ghi chú bị xóa). `PROMPT_VERSION` 3 -> 4, hash prompt trong test đã cập nhật. Trạng thái notes nằm ở `RoomBody` (`useMeetingNotes`), không ở `use-room-controller.ts`, để không đụng thay đổi chưa commit.
- Cắt khỏi lát đầu: chọn giờ cho ghi chú ở cuộc họp đã kết thúc, đẩy ghi chú qua websocket, xuất Word, huy hiệu stale ở danh sách cuộc họp (SQL pinned theo quy tắc TypeScript), AI "nở" ghi chú. Debounce chưa flush ở `beforeunload`.

**Công cụ replay (`tools/replay-segmenter`):** phát lại capture JSONL (`{tMs,ch,base,raw}`) qua `Segmenter` thật trên đồng hồ ảo; đo chữ lặp ở ranh giới (không tính lặp thật), chữ mất, độ trễ p50/p90, % chunk vụn; thoát 1 khi vượt ngưỡng cờ. Chưa có hook ghi capture (cần một dòng đầu `handleMessage` trong `channel-session.ts`, chưa thêm).

**Gộp cùng commit (việc anh làm trước đó, chưa commit):** segmenter (`align.ts`, `cursor.ts`, `decide`, `dependent-words`), `ghost-filter.ts` (lọc dòng CJK <= 3 ký tự trên mic gần như im), `end-snapshot.ts` và test end idempotent, `leave-guard`, `use-live-status-recheck`, sửa thứ tự key points và prompt dịch. Em chỉ kiểm tra qua test và `npm run verify`, chưa đọc lại từng diff.

**Kiểm tra:** `npm run verify` xanh (167 file, 1349 test, typecheck, lint 0 lỗi, prettier, check:deps).

**Chưa kiểm chứng:** AssemblyAI thật có gửi Heartbeat như docs trên endpoint và model đang dùng hay không (đọc khoảng 100k trong 115k ký tự trang docs), watchdog với socket treo thật; frame gửi vào socket treo trong 15 s trước khi phát hiện vẫn mất (replay buffer chỉ giữ khi socket đã đóng); đuôi turn cũ đi kèm khoảng im dài vẫn chờ kết quả kế tiếp hoặc `flush()` (cách gọn hơn: `meeting-session.ts` gọi `segmenter.flush()` khi status `reconnecting`, chưa làm); tab Ghi chú trên trình duyệt thật (gõ lúc ghi, chip nhảy, chế độ tối); ghi chú có thật sự giảm "Đã thống nhất" gán thừa với LLM thật; công cụ replay chưa chạy trên capture thật, dùng fixture làm tay.

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

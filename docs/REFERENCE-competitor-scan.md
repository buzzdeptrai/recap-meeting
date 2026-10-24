# Quét đối thủ: Foresight, Meetily, Anarlog (2026-10-24)

Mục đích: lưu lại để phiên sau tái sử dụng, không phải quét lại. Chỉ là tham chiếu, **chưa quyết làm gì** (chờ chủ app duyệt).
Độ tin cậy: Meetily/Anarlog = agent đọc lướt code (chưa kiểm từng file). Foresight = soi bundle app + tin tức, **chưa đọc được doc chính thức** (trang render bằng JS).
Đối chiếu với app hiện tại: agent đọc code ngày 2026-10-24 (dẫn file:dòng bên dưới).

## 1. Ba app

| App | License | Loại | Link |
|---|---|---|---|
| Foresight (Google AI Edge) | Miễn phí, đóng, thử nghiệm | Mac, Apple Silicon, macOS 14.2+, Flutter + helper gRPC, chạy 100% local | developers.google.com/edge/foresight |
| Meetily | MIT (32k sao) | Tauri 2 (Rust + Next.js), local | github.com/Zackriya-Solutions/meetily |
| Anarlog (tên cũ Hyprnote) | MIT, trừ `enterprise/` (thương mại, chỉ xem) | Tauri v2, ~150 crate Rust | github.com/fastrepl/anarlog |

Clone tham khảo nằm trong scratchpad (tạm, có thể mất). Clone lại: `git clone --depth 1 <link>` vào thư mục ngoài project.

## 2. Tính năng từng app

**Foresight**
- Gõ bullet ngắn trong họp, AI nở thành ghi chú đầy đủ từ transcript (`notes_table`: `content`, `enhanced_content`, `enhancement_style`, `last_manual_edit`).
- Bắt mic + system audio (quyền `NSAudioCaptureUsage`), không bot.
- Model Gemma nghe thẳng audio (streaming audio encoder), embedding local, ~4.5GB.
- Phát hiện câu hỏi trong họp, trả lời từ kho tài liệu cá nhân (PDF, Docs, Office, Markdown, bookmark) qua RAG; bảng `event_insight` (query/insight).
- Kho tri thức: embedding, chiếu 3D, cluster, label (có `rationale`), entity, graph RAG (nodes/edges).
- Lịch: `calendar_event_id`, `attendees`, contacts. Tóm tắt sau họp tách riêng khỏi transcript.
- Chưa rõ: hỗ trợ tiếng Việt, giá, ngày GA.

**Meetily**
- Thu mic (cpal) + system audio macOS (ScreenCaptureKit), mix có ducking, VAD Silero, pool worker transcribe song song. Batch theo đoạn nói, không stream thật.
- STT local: Whisper/Parakeet. Không có STT cloud.
- Tóm tắt **map-reduce**: cắt chunk theo context (có overlap), tóm tắt từng chunk (retry 2 lần), gộp, điền template. Template JSON (standard, daily standup, retro, project sync, sales call...) với section có `instruction`; action item có owner/hạn/trích dẫn transcript kèm timestamp.
- Trạng thái tiến trình tóm tắt lưu DB (`summary_processes`, `transcript_chunks`), cache bản tóm tắt.
- Viết tóm tắt tiếng Anh rồi dịch cả Markdown sang ngôn ngữ đích. Có `vi` trong danh sách. Không dịch live.
- Nhãn người nói chỉ `mic` / `system`. Diarization chưa có.
- LLM: Ollama, llama-helper built-in, Claude, Groq, OpenRouter, OpenAI, Gemini.

**Anarlog**
- Thu system audio qua CoreAudio process tap, mic riêng, khử echo, VAD. Gửi 2 kênh (`Dual`) qua WebSocket tới STT.
- 30+ adapter STT cloud (Deepgram Nova-3/2/Flux, Soniox, AssemblyAI...) + local. Live chỉ khi dùng provider streaming; Parakeet Batch/whisper.cpp chạy sau khi ghi. Local live không có tiếng Việt; tiếng Việt live cần cloud (Deepgram có `vi`).
- Keyterm/keywords theo meeting gửi Deepgram.
- Luồng notes + AI (`crates/template-app/assets/enhance.*.jinja`): input = ghi chú trước họp, ghi chú trong họp, transcript, template. Prompt so ghi chú trong họp với trước họp; **chữ in đậm/nghiêng/gạch chân là tín hiệu quan trọng, `###` là chủ đề phải giữ**; thuật ngữ kỹ thuật giữ tiếng Anh khi output ngôn ngữ khác.
- Dữ liệu: `session_documents` (`kind` note|summary, `template_id`, `generation_metadata_json`) tách ghi chú tay khỏi bản AI; `transcripts.words_json` + `speaker_hints_json`. Bảng `action_items`, `tags`, chat.
- Tóm tắt: gửi cả transcript, không map-reduce; chỉ tăng độ dài mục theo số ký tự. Post-process: tag, tiêu đề dòng đầu.
- Người nói: kênh mic/system; `voiceprint` (embedding người nói); UI đổi tên người nói áp dụng hàng loạt.
- Reconnect khi STT cloud rớt: vẫn ghi audio, có cảnh báo, tự xoá khi transcript chạy lại.
- Tìm kiếm Tantivy, chat trên cuộc họp cũ, MCP, lịch (Apple/Google/Outlook), export Markdown.

## 3. Đối chiếu app hiện tại (Biên bản)

| Ý tưởng | Trạng thái hiện tại | Chứng cứ |
|---|---|---|
| Marks K/T làm tín hiệu cho prompt | Có, nhưng chỉ cửa sổ 90s trước/15s sau + nhãn topic; không có ghi chú tay "phải giữ" | `packages/minutes/src/prompts.ts:22-39`, `transcript.ts:90-112` |
| Chống prompt injection (bọc thẻ) | **Chưa** | `prompts.ts` ~dòng 100 (transcript để trần) |
| Lọc reasoning khỏi output | Không cần (output JSON schema) | `llm/openai.ts:52` |
| Giữ thuật ngữ Anh trong bản Việt | Một phần: giữ tên riêng/glossary `doNotTranslate`, chưa có luật chung cho thuật ngữ kỹ thuật | `prompts.ts:8`, `generate.ts:102` |
| Map-reduce họp dài | **Có** (chunk 8k token) nhưng chạy đồng bộ trong request, không có progress/job | `generate.ts:67-95`, `config.ts:12`, `minutes-service.ts:96-110` |
| Trích dẫn transcript | Có (`atMs` + TimestampChip), chưa phải segment id | `core/src/minutes.ts:19-43`, `timestamp-chip.tsx:16` |
| Ghi chú tay trong họp | **Chưa** (chỉ `meetings.agenda` nhập trước) | không có bảng notes |
| Reconnect Deepgram + buffer | **Có** (backoff 8 lần, ReplayBuffer ~30s) | `stt/deepgram/provider.ts:35,87,161,191` |
| Banner riêng cho trạng thái STT | Một phần: banner "Mất kết nối" gắn WS trình duyệt; chưa xác nhận banner riêng cho STT | `room-banners.tsx:76`, `source-strip.tsx:108` |
| Keyterm Deepgram | **Có**, tối đa 30 từ / 2048 ký tự URL | `glossary-source.ts:15`, `deepgram/config.ts:6-7` |
| Lưu word-level | **Chưa** (parse `SttWord` rồi bỏ; segments chỉ có start/end/channel/text) | `stt/types.ts:7`, `001_initial.ts:19-30` |
| Template / chọn model theo lần chạy | **Chưa** (model/setting chỉ từ env) | `generatorConfigFromEnv` |
| Đổi tên người nói | **Chưa** ("Tôi"/"Người khác" hardcode) | `transcript.ts:8-9`, `segment-row.tsx:12` |
| Export | Chỉ Word (vi/en/both); chưa Markdown | `api/meetings/[id]/export/route.ts:15` |
| Tìm kiếm | FTS5 từ khoá; không semantic, không chat, không lịch | migration 003, `meeting-search.ts` |
| Cache/stale | Chỉ theo timestamp transcript/marks; không có prompt/model version; xoá mark không bị phát hiện | `minutes-staleness.ts` |

Migrations hiện có: 001 initial, 002 minutes, 003 search, 004 usage_events, (không có 005), 006 mark_label, 007 mark_updated_at, 008 auth, 009 list_indexes. Migration kế tiếp: **010**. Bất biến, test pin checksum.

## 4. Đề xuất

### A. Nâng cấp hệ thống hiện tại (sửa cái đã có)

| # | Việc | Nguồn ý tưởng | Công sức | Ghi chú |
|---|---|---|---|---|
| A1 | Bọc transcript trong thẻ + dặn bỏ qua chỉ thị bên trong | Meetily | Nhỏ | Chỉ sửa `prompts.ts`, thêm test |
| A2 | Luật "giữ thuật ngữ kỹ thuật tiếng Anh" trong bản Việt | Anarlog | Nhỏ | Cùng file |
| A3 | Họp dài chạy nền: bảng `minutes_runs` (trạng thái, số chunk, lỗi, retry) + progress UI | Meetily | Vừa | Migration 010; thay `inFlight` map. Gỡ open item "họp dài" |
| A4 | Stale theo version: lưu `prompt_version` + model vào minutes; phát hiện xoá mark | Meetily (cache) | Nhỏ-vừa | Migration mới |
| A5 | Banner riêng cho trạng thái STT "reconnecting" | Anarlog | Nhỏ | Dữ liệu `room.stt` đã có, cần xác nhận UI |
| A6 | Lưu word-level (`words_json`) vào segments | Anarlog | Vừa | Migration mới; mở đường chạy lại/highlight |
| A7 | Đổi tên người nói hàng loạt | Anarlog | Nhỏ-vừa | Bỏ hardcode; lưu nhãn theo meeting |
| A8 | Xuất Markdown cạnh Word | Anarlog | Nhỏ | Thêm vào route export |
| A9 | Chọn model/template theo lần chạy lại | Meetily/Anarlog | Vừa | Cần khái niệm template (xem B2) |
| A10 | Chọn ưu tiên keyterm khi glossary > 30 từ (hiện cắt cứng) | Anarlog | Nhỏ | Theo agenda/tên người dự |

### B. Giải pháp mới (tính năng chưa có)

| # | Việc | Nguồn ý tưởng | Công sức | Ghi chú |
|---|---|---|---|---|
| B1 | **Ghi chú tay trong họp + "nở" thành biên bản**; lưu tách khỏi bản AI (`meeting_notes`, giữ `last_manual_edit`) | Foresight, Anarlog | Lớn | Giá trị cao nhất. Dòng ghi chú coi như tín hiệu "phải giữ" cùng K/T, có thể giảm "Đã chốt" bị gán thừa |
| B2 | Template biên bản theo loại họp (daily, retro, khách hàng...) lưu DB | Meetily | Vừa-lớn | Cần A9 |
| B3 | Phát hiện câu hỏi trong họp, gợi ý trả lời từ kho tài liệu (PDF/Docs/Markdown) | Foresight | Lớn | Cần embedding + nguồn tài liệu; làm sau |
| B4 | Chat / tìm kiếm ngữ nghĩa trên các cuộc họp cũ | Anarlog, Foresight | Lớn | FTS5 hiện có làm nền |
| B5 | Liên kết lịch + người dự (tự đặt tên cuộc họp, gợi ý tên người nói) | Foresight, Anarlog | Vừa-lớn | Chỉ khi có nhu cầu |
| B6 | Voiceprint nhận diện người nói | Anarlog | Lớn | Dài hạn; hiện chỉ 2 kênh |
| B7 | Chế độ riêng tư chạy STT/LLM local | cả 3 | Lớn | **Chưa nên**: tiếng Việt chưa benchmark; Anarlog local live không hỗ trợ `vi` |
| B8 | Graph RAG nhiều cuộc họp | Foresight | Rất lớn | Hướng xa |

Không app nào có dịch live EN–VI: đây là điểm Biên bản đang hơn cả ba.

## 5. Thứ tự gợi ý
1. Rẻ, làm ngay: A1, A2, A8, A5.
2. Giá trị cao: A3 (+A4), rồi B1.
3. Nền dữ liệu: A6, A7, A9.
4. Sau cùng: B2, B3, B4, B5; B6-B8 chỉ khi có nhu cầu rõ.

Mọi mục cần: migration mới (không sửa cũ), vitest, `npm run verify` xanh, file ≤300 dòng.

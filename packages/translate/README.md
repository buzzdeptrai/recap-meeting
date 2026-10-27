# @recap/translate

Dịch EN <-> VI theo thời gian thực cho cuộc họp: router nhiều provider (Gemini -> OpenAI), circuit breaker,
glossary, ngữ cảnh 3 câu gần nhất, và đảm bảo thứ tự theo `seq`.

## API

```ts
import { createTranslator, configFromEnv } from "@recap/translate";

const translator = createTranslator(configFromEnv(process.env), { glossary /* GlossarySource, tùy chọn */ });

const r = await translator.translate({ meetingId, seq, text, sourceLang: "en", targetLang: "vi" });
// -> { text, provider: "gemini" | "openai", latencyMs, degraded }

translator.status();          // { provider, degraded } cho sự kiện WS `status`
translator.endMeeting(id);    // xóa context + trạng thái thứ tự của cuộc họp
```

- `sourceLang`: `en | vi | auto | multi` (auto/multi dùng prompt tự nhận diện ngôn ngữ). `targetLang`: `vi | en`.
- Lỗi: `AllProvidersFailedError` (kèm `attempts`), `TranslateInputError` (text rỗng / seq đang chạy trùng).
- `deps.providers` thay provider thật (test); `FakeProvider` được export để dùng trong test của package khác.

## Cấu hình (env -> `configFromEnv`)

| Biến | Mặc định |
|---|---|
| `TRANSLATE_PROVIDER_ORDER` | `openai,gemini` |
| `GEMINI_MODEL` / `OPENAI_TRANSLATE_MODEL` | `gemini-3.1-flash-lite` / `gpt-4.1-mini` |
| `TRANSLATE_DEADLINE_MS` | `3000` (deadline của provider chính, đứng đầu `TRANSLATE_PROVIDER_ORDER`) |
| `TRANSLATE_FALLBACK_DEADLINE_MS` | `4000` (deadline của provider dự phòng, thứ 2 trở đi) |
| `TRANSLATE_SLOW_DEADLINE_MS` | `0` = tắt (đặt vd. `6000` để thử lại 1 lần provider chỉ bị timeout; có thể trễ phụ đề ~9 s) |
| `TRANSLATE_ORDER_TIMEOUT_MS` | `10000` (chờ tối đa các seq trước) |
| `GEMINI_API_KEY` / `OPENAI_API_KEY` | bắt buộc cho provider nằm trong order |

Failover: lỗi/timeout -> provider kế tiếp; provider có breaker mở bị bỏ qua; 429/402/auth không retry cùng provider.
Breaker: 3 lỗi liên tiếp hoặc tỉ lệ lỗi > 30% (>= 5 mẫu / 10 s) -> mở 20 s -> half-open (1 probe). 402 mở 6 giờ.

## Glossary

`GlossarySource { listTerms(): GlossaryTerm[] | Promise<GlossaryTerm[]> }` (adapter cho `@recap/db` nằm ở app, package này
không import db). Term có `lang` (vi|en), `translation`, `doNotTranslate`, `priority`, `variants`. So khớp không phân biệt dấu/hoa
thường, theo ranh giới từ, hỗ trợ `ABBR (full)` và `A / B`. Tối đa 15 term ưu tiên cao nhất đưa vào prompt; cache 60 s.

## Đảm bảo thứ tự (per meeting)

Các lời gọi dịch chạy song song, nhưng:

1. `seq` được đăng ký đồng bộ khi `translate()` được gọi (thứ tự đến = thứ tự "trước").
2. Kết quả của seq N chỉ được **trả về và ghi vào context** sau khi mọi seq nhỏ hơn đã đăng ký trước đó đã xong
   (thành công hoặc thất bại). Vì vậy kết quả được resolve theo `seq` tăng dần và context luôn đúng thứ tự.
3. Seq thất bại không chặn seq sau (reject ngay). Chờ tối đa `orderTimeoutMs`; hết hạn thì seq sau được thả đi,
   seq treo bị coi là "muộn": vẫn trả cho người gọi của nó nhưng **không** vào context.
4. Seq chưa từng được gửi (khoảng trống) không bị chờ. Seq nhỏ hơn đến sau khi seq lớn hơn đã thả cũng bị coi là muộn.
5. Context của một lời gọi chỉ gồm các cặp đã được thả tại thời điểm gọi (tối đa 3 cặp gần nhất).

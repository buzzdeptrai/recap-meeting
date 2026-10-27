# tools/replay-segmenter

Phát lại offline các message thô của AssemblyAI qua `Segmenter` thật (đồng hồ ảo, vài giây cho cả buổi họp) và đo:
**dups** (từ lặp ở ranh giới segment; lặp thật của người nói không tính), **lost** (từ trong final turn không bao giờ ra segment),
độ trễ từ-tới-emit p50/p90, % chunk nhỏ (<= 5 từ).

```bash
npm run start -w @recap/tool-replay-segmenter -- --file capture.jsonl --language vi
npm run start -w @recap/tool-replay-segmenter -- --file capture.jsonl --max-dups 0 --max-lost 0 --max-p90-ms 4000 --max-tiny-pct 15
# fixture mẫu: tools/replay-segmenter/test/fixtures/synthetic.jsonl
```

Thoát 0 = ok, 1 = vượt ngưỡng (in dòng `FAIL ...` ra stderr), 2 = input sai.

## Định dạng capture (JSONL, một dòng một frame)

`{"tMs":1234,"ch":1,"base":0,"raw":"<chuỗi JSON nguyên bản provider gửi>"}` — `tMs` = ms từ lúc bắt đầu ghi,
`base` = `connectionBaseMs` của socket (0 nếu không reconnect). Hiện chưa có recorder trong realtime; `src/capture.ts`
có `CaptureRecorder` (opt-in), cần hook 1 dòng ở `ChannelSession.handleMessage` (xem báo cáo).

## Cách tính

dups = từ thừa của segment lặp từ láng giềng + cụm đầu segment N trùng cụm cuối segment N-1 mà cùng thời điểm audio
(vendor báo lại). "lost" bỏ qua từ vendor báo lại mà segmenter chủ động bỏ (`dropped overlap`). Chưa kiểm với capture thật.

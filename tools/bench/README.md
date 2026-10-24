# tools/bench

Benchmark STT Deepgram (provider thật của `@recap/stt`) và kiểm tra model dịch.

```bash
npm run start -w @recap/tool-bench -- --file audio.m4a --ref reference.txt          # vi, en, multi song song
npm run start -w @recap/tool-bench -- --file audio.m4a --configs en,multi            # không cần --ref
npm run start -w @recap/tool-bench -- check-models                                   # Gemini/OpenAI
```

Bảng: WER, CER (chuẩn hoá: chữ thường, bỏ dấu câu, giữ dấu tiếng Việt, NFC), độ trễ final đầu tiên, độ trễ trung bình
(từ lúc câu nói kết thúc tới lúc nhận final), số final, ngôn ngữ phát hiện. JSON lưu ở `data/bench/<timestamp>.json`.
`detect` (detect_language) bị Deepgram streaming từ chối (HTTP 400) nên không nằm trong mặc định.
WER/chuẩn hoá nằm ở `src/wer.ts` (hàm thuần, có test).
`check-models` chỉ in id model và yes/no, không in key; lưu danh sách vào `data/bench/models-*.json`.

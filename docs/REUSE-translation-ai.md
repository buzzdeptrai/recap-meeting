# Reuse map — translation-ai

Source root (read-only, never modify):
`/Users/vietvu/Documents/NGHIEN CUU/AI/FULL_VIBER_CODE/COWORK-CLAUDE/translation-ai`
Stack there: Express + better-sqlite3 + vanilla JS (`window.*` modules). Port to TypeScript; do not copy verbatim JS globals.

## Reuse (port to TS, keep behavior)
| What | Where | Target |
|---|---|---|
| Chunk cut rules (silence 500 ms ≥5 words / semantic ≥10 words + punctuation/conjunction in last 40% / hard cap 18 words or 200 chars; buffer short finals, flush after 3 s; split finals >200 chars) | `public/js/modules/stt-processor.js:203-293`, `public/js/modules/chunker.js` (VI+EN conjunction regex `:20`, `:25`, split `:142-183`), `public/js/config.js:11-18` | `packages/stt/src/segmenter/` |
| Glossary matcher (diacritic-insensitive, word boundary, longest-first, "ABBR (full)") | `dictionary-matcher.js:90-126` | `packages/translate/src/glossary/` |
| Post-correction of ASR variants (longest-first regex) | `stt-processor.js:121-134` | `packages/stt/src/segmenter/correct.ts` |
| Circuit breaker | `services/circuit-breaker.js` | `packages/translate/src/circuit-breaker.ts` |
| Provider router (order, per-provider deadline 1500 ms, slow-path retry 6 s, no retry on 429/402) | `services/translation-router.js:79-224` | `packages/translate/src/router.ts` |
| Providers with AbortController deadline | `services/providers/*` (gemini, openai) | `packages/translate/src/providers/` |
| Prompts: interpreter rules (mandatory glossary, context, ASR-error normalising, filler removal, disfluency repair); user prompt blocks `[PREVIOUS CONTEXT]`, `[MANDATORY GLOSSARY]` (≤15 terms), `[LATEST TEXT]` | `services/translation.js:70-160` | `packages/translate/src/prompts.ts` — make generic business-meeting, not medical |
| Deepgram connect params, keyterm cap (30 terms / 2048 URL chars), KeepAlive 8 s, reconnect backoff | `public/js/speech.js:596-795`, `:621-637`, `:1050-1095` | `packages/stt/src/deepgram/` (server-side) |
| STT stream benchmark harness | `scripts/compare-stt-stream.js` | `tools/bench/` + add WER vs reference text |
| Sample audio | `CLAUDE-KIENTRUC-THAM-KHẢO/SONG-TEST/*.m4a` (English) | smoke tests in `tools/stream-file` |

## Fix — do NOT copy these behaviors
1. Raw Deepgram key returned to browser (`routes/translate.js:335-339`) → proxy through server.
2. Tab audio forces Azure, mic and tab never mixed (`input-sources.js:67-70`) → two-channel capture.
3. Context buffer not filled in live/router path (`translation.js:246`, `:311` only legacy) → fill per meeting.
4. Parallel translations can arrive out of order → order by `seq`.
5. Deprecated `ScriptProcessorNode` → AudioWorklet.
6. `uncaughtException` swallowed (`server.js:20-23`) → log + exit/restart.
7. Glossary English-centric → terms with `lang` field (vi/en).

## Not relevant
TTS, vMix overlay, viewer SSE broadcast, speaker lock, multi-stream, campaigns/admin UI, Web Speech/Whisper paths, budget.js, Telegram alerter (maybe later).

## Open risk
Design doc there says Nova-3 does not support Vietnamese streaming (`CLAUDE-KIENTRUC-THAM-KHẢO/giai-phap-dich-realtime-y-duoc.md:150`) while code sends `language=vi`. **Must be measured in Phase 0 (T5 bench).** No VI / mixed benchmark exists yet.

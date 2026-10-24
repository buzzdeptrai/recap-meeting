# Triển khai lên một VPS Linux (phương án A)

Hai tiến trình Node chạy lâu dài trên **một** máy: `recap-web` (Next.js, cổng 3000) và `recap-realtime` (WebSocket + worker biên bản, cổng 4001), do PM2 quản lý, đặt sau Caddy (HTTPS tự động). Dữ liệu: một file SQLite + thư mục âm thanh trên đĩa cục bộ.

Quy ước trong tài liệu: **[đã kiểm]** = đã chạy thử trên máy dev (macOS, Node 25) với PM2 thật, cổng phụ và DB tạm; **[chưa kiểm]** = chưa thử trên VPS/Caddy thật, cần xác nhận khi triển khai.

## 1. Cấu hình máy

- 2 vCPU / 2-4 GB RAM (web tối đa ~600 MB, realtime ~500 MB trước khi PM2 khởi động lại), đĩa SSD. Âm thanh WAV 16 kHz stereo khoảng 115 MB/giờ họp, hãy tính dung lượng cho `AUDIO_DIR`.
- Ubuntu 22.04/24.04 hoặc Debian 12. Mở cổng 80/443 ra ngoài; **không** mở 3000, 4001 (xem mục 11).
- Cần domain trỏ về IP máy (ví dụ `recap.congty.vn`). Trình duyệt chỉ cho `getDisplayMedia` và micro trên HTTPS (secure context) hoặc localhost, nên HTTPS là bắt buộc.

## 2. Cài đặt phần mềm

```bash
# Node 22 LTS (ví dụ qua NodeSource), công cụ build cho better-sqlite3, sqlite3 CLI để backup
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs build-essential python3 git sqlite3 rsync
sudo npm i -g pm2
# Caddy: làm theo https://caddyserver.com/docs/install#debian-ubuntu-raspbian
```

`better-sqlite3` có bản build sẵn cho Linux x64/arm64 phổ biến; `build-essential` + `python3` chỉ dùng khi phải biên dịch lại [chưa kiểm trên Linux].

## 3. Bố cục thư mục

```
/opt/recap/app          mã nguồn (git clone), chạy bằng user riêng không phải root
/var/lib/recap/recap.db DB_PATH (ngoài repo)
/var/lib/recap/audio    AUDIO_DIR (ngoài repo)
/var/backups/recap      backup
/opt/recap/app/.env     file cấu hình duy nhất (quyền 600)
/opt/recap/app/logs     log PM2 (đã nằm trong .gitignore)
```

```bash
sudo useradd -m -s /bin/bash recap
sudo mkdir -p /opt/recap /var/lib/recap/audio /var/backups/recap
sudo chown -R recap:recap /opt/recap /var/lib/recap /var/backups/recap
sudo -u recap git clone <repo-url> /opt/recap/app
```

## 4. Biến môi trường (`/opt/recap/app/.env`)

Cả hai tiến trình đọc cùng một file `.env` ở gốc repo (realtime qua dotenv, web qua `loadEnvConfig` trong `apps/web/next.config.ts`; **[đã kiểm]** `next start` nhận `DB_PATH`/`AUTH_SECRET` và tạo + migrate DB). Biến đã có trong môi trường tiến trình luôn thắng `.env`. Không bao giờ ghi khoá thật vào `ecosystem.config.cjs` hay commit `.env`.

| Biến | Production | Ghi chú |
|---|---|---|
| `AUTH_SECRET` | **bắt buộc**, >= 32 ký tự | thiếu thì production từ chối khởi động. Sinh: `openssl rand -hex 32`. Đổi giá trị = mọi người phải đăng nhập lại |
| `NEXT_PUBLIC_REALTIME_URL` | **bắt buộc đặt TRƯỚC `npm run build`** | ví dụ `wss://recap.congty.vn/ws`. Được nhúng vào bundle trình duyệt lúc build; đổi sau đó phải build lại (xem mục 6) |
| `REALTIME_ALLOWED_ORIGINS` | **bắt buộc** | mặc định chỉ localhost. Đặt `https://recap.congty.vn` (hoặc hostname trần `recap.congty.vn`); tránh `*` |
| `DB_PATH` | khuyến nghị đặt | tuyệt đối, ví dụ `/var/lib/recap/recap.db` (đường dẫn tương đối tính từ gốc repo) |
| `AUDIO_DIR` | khuyến nghị đặt | ví dụ `/var/lib/recap/audio` |
| `DEEPGRAM_API_KEY` | bắt buộc nếu `STT_PROVIDER=deepgram` (mặc định) | |
| `ASSEMBLYAI_API_KEY` | bắt buộc nếu `STT_PROVIDER=assemblyai` | |
| `OPENAI_API_KEY`, `GEMINI_API_KEY` | **bắt buộc** (realtime không khởi động nếu thiếu) | dịch + biên bản |
| `STT_PROVIDER`, `DEEPGRAM_MODEL`, `DEEPGRAM_LANGUAGE`, `ASSEMBLYAI_MODEL`, `ASSEMBLYAI_MIN_TURN_SILENCE_MS`, `ASSEMBLYAI_MAX_TURN_SILENCE_MS` | tùy chọn | có mặc định |
| `GEMINI_MODEL`, `OPENAI_TRANSLATE_MODEL`, `OPENAI_MINUTES_MODEL`, `TRANSLATE_PROVIDER_ORDER`, `TRANSLATE_DEADLINE_MS`, `TRANSLATE_FALLBACK_DEADLINE_MS` | tùy chọn | có mặc định |
| `USAGE_MONTHLY_BUDGET_USD` | tùy chọn | ngân sách hiển thị ở `/usage` |
| `REALTIME_PORT` | tùy chọn (4001) | PM2 đặt sẵn 4001 |
| `REALTIME_HOST` | tùy chọn (bỏ trống = mọi giao diện) | PM2 production đặt sẵn `127.0.0.1`; chỉ Caddy (`/ws*` -> `127.0.0.1:4001`) truy cập được. Giá trị rỗng/chỉ khoảng trắng bị từ chối |
| `MINUTES_WORKER_POLL_MS`, `MINUTES_WORKER_CONCURRENCY` | tùy chọn | worker biên bản trong realtime |
| `MINUTES_QUEUED_CLAIM_TIMEOUT_MS`, `MINUTES_RUN_STALE_MS` | tùy chọn | web: biên bản xếp hàng/đứng im quá lâu thì báo lỗi |
| `MINUTES_MARK_WINDOW_BEFORE_MS`, `MINUTES_MARK_WINDOW_AFTER_MS` | tùy chọn | cửa sổ quanh dấu kết luận |
| `AUTH_TRUST_PROXY` | nên đặt `true` khi sau Caddy | để giới hạn đăng nhập theo IP thật (đọc `X-Forwarded-For`); chỉ an toàn khi cổng web chỉ nhận từ proxy (đã bind 127.0.0.1) |
| `RECAP_SERVICE_TOKEN` | để trống | chỉ cho tool `stream-file`; tắt khi không dùng |

`PORT` (web) do `ecosystem.config.cjs` đặt (3000). `NODE_ENV=production` cũng do PM2 đặt cho cả hai tiến trình.

```bash
cd /opt/recap/app && cp .env.example .env && chmod 600 .env && nano .env
```

## 5. Build và khởi động lần đầu

```bash
cd /opt/recap/app
npm ci                 # đầy đủ (cả devDependencies): bước build Next cần typescript, tailwind, postcss
npm run build          # = next build cho apps/web; NEXT_PUBLIC_REALTIME_URL phải có trong .env TRƯỚC lệnh này
mkdir -p logs
pm2 start ecosystem.config.cjs --env production
pm2 save
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u recap --hp /home/recap   # chạy lệnh in ra; khởi động cùng máy
```

`npm ci --omit=dev` **[đã kiểm]** cài đủ để chạy realtime và `create-admin` (`tsx` là dependency của `apps/realtime` và `tools/create-admin`) và `next start` đọc được `next.config.ts` mà không cần `typescript`; nhưng `npm run build` thì cần devDependencies, nên cách đơn giản nhất là `npm ci` đầy đủ trên server (hoặc build ở máy khác rồi chép `apps/web/.next`, **[chưa kiểm]**).

Tài khoản admin đầu tiên (mật khẩu hỏi trên terminal, không hiện ký tự; tối thiểu 10 ký tự):

```bash
npm run create-admin -- --email ban@congty.vn --name "Tên của bạn"
# dùng trong script: RECAP_ADMIN_PASSWORD đặt trong môi trường của lệnh, không ghi vào file/lịch sử shell
```

Lệnh này đọc cùng `.env` (nên cùng `DB_PATH`) và migrate DB nếu cần.

### Vì sao không dùng `output: "standalone"`

**[đã kiểm]** Đã thử build standalone trong monorepo này: `better-sqlite3` được trace (bản prebuilt) nhưng `config/pricing.json` và thư mục `packages/db` **không** được chép vào, trong khi web tìm gốc repo bằng cách đi lên đến thư mục có `packages/db` (`apps/web/src/server/repo-root.ts`) và đọc `config/pricing.json`. Chạy standalone sẽ sai đường dẫn DB tương đối và thiếu bảng giá. Vì vậy dùng `next start` trên cây repo đầy đủ; chi phí là phải giữ `node_modules` và mã nguồn trên server, không đáng kể ở quy mô này.

## 6. URL WebSocket của trình duyệt

Trình duyệt lấy URL từ `process.env.NEXT_PUBLIC_REALTIME_URL`, mặc định `ws://localhost:4001/ws` (`apps/web/src/features/meeting-room/use-meeting-socket.ts`). Biến `NEXT_PUBLIC_*` được **nhúng cứng lúc `next build`** **[đã kiểm]**: bản build với `NEXT_PUBLIC_REALTIME_URL=wss://example.test/ws` chứa chuỗi này trong chunk JS. Không có cách đổi khi chạy. Khuyến nghị đơn giản nhất: một domain, đường dẫn `/ws` do Caddy chuyển về realtime, đặt `NEXT_PUBLIC_REALTIME_URL=wss://<domain>/ws` rồi build. Cookie đăng nhập cùng host nên được gửi kèm lúc nâng cấp WebSocket. Nếu đổi domain phải build lại. (Chưa làm mặc định "cùng origin tự suy ra từ `location`" vì đó là thay đổi mã; có thể làm sau.)

## 7. Caddy

`/etc/caddy/Caddyfile` **[chưa kiểm với Caddy thật]**:

```caddyfile
recap.congty.vn {
	encode gzip

	# WebSocket + (tùy chọn) health của realtime. Caddy tự chuyển tiếp Upgrade.
	handle /ws* {
		reverse_proxy 127.0.0.1:4001
	}

	# Mọi thứ còn lại là web Next.js
	handle {
		reverse_proxy 127.0.0.1:3000
	}
}
```

`reverse_proxy` tự thêm `X-Forwarded-For/Proto`; web dựa vào `X-Forwarded-Proto: https` để đặt cookie `Secure`. Caddy tự xin và gia hạn chứng chỉ Let's Encrypt (cần cổng 80/443 mở và DNS đúng). Không công khai `/health` của realtime. Nạp lại: `sudo systemctl reload caddy`.

## 8. PM2

```bash
pm2 start ecosystem.config.cjs --env production   # khởi động cả hai
pm2 status
pm2 logs recap-realtime --lines 100               # hoặc recap-web
pm2 reload ecosystem.config.cjs --env production  # sau khi cập nhật (xem mục 9)
pm2 restart recap-realtime
pm2 save                                          # nhớ danh sách tiến trình cho lần reboot
pm2 install pm2-logrotate                         # xoay vòng log
pm2 set pm2-logrotate:max_size 20M && pm2 set pm2-logrotate:retain 14
```

`ecosystem.config.cjs`: mỗi app đúng **1 instance, fork mode**, `watch:false`, `max_memory_restart` 600M (web) / 500M (realtime), `kill_timeout` 5 s (web) / 8 s (realtime, cao hơn mốc 5 s mà `apps/realtime/src/server.ts` tự thoát cứng để worker biên bản kịp đánh dấu lỗi các lượt đang chạy), restart có backoff mũ (tối đa 10 lần), log ở `logs/`. **[đã kiểm]** Khởi động cả hai bằng PM2 (cổng phụ, DB tạm): `/login` 200, `/api/meetings` 401 khi chưa đăng nhập, `GET /health` của realtime `{"ok":true,"minutesWorker":{"running":true,...}}`, `pm2 stop` kích hoạt tắt êm của realtime, web nghe `127.0.0.1`.

## 9. Quy trình cập nhật

```bash
cd /opt/recap/app
git pull
npm ci
npm run build                                   # NEXT_PUBLIC_REALTIME_URL trong .env vẫn đúng
pm2 reload ecosystem.config.cjs --env production
pm2 status && curl -s http://127.0.0.1:4001/health
```

Lưu ý: `pm2 reload` với fork mode thực chất là dừng-rồi-chạy, nên có vài giây gián đoạn; **không cập nhật khi đang có cuộc họp đang ghi** (kết nối WebSocket bị cắt) hay biên bản đang tạo (xem mục 12).

**Migration chạy ở đâu:** trong `openDatabase()` (`packages/db/src/connection.ts` gọi `runMigrations`), mỗi migration một transaction, ghi vào bảng `schema_migrations`. Realtime mở DB **lúc khởi động**; web mở DB **lười, ở request đầu tiên** (không phải lúc `next start`); `create-admin` cũng migrate. Hai tiến trình không có khóa riêng cho migration, nên nếu cả hai cùng chạy migration mới trong cùng một khoảnh khắc, một bên có thể lỗi (PM2 sẽ khởi động lại và lần sau đã xong). Rủi ro thực tế rất thấp vì web chỉ migrate khi có request; để chắc, sau khi cập nhật có migration mới hãy `pm2 reload recap-realtime` trước, đợi `/health` ok, rồi `pm2 reload recap-web`. Migration đã áp dụng là bất biến; chỉ thêm file mới. [Kịch bản đua chưa được kiểm thử.]

## 10. Backup

SQLite ở chế độ WAL: **không** chép file `.db` trực tiếp khi đang chạy. Dùng backup trực tuyến **[đã kiểm trên DB tạm: `.backup` và `VACUUM INTO` đều cho DB hợp lệ, `integrity_check` ok]**:

```bash
sudo tee /usr/local/bin/recap-backup.sh >/dev/null <<'EOF'
#!/bin/bash
set -euo pipefail
DB=/var/lib/recap/recap.db
OUT=/var/backups/recap
STAMP=$(date +%Y%m%d-%H%M)
sqlite3 "$DB" ".backup '$OUT/recap-$STAMP.db'"
gzip "$OUT/recap-$STAMP.db"
rsync -a /var/lib/recap/audio/ "$OUT/audio/"
find "$OUT" -maxdepth 1 -name 'recap-*.db.gz' -mtime +14 -delete
EOF
sudo chmod +x /usr/local/bin/recap-backup.sh
# crontab -u recap -e   (mỗi ngày 02:30)
30 2 * * * /usr/local/bin/recap-backup.sh >> /var/backups/recap/backup.log 2>&1
```

Giữ 14 ngày DB; `audio/` được rsync (không xóa file cũ). Nên chép thêm `/var/backups/recap` ra máy khác (rsync/rclone sang kho ngoài) vì cùng ổ đĩa thì không phải backup thật. Thử khôi phục định kỳ: giải nén, `sqlite3 file.db "pragma integrity_check"`. `.env` cũng cần cất ở nơi an toàn (mất `AUTH_SECRET` chỉ làm mọi người phải đăng nhập lại).

## 11. Kiểm tra sức khỏe và bảo mật

- Realtime: `curl -s http://127.0.0.1:4001/health` (có `minutesWorker.running`). Web: `curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3000/login` phải là 200. Có thể đặt UptimeRobot trên `https://<domain>/login`.
- **Địa chỉ bind:** web chạy với `--hostname 127.0.0.1`; realtime nhận `REALTIME_HOST=127.0.0.1` từ `env_production` của PM2 nên cũng chỉ nghe loopback (log `[realtime] listening ... (bind 127.0.0.1 ...)`). Caddy proxy `/ws*` tới `127.0.0.1:4001`. Kiểm tra: `sudo lsof -nP -iTCP:4001 -sTCP:LISTEN` phải hiện `127.0.0.1:4001`, không phải `*:4001`. Nếu chạy realtime ngoài PM2 production, tự đặt `REALTIME_HOST=127.0.0.1` (bỏ trống thì nghe mọi giao diện). Tường lửa chỉ giữ làm lớp phòng thủ bổ sung:

  ```bash
  sudo ufw default deny incoming && sudo ufw allow OpenSSH && sudo ufw allow 80,443/tcp && sudo ufw enable
  ```

  (nhà cung cấp VPS có thể có firewall riêng, cũng nên chặn.) WebSocket vẫn yêu cầu origin hợp lệ và cookie phiên.
- `.env` quyền 600, thuộc user `recap`; chạy PM2 bằng user `recap`, không dùng root; bật cập nhật bảo mật tự động của hệ điều hành.
- Giới hạn đăng nhập: đặt `AUTH_TRUST_PROXY=true` (mục 4). Bộ đếm đăng nhập sai nằm trong bộ nhớ, mất khi web khởi động lại.

## 12. Giới hạn đã biết

- **Một instance cho mỗi DB**, không mở rộng ngang: realtime giữ phiên họp trong bộ nhớ; khởi động lại khi đang khởi tạo tiến trình thứ hai sẽ làm hỏng các lượt biên bản đang chạy của tiến trình đầu.
- Khởi động lại/dừng realtime làm **các biên bản đang tạo thất bại** ("Máy chủ khởi động lại khi đang tạo biên bản") và không tự chạy lại; người dùng bấm tạo lại. Cuộc họp đang ghi bị ngắt kết nối.
- SQLite phải nằm trên **đĩa cục bộ**, không dùng NFS/SMB (khóa file của WAL không đáng tin).
- Chất lượng nhận dạng tiếng Việt/lẫn Anh-Việt chưa được đo (xem CLAUDE.md, Phase 0).

## 13. Xử lý sự cố

| Triệu chứng | Nguyên nhân thường gặp | Cách xử lý |
|---|---|---|
| Biên bản ở trạng thái "queued" mãi rồi báo "Dịch vụ xử lý nền chưa chạy" | `recap-realtime` đã chết hoặc không cùng `DB_PATH` với web | `pm2 status`, `pm2 logs recap-realtime`; kiểm tra cả hai đọc cùng `.env` |
| `recap-realtime` restart liên tục | thiếu khoá (`OPENAI_API_KEY`, `GEMINI_API_KEY`, khoá STT) hoặc `AUTH_SECRET` < 32 ký tự | log hiển thị tên biến thiếu (không hiện giá trị); sửa `.env`, `pm2 restart recap-realtime` |
| Phòng họp báo mất kết nối / WebSocket lỗi | `REALTIME_ALLOWED_ORIGINS` thiếu domain; không có HTTPS (dùng `ws://` trên trang https bị chặn); `NEXT_PUBLIC_REALTIME_URL` sai lúc build; Caddy thiếu `/ws*` (phải proxy tới `127.0.0.1:4001`) | kiểm tra tab Network, sửa biến rồi (nếu là biến NEXT_PUBLIC) build lại |
| Không chia sẻ được tab/micro | trang không chạy trên HTTPS | dùng domain + Caddy |
| Đăng nhập xong vẫn bị đẩy về `/login` | `AUTH_SECRET` khác nhau giữa hai tiến trình hoặc cookie `Secure` trên http | cả hai đọc cùng `.env`; truy cập bằng https |
| `Could not find a production build` | chưa chạy `npm run build` | build rồi `pm2 restart recap-web` |
| Caddy báo 502 trên `/ws` sau khi đặt `REALTIME_HOST` | `REALTIME_HOST` không phải `127.0.0.1` (ví dụ IP công cộng) nên Caddy không tới được | đặt `REALTIME_HOST=127.0.0.1`, `pm2 restart recap-realtime --update-env` |
| `better-sqlite3` không tải được | thiếu build tools hoặc khác phiên bản Node sau khi nâng cấp | `npm rebuild better-sqlite3` |
| Web báo 503 khi tạo biên bản | thiếu `OPENAI_API_KEY` ở môi trường web | kiểm tra `.env` |
| Chậm/đầy đĩa | `AUDIO_DIR` lớn | dọn bản cũ sau khi backup |

## 14. Chưa kiểm chứng

VPS/Linux thật, Caddy và chứng chỉ thật, WebSocket qua proxy với trình duyệt thật, `pm2 startup`/`pm2 logrotate`, `npm run build` với `output` khác mặc định, kịch bản đua migration, khôi phục từ backup bằng quy trình đầy đủ, cuộc họp thật kéo dài.

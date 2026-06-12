# Gia Phả OS — Database Backup & Restore

Tài liệu này hướng dẫn backup database hằng ngày cho Gia Phả OS và giữ lại một số bản backup gần nhất.

## 1. Yêu cầu trên server

Cài PostgreSQL client để có lệnh `pg_dump` và `psql`:

```bash
sudo apt update
sudo apt install -y postgresql-client
```

Kiểm tra:

```bash
pg_dump --version
psql --version
```

## 2. Biến môi trường

Thêm vào `.env.local` trên server:

```env
DATABASE_BACKUP_URL="postgresql://USER:PASSWORD@HOST:5432/postgres?sslmode=require"
BACKUP_DIR="/opt/giapha-os/backups/database"
BACKUP_KEEP_LAST=14
BACKUP_PREFIX="giapha-db"
```

Không dùng `NEXT_PUBLIC_` cho connection string backup. Không commit `.env.local` lên Git.

## 3. Chạy backup thủ công

```bash
cd /opt/giapha-os
bun run backup:db
```

File backup sẽ có dạng:

```text
giapha-db-2026-06-12-023000.sql.gz
```

Mặc định script giữ 14 bản mới nhất. Có thể đổi bằng `BACKUP_KEEP_LAST`.

## 4. Liệt kê backup

```bash
cd /opt/giapha-os
bun run backup:list
```

## 5. Cleanup backup cũ

```bash
cd /opt/giapha-os
bun run backup:cleanup
```

## 6. Tạo cron backup hằng ngày

Mở crontab:

```bash
crontab -e
```

Thêm dòng chạy backup mỗi ngày lúc 02:30:

```cron
30 2 * * * cd /opt/giapha-os && /usr/bin/bun run backup:db >> /opt/giapha-os/backups/backup.log 2>&1
```

Kiểm tra log:

```bash
tail -100 /opt/giapha-os/backups/backup.log
```

## 7. Restore thủ công

Tạo bản giải nén tạm:

```bash
gunzip -c /opt/giapha-os/backups/database/giapha-db-YYYY-MM-DD-HHMMSS.sql.gz > /tmp/giapha-restore.sql
```

Restore vào database đích:

```bash
psql "postgresql://USER:PASSWORD@HOST:5432/postgres?sslmode=require" -f /tmp/giapha-restore.sql
```

Cảnh báo: file backup được tạo với `--clean --if-exists`, nên restore có thể drop/recreate object trong database đích. Chỉ restore khi đã chắc chắn database đích đúng.

## 8. Lưu ý bảo mật

- Thư mục `backups/` đã được đưa vào `.gitignore`.
- Không gửi file backup database vào GitHub hoặc chat nếu có dữ liệu thật.
- Nên sao chép backup định kỳ sang nơi lưu trữ khác như NAS, ổ ngoài hoặc cloud riêng.

# GIAPHA-OS — RUNBOOK TRIỂN KHAI v2.3.3 FINAL
### Hướng dẫn cầm tay chỉ việc cho người không rành code

> File này là runbook thao tác thực tế, rút ra từ `giapha-roadmap-v2.3.3-final.md`.
>
> Mục tiêu: giúp bạn nâng cấp Giapha an toàn, từng bước, không làm mất dữ liệu.
>
> Quy tắc lớn nhất: **không chạy nhiều phase cùng lúc**. Mỗi ngày chỉ làm đúng nhóm việc, kiểm tra đạt rồi mới qua bước tiếp theo.

---

# 0. Đọc phần này trước khi làm

## 0.1. Bạn sẽ làm gì trước, làm gì sau?

Thứ tự an toàn:

```text
1. Backup thật kỹ.
2. Kiểm tra app hiện tại build được.
3. Sửa GEDCOM trước, vì ít đụng database nhất.
4. Thêm test.
5. Thêm soft delete.
6. Sửa các chỗ đang xóa thật dữ liệu.
7. Chỉ sau đó mới tạo Family Model.
8. Chỉ sau Family Model ổn mới tạo Event Model.
9. GEDCOM staging import làm sau cùng.
10. Cleanup legacy là bước cuối, chưa làm sớm.
```

## 0.2. Những việc tuyệt đối chưa làm ngay

```text
❌ Không drop cột birth_year/death_year.
❌ Không drop bảng relationships.
❌ Không bật hard-delete blocker nếu importData() còn restore bằng delete thật.
❌ Không import GEDCOM thẳng vào production.
❌ Không bật READ_FAMILIES/READ_EVENTS nếu chưa có adapter và verify.
❌ Không cleanup legacy trong 1–2 tuần đầu.
```

## 0.3. Cách hiểu ký hiệu trong runbook

```text
[TỰ LÀM]        Người không rành code vẫn có thể làm nếu copy đúng lệnh.
[CẦN CẨN THẬN]  Có thể tự làm, nhưng phải kiểm tra kỹ.
[CẦN DEV]       Nên nhờ người biết code kiểm tra hoặc làm cùng.
[DỪNG LẠI]      Nếu gặp lỗi ở bước này, không làm tiếp.
```

## 0.4. Môi trường giả định

Runbook này giả định:

```text
Project nằm ở: /opt/giapha-os
App dùng: Next.js + Supabase
Package manager: bun
Có terminal SSH vào server
Có quyền vào Supabase Dashboard / SQL Editor
Có quyền admin trong app Giapha
```

Nếu project của bạn nằm chỗ khác, thay `/opt/giapha-os` bằng đường dẫn thật.

---

# 1. Bảng tiến độ tổng quát

| Ngày | Việc chính | Có đụng DB không? | Có thể rollback dễ không? |
|---|---|---:|---:|
| Ngày 1 | Backup + kiểm tra build | Có, chỉ đọc/dump | Có |
| Ngày 2 | GEDCOM hotfix + test | Không | Rất dễ |
| Ngày 3 | Safety DB tối thiểu | Có, additive | Dễ |
| Ngày 4 | Soft delete + sửa xóa thật | Có, nhẹ | Dễ |
| Ngày 5 | Person Names | Có, additive | Dễ |
| Ngày 6 | Family schema + RPC | Có, additive | Dễ |
| Ngày 7 | Family migration dry-run | Chủ yếu đọc | Dễ |
| Sau đó | Family migration thật | Có | Trung bình |
| Sau nữa | Event Model | Có | Trung bình |
| Cuối | GEDCOM staging import | Có | Trung bình |
| Rất cuối | Cleanup legacy | Có, phá vỡ legacy | Khó, cần restore |

---

# 2. Chuẩn bị trước Ngày 1

## 2.1. Ghi lại thông tin quan trọng

Tạo một file ghi chú riêng trên máy của bạn:

```text
Tên file: ghi-chu-nang-cap-giapha.txt
```

Ghi vào:

```text
Ngày bắt đầu:
Đường dẫn project:
Tên server:
Tên database Supabase:
Ai đang làm:
Backup lưu ở đâu:
```

## 2.2. Kiểm tra quyền truy cập

Bạn cần có:

```text
□ SSH vào server được.
□ Mở Supabase Dashboard được.
□ Mở app Giapha được.
□ Đăng nhập app bằng tài khoản admin được.
□ Có thể export JSON/GEDCOM từ app.
```

Nếu thiếu một trong các mục trên, dừng lại.

## 2.3. Mở terminal và vào project

```bash
cd /opt/giapha-os
pwd
ls -la
```

Kết quả `pwd` phải là:

```text
/opt/giapha-os
```

Trong thư mục phải thấy các file kiểu:

```text
package.json
app/
components/
utils/
```

Nếu không thấy, bạn đang sai thư mục.

---

# NGÀY 1 — BACKUP VÀ KIỂM TRA HIỆN TRẠNG

## Mục tiêu Ngày 1

```text
□ Có bản backup database.
□ Có file JSON backup.
□ Có file GEDCOM backup.
□ Code hiện tại build được.
□ Dữ liệu hiện tại không có lỗi nghiêm trọng.
```

---

## 1.1. Tạo bản sao thư mục project

[TỰ LÀM]

```bash
cd /opt
cp -a giapha-os giapha-os-backup-before-v233-final
cd /opt/giapha-os
```

Kiểm tra:

```bash
ls -ld /opt/giapha-os-backup-before-v233-final
```

Nếu thư mục tồn tại là đạt.

---

## 1.2. Tạo nhánh Git riêng

[CẦN CẨN THẬN]

```bash
cd /opt/giapha-os
git status
git checkout -b upgrade-v2.3.3-final
```

Nếu báo branch đã tồn tại:

```bash
git checkout upgrade-v2.3.3-final
```

Ghi chú: nếu `git status` có nhiều file đang sửa trước đó, chụp màn hình hoặc hỏi dev trước khi làm tiếp.

---

## 1.3. Kiểm tra app hiện tại build được

[TỰ LÀM]

```bash
cd /opt/giapha-os
bun install
bun run build
```

Nếu build pass, tiếp tục.

Nếu build lỗi:

```text
[DỪNG LẠI]
Không nâng cấp tiếp.
Lưu lại lỗi build.
Sửa lỗi build hiện tại trước.
```

---

## 1.4. Kiểm tra DATABASE_URL

[TỰ LÀM]

```bash
cd /opt/giapha-os
cat .env.local
```

Tìm dòng:

```text
DATABASE_URL=...
```

Nếu chưa có `DATABASE_URL`, bạn cần lấy connection string từ Supabase:

```text
Supabase Dashboard → Project Settings → Database → Connection string
```

Sau đó export tạm trong terminal:

```bash
export DATABASE_URL='postgresql://...'
```

Kiểm tra:

```bash
echo "$DATABASE_URL"
```

Nếu hiện chuỗi postgres là được.

---

## 1.5. Tạo script backup

[TỰ LÀM]

Tạo thư mục scripts nếu chưa có:

```bash
mkdir -p scripts backups
```

Tạo file:

```bash
nano scripts/backup-before-migration.sh
```

Dán nội dung:

```bash
#!/bin/bash
set -euo pipefail

DATE=$(date +%Y-%m-%d_%H-%M)
DIR="./backups/$DATE"
mkdir -p "$DIR"

echo "=== BACKUP BẮT ĐẦU: $DATE ==="

if [ -z "${DATABASE_URL:-}" ]; then
  echo "❌ DATABASE_URL chưa được set. Hãy export DATABASE_URL trước."
  exit 1
fi

echo "1/2 Backup database dump..."
pg_dump "$DATABASE_URL" \
  --no-owner --no-acl \
  --format=custom \
  -f "$DIR/database.dump"

echo "2/2 Export JSONL bảng legacy..."
psql "$DATABASE_URL" -c "\COPY (SELECT row_to_json(p) FROM public.persons p) TO '$DIR/persons.jsonl'"
psql "$DATABASE_URL" -c "\COPY (SELECT row_to_json(r) FROM public.relationships r) TO '$DIR/relationships.jsonl'"

echo "=== BACKUP XONG: $DIR ==="
echo "Restore khi cần: pg_restore --clean --if-exists -d \$DATABASE_URL $DIR/database.dump"
```

Lưu nano:

```text
Ctrl + O → Enter → Ctrl + X
```

Chạy:

```bash
chmod +x scripts/backup-before-migration.sh
bash scripts/backup-before-migration.sh
```

Kiểm tra:

```bash
ls -lh backups/*/database.dump backups/*/persons.jsonl backups/*/relationships.jsonl
```

Phải thấy đủ 3 file.

---

## 1.6. Backup JSON và GEDCOM thủ công từ app

[TỰ LÀM]

Vào app Giapha:

```text
Dashboard → Dữ liệu
```

Làm 2 việc:

```text
1. Xuất JSON
2. Xuất GEDCOM
```

Lưu file vào máy cá nhân, đặt tên:

```text
giapha-before-v233-final.json
giapha-before-v233-final.ged
```

Ghi lại nơi lưu trong file ghi chú.

---

## 1.7. Verify dữ liệu hiện tại trong Supabase

[CẦN CẨN THẬN]

Vào:

```text
Supabase Dashboard → SQL Editor → New query
```

Chạy từng nhóm SQL sau.

### Đếm dữ liệu chính

```sql
SELECT COUNT(*) AS persons FROM public.persons;
SELECT COUNT(*) AS relationships FROM public.relationships;
SELECT COUNT(*) AS marriages FROM public.relationships WHERE type='marriage';
SELECT COUNT(*) AS child_rels FROM public.relationships WHERE type IN ('biological_child','adopted_child');
```

Ghi lại kết quả.

### Kiểm tra lỗi nghiêm trọng

```sql
SELECT COUNT(*) AS self_relationships
FROM public.relationships
WHERE person_a = person_b;
```

Kết quả nên là `0`.

```sql
SELECT COUNT(*) AS orphan_relationships
FROM public.relationships r
WHERE NOT EXISTS (SELECT 1 FROM persons p WHERE p.id = r.person_a)
   OR NOT EXISTS (SELECT 1 FROM persons p WHERE p.id = r.person_b);
```

Kết quả nên là `0`.

```sql
SELECT COUNT(*) AS invalid_lifespan
FROM public.persons
WHERE birth_year IS NOT NULL
  AND death_year IS NOT NULL
  AND birth_year > death_year;
```

Kết quả nên là `0`.

Nếu một trong các kết quả lỗi > 0:

```text
[DỪNG LẠI]
Chưa migration.
Xuất danh sách lỗi ra CSV hoặc screenshot.
Cần xử lý dữ liệu trước.
```

---

## 1.8. Checklist cuối Ngày 1

Chỉ qua Ngày 2 khi tất cả mục dưới đây đạt:

```text
□ Có thư mục /opt/giapha-os-backup-before-v233-final
□ Có file database.dump
□ Có persons.jsonl
□ Có relationships.jsonl
□ Đã export JSON thủ công từ UI
□ Đã export GEDCOM thủ công từ UI
□ bun run build pass trước khi sửa code
□ SQL self_relationships = 0
□ SQL orphan_relationships = 0
□ SQL invalid_lifespan = 0 hoặc đã chấp nhận xử lý sau
```

---

# NGÀY 2 — GEDCOM HOTFIX

## Mục tiêu Ngày 2

```text
□ GEDCOM export có UTF-8 BOM.
□ Header có CHAR UTF-8 và LANG Vietnamese.
□ Tên Việt Nam export đúng.
□ Parser import FAM không mất cha/mẹ.
□ Test pass.
□ Build pass.
```

---

## 2.1. Cài Vitest

[TỰ LÀM]

```bash
cd /opt/giapha-os
bun add -d vitest @vitest/ui
```

Mở `package.json`:

```bash
nano package.json
```

Trong phần `"scripts"`, thêm:

```json
"test": "vitest run",
"test:watch": "vitest",
"test:ui": "vitest --ui"
```

Lưu file.

Kiểm tra:

```bash
bun run test
```

Nếu chưa có test, vẫn có thể báo “No test files found”. Không sao ở bước này.

---

## 2.2. Tạo thư mục GEDCOM mới

[TỰ LÀM]

```bash
mkdir -p utils/gedcom tests/gedcom
```

Backup file cũ:

```bash
cp utils/gedcom.ts utils/gedcom.legacy.ts
```

---

## 2.3. Đổi `utils/gedcom.ts` thành wrapper

[CẦN CẨN THẬN]

Mở file:

```bash
nano utils/gedcom.ts
```

Thay toàn bộ bằng:

```ts
export type { GedcomPerson, GedcomRelationship } from './gedcom/types';
export { exportToGedcom, exportToGedcomWithWarnings } from './gedcom/exporter';
export { parseGedcom } from './gedcom/parser';
```

Lưu file.

---

## 2.4. Tạo `utils/gedcom/types.ts`

```bash
nano utils/gedcom/types.ts
```

Dán:

```ts
export interface GedcomPerson {
  id?: string;
  full_name?: string | null;
  surname?: string | null;
  given_name?: string | null;
  gender?: 'male' | 'female' | 'other' | string;
  birth_year?: number | null;
  birth_month?: number | null;
  birth_day?: number | null;
  death_year?: number | null;
  death_month?: number | null;
  death_day?: number | null;
  death_lunar_year?: number | null;
  death_lunar_month?: number | null;
  death_lunar_day?: number | null;
  death_lunar_is_leap?: boolean | null;
  is_deceased?: boolean;
  is_in_law?: boolean;
  birth_order?: number | null;
  generation?: number | null;
  avatar_url?: string | null;
  note?: string | null;
}

export interface GedcomRelationship {
  id?: string;
  type?: string;
  person_a?: string;
  person_b?: string;
}

export interface GedcomExportResult {
  content: string;
  warnings: string[];
}
```

---

## 2.5. Tạo `utils/gedcom/writer.ts`

```bash
nano utils/gedcom/writer.ts
```

Dán:

```ts
const CRLF = '\r\n';
const BOM = '\uFEFF';
const MAX_BYTES = 248;
const encoder = new TextEncoder();

export class GedcomWriter {
  private lines: string[] = [];

  addRaw(line: string) {
    this.lines.push(line);
  }

  add(level: number, tag: string, value?: string | null) {
    if (value == null || value === '') {
      this.lines.push(`${level} ${tag}`);
      return;
    }
    this.addWrapped(level, tag, value);
  }

  addWrapped(level: number, tag: string, value: string) {
    const paragraphs = String(value).split(/\r?\n/);
    paragraphs.forEach((paragraph, idx) => {
      const clean = escapeGedcomTextValue(paragraph.trimEnd());
      const firstTag = idx === 0 ? tag : 'CONT';
      const firstLevel = idx === 0 ? level : level + 1;
      emitWrappedLine(this.lines, firstLevel, firstTag, clean);
    });
  }

  toString() {
    return BOM + this.lines.join(CRLF) + CRLF;
  }
}

function emitWrappedLine(lines: string[], level: number, tag: string, value: string) {
  let remaining = value;
  let currentTag = tag;
  let currentLevel = level;

  if (remaining.length === 0) {
    lines.push(`${level} ${tag}`);
    return;
  }

  while (remaining.length > 0) {
    const prefix = `${currentLevel} ${currentTag} `;
    const chunk = takeUtf8Chunk(remaining, MAX_BYTES - byteLen(prefix));
    lines.push(prefix + chunk);
    remaining = remaining.slice(chunk.length);
    currentTag = 'CONC';
    currentLevel = level + 1;
  }
}

function takeUtf8Chunk(text: string, maxBytes: number) {
  let out = '';
  for (const ch of text) {
    if (byteLen(out + ch) > maxBytes) break;
    out += ch;
  }
  return out;
}

function byteLen(s: string) {
  return encoder.encode(s).length;
}

/**
 * Chỉ dùng cho value text.
 * Tuyệt đối KHÔNG dùng cho dòng XREF như: 0 @I1@ INDI.
 */
export function escapeGedcomTextValue(value: string) {
  return value.replace(/@/g, '@@');
}
```

---

## 2.6. Tạo `utils/gedcom/name.ts`

```bash
nano utils/gedcom/name.ts
```

Dán:

```ts
export function splitVietnameseName(
  fullName: string,
  surname?: string | null,
  givenName?: string | null,
) {
  if (surname?.trim()) {
    return { surname: surname.trim(), givenName: (givenName ?? '').trim() };
  }

  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { surname: 'Unknown', givenName: 'Unknown' };
  if (parts.length === 1) return { surname: '', givenName: parts[0] };
  return { surname: parts[0], givenName: parts.slice(1).join(' ') };
}

export function formatGedcomName(fullName: string, surname?: string | null, givenName?: string | null) {
  const n = splitVietnameseName(fullName, surname, givenName);
  return n.surname ? `${n.givenName} /${n.surname}/` : `${n.givenName} //`;
}

export function parseGedcomName(nameVal: string) {
  const value = nameVal.replace(/@@/g, '@').trim();
  const m = value.match(/^(.*?)\s*\/([^\/]*)\/\s*(.*)$/);
  if (!m) return { fullName: value };

  const given = `${m[1]} ${m[3]}`.trim();
  const surname = m[2].trim();
  const fullName = surname && given ? `${surname} ${given}` : surname || given;
  return { fullName, surname, givenName: given };
}
```

---

## 2.7. Tạo `utils/gedcom/date.ts`

```bash
nano utils/gedcom/date.ts
```

Dán:

```ts
const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

export function formatGedcomDate(
  year?: number | null,
  month?: number | null,
  day?: number | null,
  modifier?: string | null,
) {
  if (!year) return null;

  const prefixMap: Record<string, string> = {
    about: 'ABT',
    before: 'BEF',
    after: 'AFT',
    estimated: 'EST',
    calculated: 'CAL',
    exact: '',
    '': '',
  };

  const prefix = modifier ? (prefixMap[modifier] ?? '') : '';
  const parts: string[] = [];

  if (day && day > 0) parts.push(String(day).padStart(2, '0'));
  if (month && month >= 1 && month <= 12) parts.push(MONTHS[month - 1]);
  parts.push(String(year));

  return prefix ? `${prefix} ${parts.join(' ')}` : parts.join(' ');
}
```

---

## 2.8. Tạo `utils/gedcom/exporter.ts`

[CẦN CẨN THẬN]

```bash
nano utils/gedcom/exporter.ts
```

Dán:

```ts
import type { GedcomPerson, GedcomRelationship, GedcomExportResult } from './types';
import { GedcomWriter } from './writer';
import { formatGedcomName, splitVietnameseName } from './name';
import { formatGedcomDate } from './date';

type ExportData = {
  persons: GedcomPerson[];
  relationships: GedcomRelationship[];
};

type LegacyFamily = {
  id: string;
  husb?: string;
  wife?: string;
  children: string[];
};

export function exportToGedcom(data: ExportData): string {
  return exportToGedcomWithWarnings(data).content;
}

export function exportToGedcomWithWarnings(data: ExportData): GedcomExportResult {
  const warnings: string[] = [];
  const w = new GedcomWriter();

  w.addRaw('0 HEAD');
  w.addRaw('1 GEDC');
  w.addRaw('2 VERS 5.5.1');
  w.addRaw('1 CHAR UTF-8');
  w.addRaw('1 LANG Vietnamese');
  w.addRaw('1 SOUR GIAPHA_OS');
  w.addRaw('2 NAME Giapha OS');
  w.addRaw('2 VERS 2.3.3');

  const xref = new Map<string, string>();
  data.persons.forEach((p, i) => { if (p.id) xref.set(p.id, `I${i + 1}`); });
  const getIndi = (id?: string) => id && xref.has(id) ? `@${xref.get(id)}@` : '';

  const families = buildLegacyFamilies(data.persons, data.relationships, warnings);

  const personFamc = new Map<string, string[]>();
  const personFams = new Map<string, string[]>();

  for (const fam of families) {
    if (fam.husb) personFams.set(fam.husb, [...(personFams.get(fam.husb) ?? []), fam.id]);
    if (fam.wife) personFams.set(fam.wife, [...(personFams.get(fam.wife) ?? []), fam.id]);
    for (const child of fam.children) {
      personFamc.set(child, [...(personFamc.get(child) ?? []), fam.id]);
    }
  }

  for (const person of data.persons) {
    if (!person.id) continue;

    w.addRaw(`0 @${xref.get(person.id)}@ INDI`);

    const fullName = person.full_name?.trim() || 'Unknown';
    w.add(1, 'NAME', formatGedcomName(fullName, person.surname, person.given_name));

    const n = splitVietnameseName(fullName, person.surname, person.given_name);
    if (n.surname) w.add(2, 'SURN', n.surname);
    if (n.givenName) w.add(2, 'GIVN', n.givenName);

    if (person.gender === 'male') w.addRaw('1 SEX M');
    else if (person.gender === 'female') w.addRaw('1 SEX F');
    else w.addRaw('1 SEX U');

    const birthDate = formatGedcomDate(person.birth_year, person.birth_month, person.birth_day);
    if (birthDate) {
      w.addRaw('1 BIRT');
      w.add(2, 'DATE', birthDate);
    }

    if (person.is_deceased) {
      w.addRaw('1 DEAT Y');
      const deathDate = formatGedcomDate(person.death_year, person.death_month, person.death_day);
      if (deathDate) w.add(2, 'DATE', deathDate);

      if (person.death_lunar_year || person.death_lunar_month || person.death_lunar_day) {
        const lunar = [
          person.death_lunar_day ? String(person.death_lunar_day).padStart(2, '0') : '',
          person.death_lunar_month ? String(person.death_lunar_month).padStart(2, '0') : '',
          person.death_lunar_year ? String(person.death_lunar_year) : '',
        ].join('/');

        w.add(2, '_GIAPHA_LUNAR', lunar);
        if (person.death_lunar_is_leap) w.add(2, '_GIAPHA_LUNAR_LEAP', 'Y');
      }
    }

    for (const famId of personFamc.get(person.id) ?? []) w.addRaw(`1 FAMC @${famId}@`);
    for (const famId of personFams.get(person.id) ?? []) w.addRaw(`1 FAMS @${famId}@`);

    if (person.note) w.add(1, 'NOTE', person.note);
  }

  for (const fam of families) {
    w.addRaw(`0 @${fam.id}@ FAM`);
    if (fam.husb) w.addRaw(`1 HUSB ${getIndi(fam.husb)}`);
    if (fam.wife) w.addRaw(`1 WIFE ${getIndi(fam.wife)}`);
    for (const child of fam.children) w.addRaw(`1 CHIL ${getIndi(child)}`);
  }

  w.addRaw('0 TRLR');

  return {
    content: w.toString(),
    warnings,
  };
}

function buildLegacyFamilies(
  persons: GedcomPerson[],
  rels: GedcomRelationship[],
  warnings: string[],
): LegacyFamily[] {
  const personMap = new Map(persons.filter(p => p.id).map(p => [p.id!, p]));
  const families: LegacyFamily[] = [];
  let f = 1;

  for (const rel of rels.filter(r => r.type === 'marriage')) {
    if (!rel.person_a || !rel.person_b) continue;

    const a = personMap.get(rel.person_a);
    const b = personMap.get(rel.person_b);
    if (!a || !b) continue;

    const husb = a.gender === 'male'
      ? rel.person_a
      : b.gender === 'male'
        ? rel.person_b
        : rel.person_a;

    const wife = a.gender === 'female'
      ? rel.person_a
      : b.gender === 'female'
        ? rel.person_b
        : rel.person_b;

    families.push({ id: `F${f++}`, husb, wife, children: [] });
  }

  const parentMarriageCount = new Map<string, number>();
  for (const fam of families) {
    for (const parent of [fam.husb, fam.wife].filter(Boolean) as string[]) {
      parentMarriageCount.set(parent, (parentMarriageCount.get(parent) ?? 0) + 1);
    }
  }

  for (const rel of rels.filter(r => r.type === 'biological_child' || r.type === 'adopted_child')) {
    if (!rel.person_a || !rel.person_b) continue;

    let fam = families.find(x => x.husb === rel.person_a || x.wife === rel.person_a);

    if ((parentMarriageCount.get(rel.person_a) ?? 0) > 1) {
      warnings.push(
        `Child ${rel.person_b}: parent ${rel.person_a} có nhiều hôn nhân. ` +
        `Legacy relationships không đủ family unit, exporter chỉ gán best-effort. ` +
        `Hãy kiểm tra lại sau khi nâng cấp Family Model.`
      );
    }

    if (!fam) {
      const p = personMap.get(rel.person_a);
      fam = {
        id: `F${f++}`,
        husb: p?.gender === 'male' ? rel.person_a : undefined,
        wife: p?.gender === 'female' ? rel.person_a : undefined,
        children: [],
      };
      families.push(fam);
    }

    if (!fam.children.includes(rel.person_b)) {
      fam.children.push(rel.person_b);
    }
  }

  return families;
}
```

---

## 2.9. Tạo `utils/gedcom/parser.ts`

```bash
nano utils/gedcom/parser.ts
```

Dán:

```ts
import { parseGedcomName } from './name';

export function parseGedcom(content: string) {
  const lines = content.replace(/^\uFEFF/, '').split(/\r?\n/);
  const persons: any[] = [];
  const relationships: any[] = [];
  const fams: any[] = [];

  let current: any = null;
  let currentType: 'INDI' | 'FAM' | null = null;
  let currentEvent: 'BIRT' | 'DEAT' | null = null;

  for (const raw of lines) {
    const m = raw.match(/^(\d+)\s+(?:(@[^@]+@)\s+)?(\S+)(?:\s+(.*))?$/);
    if (!m) continue;

    const level = Number(m[1]);
    const xref = m[2];
    const tag = m[3];
    const val = m[4] ?? '';

    if (level === 0) {
      currentEvent = null;

      if (tag === 'INDI' && xref) {
        current = { xref, full_name: 'Unknown', gender: 'other' };
        persons.push(current);
        currentType = 'INDI';
      } else if (tag === 'FAM' && xref) {
        current = { xref, husb: null, wife: null, children: [] };
        fams.push(current);
        currentType = 'FAM';
      } else {
        current = null;
        currentType = null;
      }

      continue;
    }

    if (!current) continue;

    if (currentType === 'INDI') {
      if (tag === 'NAME') Object.assign(current, parseGedcomName(val));
      if (tag === 'SURN') current.surname = val.trim();
      if (tag === 'GIVN') current.given_name = val.trim();
      if (tag === 'SEX') current.gender = val === 'M' ? 'male' : val === 'F' ? 'female' : 'other';
      if (tag === 'BIRT') currentEvent = 'BIRT';
      if (tag === 'DEAT') { currentEvent = 'DEAT'; current.is_deceased = true; }
      if (tag === 'DATE' && currentEvent) parseDateIntoPerson(current, currentEvent, val);
      if ((tag === '_GIAPHA_LUNAR' || tag === '_LUNAR') && currentEvent) parseLunarIntoPerson(current, currentEvent, val);
    }

    if (currentType === 'FAM') {
      if (tag === 'HUSB') current.husb = val.trim();
      if (tag === 'WIFE') current.wife = val.trim();
      if (tag === 'CHIL') current.children.push(val.trim());
    }
  }

  for (const p of persons) {
    p.id = makeId();
  }

  const xrefToId = new Map(persons.map(p => [p.xref, p.id]));

  for (const fam of fams) {
    const husbId = fam.husb ? xrefToId.get(fam.husb) : null;
    const wifeId = fam.wife ? xrefToId.get(fam.wife) : null;

    if (husbId && wifeId) {
      relationships.push({ type: 'marriage', person_a: husbId, person_b: wifeId });
    }

    for (const childX of fam.children) {
      const childId = xrefToId.get(childX);
      if (!childId) continue;

      if (husbId) relationships.push({ type: 'biological_child', person_a: husbId, person_b: childId });
      if (wifeId) relationships.push({ type: 'biological_child', person_a: wifeId, person_b: childId });
    }
  }

  return { persons, relationships };
}

function makeId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return generateUUID();
}

function parseDateIntoPerson(p: any, ev: 'BIRT' | 'DEAT', date: string) {
  const parts = date.trim().split(/\s+/);
  const year = Number(parts[parts.length - 1]);
  if (!Number.isFinite(year)) return;

  const prefix = ev === 'BIRT' ? 'birth' : 'death';
  p[`${prefix}_year`] = year;

  if (parts.length >= 2) p[`${prefix}_month`] = parseMonth(parts[parts.length - 2]);
  if (parts.length >= 3) p[`${prefix}_day`] = Number(parts[parts.length - 3]) || null;
}

function parseLunarIntoPerson(p: any, ev: 'BIRT' | 'DEAT', value: string) {
  const [d, m, y] = value.split('/').map(Number);
  const prefix = ev === 'BIRT' ? 'birth' : 'death';

  p[`${prefix}_lunar_day`] = d || null;
  p[`${prefix}_lunar_month`] = m || null;
  p[`${prefix}_lunar_year`] = y || null;
}

function parseMonth(m: string) {
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  const i = months.indexOf(m.toUpperCase());
  return i >= 0 ? i + 1 : null;
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
```

---

## 2.10. Sửa `components/DataImportExport.tsx`

[CẦN CẨN THẬN]

Tìm đoạn tạo Blob khi export GEDCOM.

Đổi:

```ts
const blob = new Blob([content], { type });
```

thành:

```ts
const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
```

Nếu code đang dùng biến `type` cho cả JSON/GEDCOM, sửa có điều kiện:

```ts
const blobType =
  format === 'gedcom'
    ? 'text/plain;charset=utf-8'
    : 'application/json;charset=utf-8';

const blob = new Blob([content], { type: blobType });
```

---

## 2.11. Tạo test GEDCOM

### Exporter test

```bash
nano tests/gedcom/exporter.test.ts
```

Dán:

```ts
import { describe, it, expect } from 'vitest';
import { exportToGedcom, exportToGedcomWithWarnings } from '@/utils/gedcom';

describe('GEDCOM exporter v2.3.3 final', () => {
  it('adds UTF-8 BOM and header', () => {
    const out = exportToGedcom({ persons: [], relationships: [] });
    expect(out.charCodeAt(0)).toBe(0xFEFF);
    expect(out).toContain('1 CHAR UTF-8');
    expect(out).toContain('1 LANG Vietnamese');
    expect(out).toContain('\r\n');
  });

  it('exports Vietnamese name correctly', () => {
    const out = exportToGedcom({
      persons: [{ id: 'p1', full_name: 'Nguyễn Văn An', gender: 'male' }],
      relationships: [],
    });

    expect(out).toContain('1 NAME Văn An /Nguyễn/');
    expect(out).toContain('2 SURN Nguyễn');
    expect(out).toContain('2 GIVN Văn An');
    expect(out).not.toContain('Nguyễn Văn /An/');
  });

  it('escapes @ inside text values', () => {
    const out = exportToGedcom({
      persons: [{ id: 'p1', full_name: 'Nguyễn @ An', gender: 'male' }],
      relationships: [],
    });

    expect(out).toContain('@@');
  });

  it('wraps long Vietnamese notes under 255 bytes', () => {
    const note = 'Ông Nguyễn Văn An sinh tại làng Đình Bảng, Từ Sơn, Bắc Ninh. '.repeat(12);
    const out = exportToGedcom({
      persons: [{ id: 'p1', full_name: 'Nguyễn Văn An', gender: 'male', note }],
      relationships: [],
    });

    for (const line of out.split('\r\n').filter(Boolean)) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(255);
    }
  });

  it('returns warnings for ambiguous legacy family export', () => {
    const result = exportToGedcomWithWarnings({
      persons: [
        { id: 'a', full_name: 'Nguyễn Văn A', gender: 'male' },
        { id: 'b', full_name: 'Trần Thị B', gender: 'female' },
        { id: 'd', full_name: 'Lê Thị D', gender: 'female' },
        { id: 'c', full_name: 'Nguyễn Văn C', gender: 'male' },
      ],
      relationships: [
        { type: 'marriage', person_a: 'a', person_b: 'b' },
        { type: 'marriage', person_a: 'a', person_b: 'd' },
        { type: 'biological_child', person_a: 'a', person_b: 'c' },
      ],
    });

    expect(result.content).toContain('0 HEAD');
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
```

### Parser test

```bash
nano tests/gedcom/parser.test.ts
```

Dán:

```ts
import { describe, it, expect } from 'vitest';
import { parseGedcom } from '@/utils/gedcom';

describe('GEDCOM parser hotfix', () => {
  it('imports FAM child with both parents', () => {
    const ged = [
      '0 HEAD',
      '1 CHAR UTF-8',
      '0 @I1@ INDI',
      '1 NAME Văn An /Nguyễn/',
      '1 SEX M',
      '0 @I2@ INDI',
      '1 NAME Thị Bình /Trần/',
      '1 SEX F',
      '0 @I3@ INDI',
      '1 NAME Văn Con /Nguyễn/',
      '1 SEX M',
      '0 @F1@ FAM',
      '1 HUSB @I1@',
      '1 WIFE @I2@',
      '1 CHIL @I3@',
      '0 TRLR',
    ].join('\r\n');

    const out = parseGedcom(ged);
    expect(out.relationships.filter((r: any) => r.type === 'biological_child')).toHaveLength(2);
  });
});
```

---

## 2.12. Chạy test và build

```bash
bun run test
bun run build
```

Nếu lỗi TypeScript đường dẫn `@/utils/gedcom`, thử kiểm tra tsconfig path hoặc đổi import test thành relative path.

Nếu build lỗi:

```text
[DỪNG LẠI]
Không deploy.
Sửa lỗi trước.
```

---

## 2.13. Export GEDCOM thử từ app

Chạy dev:

```bash
bun run dev
```

Vào app:

```text
Dashboard → Dữ liệu → Xuất GEDCOM
```

Mở file bằng VS Code hoặc Notepad++.

Kiểm tra:

```text
□ File có UTF-8 BOM
□ Header có 1 CHAR UTF-8
□ Header có 1 LANG Vietnamese
□ Tên Nguyễn Văn An thành Văn An /Nguyễn/
□ Có SURN Nguyễn
□ Có GIVN Văn An
□ Dòng xuống là CRLF
```

---

## 2.14. Checklist cuối Ngày 2

```text
□ bun run test pass
□ bun run build pass
□ File .ged mở bằng VS Code/Notepad++ là UTF-8 with BOM
□ GEDCOM header có 1 CHAR UTF-8
□ GEDCOM header có 1 LANG Vietnamese
□ Line ending là CRLF
□ Nguyễn Văn An export thành 1 NAME Văn An /Nguyễn/
□ Có 2 SURN Nguyễn và 2 GIVN Văn An
□ @ trong text value được escape thành @@
□ Ghi chú dài mỗi dòng ≤ 255 bytes
□ Parser import FAM HUSB/WIFE/CHIL tạo đủ 2 parent-child relationships
□ Nếu có thể, import thử vào FamilyGem/Gramps không lỗi font tiếng Việt
```

---

# NGÀY 3 — SAFETY DB TỐI THIỂU

## Mục tiêu Ngày 3

```text
□ Có feature_flags.
□ Có audit_logs.
□ Có migration_log.
□ Có deleted_at/deleted_by cho persons và relationships.
□ Có persons_active và relationships_active.
□ Chưa bật hard-delete blocker nếu restore cũ còn hard delete.
```

---

## 3.1. Tạo bảng feature_flags

[TỰ LÀM TRONG SUPABASE SQL EDITOR]

```sql
CREATE TABLE IF NOT EXISTS public.feature_flags (
  key TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES public.profiles(id)
);

INSERT INTO public.feature_flags (key, enabled, description)
VALUES
  ('gedcom_exporter_v233', false, 'Dùng GEDCOM exporter v2.3.3'),
  ('read_person_names', false, 'Đọc tên từ person_names'),
  ('read_families', false, 'Đọc tree/kinship từ families'),
  ('write_families', false, 'Ghi family model mới'),
  ('read_events', false, 'Đọc ngày từ events'),
  ('write_events', false, 'Ghi events'),
  ('gedcom_import_staging', false, 'Import GEDCOM qua staging'),
  ('allow_legacy_cleanup', false, 'Cho phép cleanup cột/bảng legacy')
ON CONFLICT (key) DO NOTHING;
```

Kiểm tra:

```sql
SELECT * FROM public.feature_flags ORDER BY key;
```

---

## 3.2. Tạo audit_logs

```sql
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('CREATE','UPDATE','DELETE','RESTORE','MIGRATE')),
  changed_by UUID REFERENCES public.profiles(id),
  old_data JSONB,
  new_data JSONB,
  source TEXT DEFAULT 'app' CHECK (source IN ('app','migration','import')),
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_logs_table_record ON public.audit_logs(table_name, record_id);
CREATE INDEX IF NOT EXISTS audit_logs_changed_at ON public.audit_logs(changed_at DESC);

CREATE OR REPLACE FUNCTION public.log_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs(table_name, record_id, action, changed_by, old_data, new_data, source)
  VALUES (
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    CASE TG_OP WHEN 'INSERT' THEN 'CREATE' WHEN 'UPDATE' THEN 'UPDATE' ELSE 'DELETE' END,
    auth.uid(),
    CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) ELSE NULL END,
    COALESCE(NULLIF(current_setting('app.source', true), ''), 'app')
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS audit_persons ON public.persons;
CREATE TRIGGER audit_persons
AFTER INSERT OR UPDATE OR DELETE ON public.persons
FOR EACH ROW EXECUTE FUNCTION public.log_changes();

DROP TRIGGER IF EXISTS audit_relationships ON public.relationships;
CREATE TRIGGER audit_relationships
AFTER INSERT OR UPDATE OR DELETE ON public.relationships
FOR EACH ROW EXECUTE FUNCTION public.log_changes();
```

Kiểm tra nhanh:

```sql
SELECT COUNT(*) FROM public.audit_logs;
```

---

## 3.3. Tạo migration_log

```sql
CREATE TABLE IF NOT EXISTS public.migration_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','done','failed','rolled_back')),
  dry_run BOOLEAN NOT NULL DEFAULT TRUE,
  rows_read INT,
  rows_written INT,
  rows_skipped INT,
  rows_review INT,
  error TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  run_by UUID REFERENCES public.profiles(id)
);
```

Kiểm tra:

```sql
SELECT * FROM public.migration_log;
```

---

## 3.4. Thêm soft delete columns cho bảng legacy

```sql
ALTER TABLE public.persons
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES public.profiles(id);

ALTER TABLE public.relationships
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES public.profiles(id);

CREATE OR REPLACE VIEW public.persons_active AS
  SELECT * FROM public.persons WHERE deleted_at IS NULL;

CREATE OR REPLACE VIEW public.relationships_active AS
  SELECT * FROM public.relationships WHERE deleted_at IS NULL;
```

Kiểm tra:

```sql
SELECT COUNT(*) FROM public.persons_active;
SELECT COUNT(*) FROM public.relationships_active;
```

Số lượng phải gần bằng số bảng gốc vì chưa xóa mềm ai.

---

## 3.5. Thêm version cho persons

```sql
ALTER TABLE public.persons ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1;

CREATE OR REPLACE FUNCTION public.increment_version()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.version = OLD.version + 1;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS persons_version ON public.persons;
CREATE TRIGGER persons_version
BEFORE UPDATE ON public.persons
FOR EACH ROW EXECUTE FUNCTION public.increment_version();
```

---

## 3.6. Tạo function hard-delete blocker nhưng chưa bật trigger

```sql
CREATE OR REPLACE FUNCTION public.prevent_hard_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF current_setting('app.allow_hard_delete', true) = 'true' THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION 'Hard delete bị chặn trên bảng %. Hãy dùng soft delete.', TG_TABLE_NAME;
END;
$$;
```

Chỉ tạo function. **Chưa attach trigger** ở ngày này.

---

## 3.7. Checklist cuối Ngày 3

```text
□ feature_flags tạo được
□ audit_logs tạo được
□ migration_log tạo được
□ persons có deleted_at/deleted_by
□ relationships có deleted_at/deleted_by
□ persons_active query được
□ relationships_active query được
□ persons có version
□ prevent_hard_delete function đã tạo
□ Chưa bật hard-delete blocker trigger
□ App vẫn mở được
□ bun run build pass
```

Chạy:

```bash
bun run build
```

---

# NGÀY 4 — SOFT DELETE VÀ ACTIVE QUERIES

## Mục tiêu Ngày 4

```text
□ Xóa thành viên không còn hard delete persons.
□ Xóa relationship không còn hard delete relationships.
□ Query đọc persons/relationships lọc deleted_at.
□ UI restore toàn bộ có cảnh báo rõ.
```

---

## 4.1. Tìm tất cả `.delete()`

```bash
cd /opt/giapha-os
grep -rn "\.delete()" app components utils --include="*.ts" --include="*.tsx"
```

Ghi lại kết quả.

Bạn cần xử lý tối thiểu:

```text
app/actions/member.ts           → persons.delete()
components/RelationshipManager.tsx → relationships.delete()
```

Tạm chấp nhận sau này:

```text
components/MemberForm.tsx       → person_details_private.delete()
components/CustomEventModal.tsx → custom_events.delete()
app/actions/data.ts             → restore toàn bộ, cần cảnh báo riêng
```

---

## 4.2. Sửa `app/actions/member.ts`

[CẦN DEV KIỂM TRA]

Tìm function `deleteMemberProfile`.

Thay đoạn xóa `persons` thật:

```ts
.from("persons").delete()
```

bằng update:

```ts
.from("persons")
.update({
  deleted_at: new Date().toISOString(),
  deleted_by: profile.id,
})
.eq("id", memberId)
.is("deleted_at", null)
```

Nếu trong file không có biến `profile.id`, dùng user id hiện có trong function. Nếu không chắc, dừng và hỏi dev.

Các query check relationship của member phải thêm:

```ts
.is("deleted_at", null)
```

---

## 4.3. Sửa `components/RelationshipManager.tsx`

[CẦN DEV KIỂM TRA]

Tìm `.from("relationships").delete()`.

Đổi sang:

```ts
await supabase
  .from("relationships")
  .update({ deleted_at: new Date().toISOString() })
  .eq("id", relId)
  .is("deleted_at", null);
```

Nếu có user id/profile thì thêm `deleted_by`.

---

## 4.4. Đổi query đọc persons/relationships

[CẦN CẨN THẬN]

Tìm:

```bash
grep -rn "from('persons')" app components utils --include="*.ts" --include="*.tsx"
grep -rn 'from("persons")' app components utils --include="*.ts" --include="*.tsx"
grep -rn "from('relationships')" app components utils --include="*.ts" --include="*.tsx"
grep -rn 'from("relationships")' app components utils --include="*.ts" --include="*.tsx"
```

Ở các nơi chỉ đọc dữ liệu, đổi:

```ts
.from('persons')
```

thành:

```ts
.from('persons_active')
```

và:

```ts
.from('relationships')
```

thành:

```ts
.from('relationships_active')
```

Nếu file vừa đọc vừa ghi, không đổi bừa. Thay vào đó, thêm filter cho query đọc:

```ts
.is('deleted_at', null)
```

Các file ưu tiên rà:

```text
components/DataImportExport.tsx
components/DashboardMemberList.tsx
components/PersonSelector.tsx
components/RootSelector.tsx
components/RelationshipManager.tsx
components/FamilyTree.tsx
components/KinshipFinder.tsx
app/dashboard/members/page.tsx
app/dashboard/kinship/page.tsx
app/dashboard/lineage/page.tsx
app/actions/member.ts
app/actions/data.ts
```

---

## 4.5. Đổi UI import thành restore toàn bộ

[CẦN CẨN THẬN]

File:

```text
components/DataImportExport.tsx
```

Đổi label/nội dung từ “Nhập dữ liệu” thành:

```text
Khôi phục toàn bộ từ file backup
```

Thêm cảnh báo:

```text
Thao tác này sẽ xóa dữ liệu hiện tại và thay bằng dữ liệu trong file.
Hãy backup trước khi tiếp tục.
```

Bắt buộc người dùng xác nhận:

```text
□ Tôi hiểu thao tác này sẽ thay thế toàn bộ dữ liệu hiện tại.
Nhập chữ RESTORE để tiếp tục.
```

Nếu chưa làm được confirm UI ngay, ít nhất đổi text cảnh báo rõ ràng.

---

## 4.6. Chạy build và grep lại

```bash
bun run build
grep -rn "\.delete()" app components utils --include="*.ts" --include="*.tsx"
```

Không được còn hard delete thường với:

```text
persons trong app/actions/member.ts
relationships trong components/RelationshipManager.tsx
```

---

## 4.7. Test thủ công soft delete

Trong app:

```text
1. Tạo một người test: "TEST DELETE".
2. Xóa người đó.
3. Vào Supabase kiểm tra:
```

SQL:

```sql
SELECT full_name, deleted_at
FROM public.persons
WHERE full_name ILIKE '%TEST DELETE%';
```

Kết quả:

```text
Có record, deleted_at không null.
```

Người đó không được hiện trong danh sách/cây.

---

## 4.8. Bật hard-delete blocker hay chưa?

Nếu `importData()` vẫn dùng hard delete để restore toàn bộ:

```text
Chưa bật blocker.
```

Nếu đã tách restore an toàn và chắc chắn không cần hard delete thường:

```sql
DROP TRIGGER IF EXISTS block_delete_persons ON public.persons;
CREATE TRIGGER block_delete_persons
BEFORE DELETE ON public.persons
FOR EACH ROW EXECUTE FUNCTION public.prevent_hard_delete();

DROP TRIGGER IF EXISTS block_delete_relationships ON public.relationships;
CREATE TRIGGER block_delete_relationships
BEFORE DELETE ON public.relationships
FOR EACH ROW EXECUTE FUNCTION public.prevent_hard_delete();
```

Khuyến nghị cho bạn ở giai đoạn đầu: **chưa bật blocker production**, chỉ bật sau khi dùng ổn vài ngày.

---

## 4.9. Checklist cuối Ngày 4

```text
□ deleteMemberProfile không còn .delete() persons
□ RelationshipManager không còn .delete() relationships
□ grep .delete() không còn hard delete core genealogy ngoài restoreFullBackup/importData
□ Người đã deleted_at không hiện trong danh sách
□ Relationship đã deleted_at không hiện trên tree/kinship
□ GEDCOM export không export person/relationship đã deleted_at
□ UI restore toàn bộ có cảnh báo rõ
□ bun run build pass
```

---

# NGÀY 5 — PERSON NAMES

## Mục tiêu Ngày 5

```text
□ Có bảng person_names.
□ Mỗi person có 1 primary name.
□ UI vẫn fallback được persons.full_name.
```

---

## 5.1. Tạo enum + bảng person_names

[TỰ LÀM TRONG SUPABASE SQL EDITOR]

```sql
DO $$ BEGIN
  CREATE TYPE public.name_type_enum AS ENUM (
    'birth', 'courtesy', 'posthumous', 'religious', 'married', 'nickname', 'alias'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.person_names (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  person_id UUID REFERENCES public.persons(id) ON DELETE CASCADE NOT NULL,
  type public.name_type_enum NOT NULL DEFAULT 'birth',
  full_text TEXT NOT NULL,
  surname TEXT,
  given_name TEXT,
  language TEXT DEFAULT 'vi',
  is_primary BOOLEAN DEFAULT FALSE,
  note TEXT,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_person_names_primary
ON public.person_names(person_id)
WHERE is_primary = TRUE AND deleted_at IS NULL;
```

---

## 5.2. Migrate full_name sang person_names

```sql
INSERT INTO public.person_names (person_id, type, full_text, surname, given_name, is_primary)
SELECT
  id,
  'birth',
  full_name,
  split_part(full_name, ' ', 1),
  trim(substr(full_name, length(split_part(full_name, ' ', 1)) + 1)),
  TRUE
FROM public.persons
WHERE full_name IS NOT NULL
  AND full_name <> ''
  AND deleted_at IS NULL
ON CONFLICT DO NOTHING;
```

---

## 5.3. Bật RLS

```sql
ALTER TABLE public.person_names ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read person_names" ON public.person_names
FOR SELECT USING (
  deleted_at IS NULL AND auth.uid() IS NOT NULL
);

CREATE POLICY "Editors manage person_names" ON public.person_names
FOR ALL USING (
  public.is_admin() OR public.is_editor()
)
WITH CHECK (
  public.is_admin() OR public.is_editor()
);
```

Nếu `public.is_admin()` hoặc `public.is_editor()` chưa tồn tại, dừng lại và kiểm tra schema hiện tại. Có thể code hiện tại dùng function khác.

---

## 5.4. Verify person_names

```sql
SELECT COUNT(*) AS persons_with_name
FROM public.persons
WHERE full_name IS NOT NULL AND full_name <> '' AND deleted_at IS NULL;

SELECT COUNT(*) AS primary_names
FROM public.person_names
WHERE is_primary = TRUE AND deleted_at IS NULL;

SELECT person_id, COUNT(*)
FROM public.person_names
WHERE is_primary = TRUE AND deleted_at IS NULL
GROUP BY person_id
HAVING COUNT(*) > 1;
```

Kết quả query cuối phải không có dòng nào.

---

## 5.5. Checklist cuối Ngày 5

```text
□ person_names tạo được
□ name_type_enum tạo được
□ Số primary_names gần bằng số persons có full_name
□ Không có person nào có >1 primary name
□ RLS không chặn admin/editor
□ READ_PERSON_NAMES vẫn false nếu UI chưa sửa
□ App vẫn build pass
```

Chạy:

```bash
bun run build
```

---

# NGÀY 6 — FAMILY SCHEMA + RPC

## Mục tiêu Ngày 6

```text
□ Có bảng families/family_parents/family_children.
□ Có migration_review.
□ Có RPC create_family_unit.
□ Chưa migrate thật.
```

---

## 6.1. Tạo enum Family

```sql
DO $$ BEGIN
  CREATE TYPE public.family_type_enum AS ENUM ('marriage', 'partnership', 'unknown');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.family_status_enum AS ENUM ('active', 'divorced', 'widowed', 'separated', 'ended', 'unknown');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.parent_role_enum AS ENUM ('husband', 'wife', 'partner', 'parent');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.child_type_enum AS ENUM ('biological', 'adopted', 'foster', 'stepchild', 'unknown');
EXCEPTION WHEN duplicate_object THEN null;
END $$;
```

---

## 6.2. Tạo bảng Family

```sql
CREATE TABLE IF NOT EXISTS public.families (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type public.family_type_enum NOT NULL DEFAULT 'marriage',
  status public.family_status_enum NOT NULL DEFAULT 'active',
  start_year INT,
  end_year INT,
  note TEXT,
  legacy_relationship_id UUID,
  version INT NOT NULL DEFAULT 1,
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.family_parents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  family_id UUID REFERENCES public.families(id) ON DELETE CASCADE NOT NULL,
  person_id UUID REFERENCES public.persons(id) ON DELETE CASCADE NOT NULL,
  role public.parent_role_enum NOT NULL,
  sort_order INT DEFAULT 0,
  UNIQUE(family_id, person_id)
);

CREATE TABLE IF NOT EXISTS public.family_children (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  family_id UUID REFERENCES public.families(id) ON DELETE CASCADE NOT NULL,
  person_id UUID REFERENCES public.persons(id) ON DELETE CASCADE NOT NULL,
  relationship_type public.child_type_enum NOT NULL DEFAULT 'biological',
  sort_order INT DEFAULT 0,
  legacy_relationship_id UUID,
  migration_confidence TEXT DEFAULT 'review'
    CHECK (migration_confidence IN ('certain','review','manual')),
  UNIQUE(family_id, person_id)
);

CREATE TABLE IF NOT EXISTS public.migration_review (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  migration_name TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  child_id UUID,
  parent_id UUID,
  candidate_families JSONB DEFAULT '[]'::JSONB,
  reason TEXT NOT NULL,
  suggested_family_id UUID,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','resolved','skipped')),
  resolved_by UUID REFERENCES public.profiles(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 6.3. Tạo RLS Family

```sql
ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_parents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_children ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.migration_review ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read families" ON public.families
FOR SELECT USING (deleted_at IS NULL AND auth.uid() IS NOT NULL);

CREATE POLICY "Read family_parents" ON public.family_parents
FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Read family_children" ON public.family_children
FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Editors manage families" ON public.families
FOR ALL USING (public.is_admin() OR public.is_editor())
WITH CHECK (public.is_admin() OR public.is_editor());

CREATE POLICY "Editors manage family_parents" ON public.family_parents
FOR ALL USING (public.is_admin() OR public.is_editor())
WITH CHECK (public.is_admin() OR public.is_editor());

CREATE POLICY "Editors manage family_children" ON public.family_children
FOR ALL USING (public.is_admin() OR public.is_editor())
WITH CHECK (public.is_admin() OR public.is_editor());

CREATE POLICY "Admins manage migration_review" ON public.migration_review
FOR ALL USING (public.is_admin())
WITH CHECK (public.is_admin());
```

---

## 6.4. Tạo RPC create_family_unit

```sql
CREATE OR REPLACE FUNCTION public.create_family_unit(payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_family_id UUID;
BEGIN
  IF NOT (public.is_editor() OR public.is_admin()) THEN
    RETURN jsonb_build_object('success', false, 'code', 'NO_PERMISSION', 'error', 'Không có quyền');
  END IF;

  INSERT INTO public.families(type, status, legacy_relationship_id)
  VALUES (
    COALESCE(payload->>'type', 'marriage')::public.family_type_enum,
    COALESCE(payload->>'status', 'active')::public.family_status_enum,
    NULLIF(payload->>'legacy_relationship_id', '')::UUID
  )
  RETURNING id INTO new_family_id;

  IF payload->>'parent_a_id' IS NOT NULL THEN
    INSERT INTO public.family_parents(family_id, person_id, role)
    VALUES (
      new_family_id,
      (payload->>'parent_a_id')::UUID,
      COALESCE(payload->>'parent_a_role', 'partner')::public.parent_role_enum
    )
    ON CONFLICT DO NOTHING;
  END IF;

  IF payload->>'parent_b_id' IS NOT NULL THEN
    INSERT INTO public.family_parents(family_id, person_id, role)
    VALUES (
      new_family_id,
      (payload->>'parent_b_id')::UUID,
      COALESCE(payload->>'parent_b_role', 'partner')::public.parent_role_enum
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN jsonb_build_object('success', true, 'family_id', new_family_id);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'code', SQLSTATE, 'error', SQLERRM);
END;
$$;
```

---

## 6.5. Test RPC bằng SQL

Lấy 2 person id bất kỳ:

```sql
SELECT id, full_name, gender
FROM public.persons_active
LIMIT 2;
```

Dùng 2 id đó chạy:

```sql
SELECT public.create_family_unit(
  jsonb_build_object(
    'type', 'marriage',
    'parent_a_id', 'UUID_NGUOI_1',
    'parent_a_role', 'husband',
    'parent_b_id', 'UUID_NGUOI_2',
    'parent_b_role', 'wife'
  )
);
```

Nếu trả:

```json
{"success": true, "family_id": "..."}
```

là đạt.

Vì đây là test, có thể xóa mềm family hoặc giữ nếu dùng data test. Nếu đang production thật, nên test trên môi trường dev/staging trước.

---

## 6.6. Checklist cuối Ngày 6

```text
□ family_type_enum tạo được
□ family_status_enum tạo được
□ parent_role_enum tạo được
□ child_type_enum tạo được
□ families tạo được
□ family_parents tạo được
□ family_children tạo được
□ migration_review tạo được
□ RLS family tables tạo được
□ create_family_unit RPC trả success với data test
□ Chưa bật READ_FAMILIES production
□ Chưa chạy migration thật
```

---

# NGÀY 7 — FAMILY MIGRATION DRY-RUN

## Mục tiêu Ngày 7

```text
□ Có script dry-run.
□ Dry-run chạy không ghi DB thật.
□ Case parent tái hôn vào migration_review/report.
□ Chưa bật READ_FAMILIES.
```

---

## 7.1. Tạo script dry-run

[CẦN DEV KIỂM TRA]

Tạo file:

```bash
nano scripts/migrate-to-family-model-safe.ts
```

Nội dung chi tiết nên viết theo roadmap final. Nguyên tắc bắt buộc:

```text
- DRY_RUN=true là mặc định.
- Chỉ auto-gán child khi cả 2 parent trùng marriage.
- Nếu 1 parent có nhiều hôn nhân → đưa vào review.
- Không xóa relationships.
- Insert family_children dùng ON CONFLICT DO NOTHING.
- Khi chạy thật, candidate_families phải update family_id thật.
```

Nếu bạn không rành code, không tự viết script này từ đầu. Nhờ dev lấy từ roadmap final để tạo.

---

## 7.2. Chạy dry-run

```bash
DRY_RUN=true bun run scripts/migrate-to-family-model-safe.ts
```

Nếu script được viết dưới dạng `tsx`, dùng:

```bash
DRY_RUN=true npx tsx scripts/migrate-to-family-model-safe.ts
```

Kết quả cần có:

```text
Số marriage đọc được
Số child certain
Số case review
Số skipped
```

Nếu dry-run báo lỗi, dừng lại.

---

## 7.3. Verify chưa ghi DB thật

Chạy SQL:

```sql
SELECT COUNT(*) FROM public.families;
SELECT COUNT(*) FROM public.family_parents;
SELECT COUNT(*) FROM public.family_children;
SELECT COUNT(*) FROM public.migration_review;
```

Nếu dry-run đúng, các bảng không tăng dữ liệu thật, trừ khi script có chế độ lưu review preview. Nếu có lưu preview, phải ghi rõ trong migration_log.

---

## 7.4. Checklist cuối Ngày 7

```text
□ DRY_RUN=true chạy được
□ Không có lỗi script
□ Report có số marriage/child/review rõ ràng
□ Case parent tái hôn không auto-gán nhầm
□ candidate_families JSONB có legacy_marriage_id + parent names
□ Nếu dry-run không tạo DB, bảng family vẫn chưa có dữ liệu thật
□ Nếu dry-run tạo preview, migration_log ghi dry_run=true
□ Chưa bật READ_FAMILIES
```

---

# SAU NGÀY 7 — CHỈ LÀM KHI ĐÃ ỔN

## A. Family migration thật

Chỉ làm khi:

```text
□ Đã backup mới ngay trước khi chạy.
□ Dry-run sạch.
□ Dev đã review script.
□ Bạn hiểu rollback là tắt flag + truncate bảng mới nếu chưa production write.
```

Chạy:

```bash
DRY_RUN=false npx tsx scripts/migrate-to-family-model-safe.ts
```

Verify:

```sql
SELECT COUNT(*) FROM relationships WHERE type='marriage' AND deleted_at IS NULL;
SELECT COUNT(*) FROM families WHERE deleted_at IS NULL;
SELECT COUNT(*) FROM family_parents;
SELECT COUNT(*) FROM family_children WHERE migration_confidence='certain';
SELECT COUNT(*) FROM migration_review WHERE status='pending';

SELECT COUNT(*)
FROM migration_review
WHERE status = 'pending'
  AND candidate_families::text LIKE '%"family_id":null%';
```

Chỉ bật `READ_FAMILIES` khi verify ổn và graph adapter pass.

---

## B. Event Model

Chỉ làm sau Family Model ổn.

Bắt buộc dùng implementation đầy đủ `ageCalculation.ts` trong Phụ lục của roadmap final, không copy đoạn rút gọn.

Điều kiện pass:

```text
□ death 03/2001 thành 2001-03-01 → 2001-03-31
□ chỉ biết năm hiển thị khoảng tuổi
□ người đã mất không có death event hiển thị "1945 – ?", không tính tuổi hiện tại
□ READ_EVENTS=false fallback cột cũ
□ READ_EVENTS=true ưu tiên events
```

---

## C. GEDCOM staging import

Chỉ làm sau Family/Event ổn.

Quy tắc:

```text
- Upload GEDCOM chỉ ghi staging.
- Không ghi persons/families thật khi parse.
- Preview trước.
- User xác nhận mới commit.
- Commit dùng Approach A: app/service quản lý status, RPC chỉ commit data.
- Không dùng importData() legacy cho GEDCOM staging.
```

---

# ROLLBACK NHANH THEO TÌNH HUỐNG

## Tình huống 1 — GEDCOM hotfix lỗi

```text
1. Tắt NEXT_PUBLIC_FF_GEDCOM_EXPORTER_V233=false.
2. Khôi phục utils/gedcom.ts từ git.
3. Không cần restore DB.
```

Lệnh:

```bash
git checkout -- utils/gedcom.ts utils/gedcom
bun run build
```

---

## Tình huống 2 — Soft delete làm UI không thấy dữ liệu

```text
1. Kiểm tra persons_active/relationships_active.
2. Nếu query đổi sai, quay lại dùng persons/relationships + .is('deleted_at', null).
3. Không restore DB.
```

SQL kiểm tra:

```sql
SELECT COUNT(*) FROM persons;
SELECT COUNT(*) FROM persons_active;
SELECT COUNT(*) FROM relationships;
SELECT COUNT(*) FROM relationships_active;
```

---

## Tình huống 3 — Family migration thật sai, nhưng chưa bật production write

```text
1. Tắt READ_FAMILIES=false.
2. App fallback relationships.
3. Truncate bảng family mới.
```

SQL:

```sql
TRUNCATE public.family_children, public.family_parents, public.families, public.migration_review
RESTART IDENTITY CASCADE;
```

Không drop relationships.

---

## Tình huống 4 — Event migration sai, chưa production write

```text
1. Tắt READ_EVENTS=false.
2. App fallback persons.birth_year/death_year.
3. Truncate events.
```

SQL:

```sql
TRUNCATE public.person_events, public.events
RESTART IDENTITY CASCADE;
```

---

## Tình huống 5 — Hỏng nặng production

Chỉ dùng khi thật sự cần.

```bash
pg_restore --clean --if-exists -d "$DATABASE_URL" backups/YYYY-MM-DD_HH-MM/database.dump
```

Sau restore:

```bash
bun run build
```

Vào app kiểm tra dữ liệu.

---

# TROUBLESHOOTING LỖI THƯỜNG GẶP

## Lỗi: `DATABASE_URL chưa được set`

Cách sửa:

```bash
export DATABASE_URL='postgresql://...'
```

Sau đó chạy lại backup.

---

## Lỗi: `pg_dump: command not found`

Máy chưa có PostgreSQL client.

Cài trên Ubuntu/Debian:

```bash
sudo apt update
sudo apt install postgresql-client -y
```

---

## Lỗi: `bun: command not found`

Cài bun hoặc dùng đúng môi trường hiện tại của project.

Kiểm tra:

```bash
which bun
```

Nếu không có, cần cài Bun hoặc dùng máy đang chạy project.

---

## Lỗi: Supabase SQL báo function `is_admin()` không tồn tại

Dự án có thể dùng tên function quyền khác.

Cách làm:

```sql
SELECT proname FROM pg_proc WHERE proname ILIKE '%admin%';
SELECT proname FROM pg_proc WHERE proname ILIKE '%editor%';
```

Nếu không có, cần tạo helper role hoặc sửa RLS policy theo schema hiện tại.

---

## Lỗi: `CREATE TYPE ... already exists`

Nếu dùng pattern đúng:

```sql
DO $$ BEGIN
  CREATE TYPE ...
EXCEPTION WHEN duplicate_object THEN null;
END $$;
```

sẽ không lỗi. Không dùng `CREATE TYPE IF NOT EXISTS`.

---

## Lỗi: Export GEDCOM bị sai font

Kiểm tra:

```text
□ File có BOM?
□ Header có 1 CHAR UTF-8?
□ Blob type là text/plain;charset=utf-8?
□ Không double encode?
```

Mở bằng VS Code/Notepad++ để kiểm tra encoding.

---

## Lỗi: người đã xóa vẫn hiện trên cây

Kiểm tra query có dùng:

```text
persons_active
relationships_active
```

hoặc có:

```ts
.is('deleted_at', null)
```

Nếu chưa, sửa query.

---

# CHECKLIST CUỐI TRƯỚC KHI BẬT PRODUCTION

```text
□ Có backup mới nhất
□ Đã thử restore backup ít nhất một lần trên môi trường test
□ bun run test pass
□ bun run build pass
□ GEDCOM export/import roundtrip pass
□ Soft-deleted persons/relationships không hiện trên UI/tree/kinship/export
□ importData hiện được gọi là restore toàn bộ và có cảnh báo
□ Hard-delete blocker chưa bật nếu restore legacy còn hard delete
□ person_names migration pass
□ family dry-run pass
□ family migration thật pass trên test/staging
□ migration_review pending đã xử lý hoặc hiểu rõ
□ graph adapter pass
□ event migration dry-run pass
□ chưa cleanup cột/bảng legacy
```

---

# KẾT LUẬN

Runbook này ưu tiên an toàn hơn tốc độ.

Nếu bạn làm đúng thứ tự:

```text
Backup → GEDCOM hotfix → soft delete → active query → person_names → family dry-run → family thật → event → staging import → cleanup
```

thì rủi ro mất dữ liệu thấp.

Nếu bạn bỏ qua backup, bật blocker sớm, hoặc chạy migration Family/Event cùng lúc, rủi ro cao.


# GIAPHA-OS — RUNBOOK v2.3.4 CONTINUE
### Tiếp tục sau khi Family Model đã xong/test pass · Không rollback dữ liệu đã làm

> Runbook này dùng khi bạn đã hoàn thành v2.3.3 đến Family Model và test pass. Mục tiêu là đi tiếp Event Model, UI ngày sinh/ngày mất/tuổi, cây gia phả Việt Nam, thống kê theo root và màn hình họ ngoại.
>
> Quy tắc lớn: **không rollback Family Model**, **không truncate family tables**, **không drop legacy columns**.

> **Bản chỉnh sửa sau review kỹ thuật:** đã sửa 4 điểm trước khi chạy tiếp: reset Event migration dùng `SET LOCAL app.allow_hard_delete`, dán thẳng code `ageCalculation.ts`, bổ sung `sideClassifier.ts`, và thêm bước cài `tsx`.

---

# 0. Đọc trước khi làm

## 0.1. Trạng thái giả định

Bạn đã có:

```text
□ GEDCOM hotfix đã làm.
□ Soft delete persons/relationships đã làm.
□ person_names đã làm.
□ Family schema đã tạo.
□ Family migration đã chạy thật hoặc tối thiểu đã test pass theo yêu cầu của bạn.
□ family_children/family_parents/families hoạt động.
□ test pass.
```

Nếu một mục chưa chắc, không rollback. Chỉ verify lại trước khi tiếp tục.

## 0.2. Những việc không làm trong runbook này

```text
❌ Không truncate families/family_parents/family_children.
❌ Không xóa migration_review.
❌ Không drop relationships.
❌ Không drop birth_year/death_year.
❌ Không bật ALLOW_LEGACY_CLEANUP.
❌ Không import GEDCOM trực tiếp vào DB chính.
```

## 0.3. Thứ tự mới

```text
Ngày 8  — Chốt baseline Family Model + backup mới.
Ngày 9  — Tạo Event schema.
Ngày 10 — Tạo date utils + age tests.
Ngày 11 — Tạo event migration dry-run.
Ngày 12 — Chạy event migration thật + verify.
Ngày 13 — Bật READ_EVENTS sau khi UI fallback pass.
Ngày 14 — Date UI + Person Timeline.
Ngày 15 — Vietnamese Tree Layout.
Ngày 16 — Root-based statistics.
Ngày 17 — Họ ngoại / dual paternal-maternal view.
Sau đó — GEDCOM theo Family/Event + staging import + hardening.
```

---

# NGÀY 8 — CHỐT BASELINE FAMILY MODEL VÀ BACKUP MỚI

## Mục tiêu

```text
□ Xác nhận Family Model hiện tại ổn.
□ Không rollback.
□ Tạo backup mới trước Event Model.
□ Tạo branch v2.3.4.
```

## 8.1. Vào project

```bash
cd /opt/giapha-os
pwd
git status
```

Nếu có nhiều file đang sửa, commit hoặc ghi chú trước khi đi tiếp.

## 8.2. Tạo branch tiếp tục

```bash
git checkout -b upgrade-v2.3.4-events
```

Nếu branch đã tồn tại:

```bash
git checkout upgrade-v2.3.4-events
```

## 8.3. Build/test trước khi làm tiếp

```bash
bun run test
bun run build
```

Nếu lỗi, dừng lại. Sửa lỗi hiện tại trước, không chạy Event Model trên nền đang lỗi.

## 8.4. Verify Family Model hiện tại

Chạy trong Supabase SQL Editor:

```sql
SELECT COUNT(*) AS families
FROM public.families
WHERE deleted_at IS NULL;

SELECT COUNT(*) AS family_parents
FROM public.family_parents;

SELECT COUNT(*) AS family_children
FROM public.family_children;

SELECT COUNT(*) AS migration_review_pending
FROM public.migration_review
WHERE status = 'pending';

SELECT COUNT(*) AS migration_review_resolved
FROM public.migration_review
WHERE status = 'resolved';

SELECT COUNT(*) AS resolved_review_without_family_child
FROM public.migration_review mr
LEFT JOIN public.family_children fc
  ON fc.family_id = mr.suggested_family_id
 AND fc.person_id = mr.child_id
WHERE mr.status = 'resolved'
  AND fc.id IS NULL;
```

Ghi lại kết quả vào file ghi chú.

Nếu `resolved_review_without_family_child > 0`, chưa rollback. Chỉ ghi chú để sửa từng case sau. Event Model vẫn có thể làm nếu FamilyTree/Kinship test pass.

## 8.5. Backup mới

Nếu đã có script backup từ v2.3.3:

```bash
export DATABASE_URL='postgresql://...'
bash scripts/backup-before-migration.sh
```

Đổi tên ghi chú:

```text
Backup trước Event Model v2.3.4: backups/YYYY-MM-DD_HH-MM
```

Nếu chưa có `DATABASE_URL`:

```bash
echo "$DATABASE_URL"
```

Nếu trống, lấy lại connection string từ Supabase rồi export.

## 8.6. Checklist cuối Ngày 8

```text
□ Đang ở branch upgrade-v2.3.4-events.
□ bun run test pass.
□ bun run build pass.
□ Family counts đã ghi lại.
□ Không truncate family tables.
□ Có backup database.dump mới.
□ Có persons.jsonl/relationships.jsonl mới.
□ App vẫn mở được.
```

---

# NGÀY 9 — TẠO EVENT SCHEMA

## Mục tiêu

```text
□ Tạo enums event/date.
□ Tạo events/person_events.
□ Tạo index chống duplicate.
□ Tạo events_active view.
□ Bật RLS.
□ Attach audit/version/blocker cho events.
```

## 9.1. Tạo migration file

```bash
cd /opt/giapha-os
mkdir -p docs/migrations
nano docs/migrations/020_event_model_v234.sql
```

Dán SQL dưới đây.

## 9.2. SQL Event Model

```sql
DO $$ BEGIN
  CREATE TYPE public.date_precision_enum AS ENUM ('day','month','year','decade','range','text','unknown');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.date_modifier_enum AS ENUM ('exact','about','before','after','between','from_to','estimated','calculated','interpreted','phrase','unknown');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.calendar_type_enum AS ENUM ('gregorian','lunar','text','unknown');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.event_type_enum AS ENUM ('birth','death','marriage','divorce','burial','baptism','confirmation','ordination','graduation','occupation','residence','migration','military','award','retirement','custom');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.event_role_enum AS ENUM ('principal','child','husband','wife','witness','officiant','deceased','participant');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS public.events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type public.event_type_enum NOT NULL,
  title TEXT,
  start_date DATE,
  end_date DATE,
  sort_date DATE,
  date_precision public.date_precision_enum DEFAULT 'unknown',
  date_modifier public.date_modifier_enum DEFAULT 'unknown',
  canonical_calendar public.calendar_type_enum DEFAULT 'unknown',
  date_original_text TEXT,
  date_phrase TEXT,
  lunar_year INT,
  lunar_month INT,
  lunar_day INT,
  lunar_is_leap_month BOOLEAN DEFAULT FALSE,
  place_id UUID,
  place_text TEXT,
  description TEXT,
  family_id UUID REFERENCES public.families(id),
  legacy_person_id UUID REFERENCES public.persons(id),
  legacy_family_id UUID REFERENCES public.families(id),
  legacy_source TEXT,
  migration_confidence TEXT DEFAULT 'certain'
    CHECK (migration_confidence IN ('certain','review','manual')),
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES public.profiles(id),
  version INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.person_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  person_id UUID REFERENCES public.persons(id) ON DELETE CASCADE NOT NULL,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  role public.event_role_enum DEFAULT 'principal',
  sort_order INT DEFAULT 0,
  UNIQUE(person_id, event_id, role)
);

CREATE UNIQUE INDEX IF NOT EXISTS events_legacy_person_type_source_uidx
ON public.events(legacy_person_id, type, legacy_source)
WHERE deleted_at IS NULL
  AND legacy_person_id IS NOT NULL
  AND legacy_source IS NOT NULL;

CREATE INDEX IF NOT EXISTS events_type_sort_date_idx
ON public.events(type, sort_date);

CREATE INDEX IF NOT EXISTS events_family_id_idx
ON public.events(family_id)
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS person_events_person_id_idx
ON public.person_events(person_id);

CREATE INDEX IF NOT EXISTS person_events_event_id_idx
ON public.person_events(event_id);

CREATE OR REPLACE VIEW public.events_active AS
SELECT * FROM public.events WHERE deleted_at IS NULL;

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.person_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Read events" ON public.events
FOR SELECT USING (deleted_at IS NULL AND auth.uid() IS NOT NULL);

CREATE POLICY "Read person_events" ON public.person_events
FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Editors manage events" ON public.events
FOR ALL USING (public.is_admin() OR public.is_editor())
WITH CHECK (public.is_admin() OR public.is_editor());

CREATE POLICY "Editors manage person_events" ON public.person_events
FOR ALL USING (public.is_admin() OR public.is_editor())
WITH CHECK (public.is_admin() OR public.is_editor());

DROP TRIGGER IF EXISTS audit_events ON public.events;
CREATE TRIGGER audit_events
AFTER INSERT OR UPDATE OR DELETE ON public.events
FOR EACH ROW EXECUTE FUNCTION public.log_changes();

DROP TRIGGER IF EXISTS events_version ON public.events;
CREATE TRIGGER events_version
BEFORE UPDATE ON public.events
FOR EACH ROW EXECUTE FUNCTION public.increment_version();

DROP TRIGGER IF EXISTS block_delete_events ON public.events;
CREATE TRIGGER block_delete_events
BEFORE DELETE ON public.events
FOR EACH ROW EXECUTE FUNCTION public.prevent_hard_delete();
```

## 9.3. Chạy SQL

Mở Supabase SQL Editor, dán toàn bộ SQL và chạy.

Nếu báo lỗi `is_admin()` hoặc `is_editor()` không tồn tại:

```sql
SELECT proname FROM pg_proc WHERE proname ILIKE '%admin%';
SELECT proname FROM pg_proc WHERE proname ILIKE '%editor%';
```

Sửa policy theo helper quyền thực tế của dự án. Không tắt RLS bừa.

## 9.4. Verify schema

```sql
SELECT COUNT(*) FROM public.events;
SELECT COUNT(*) FROM public.person_events;
SELECT COUNT(*) FROM public.events_active;

SELECT typname
FROM pg_type
WHERE typname IN (
  'date_precision_enum',
  'date_modifier_enum',
  'calendar_type_enum',
  'event_type_enum',
  'event_role_enum'
);
```

## 9.5. Checklist cuối Ngày 9

```text
□ events tạo được.
□ person_events tạo được.
□ events_active query được.
□ enums tạo đủ.
□ indexes tạo được.
□ RLS tạo được.
□ audit/version/blocker cho events tạo được.
□ bun run build pass.
```

Chạy:

```bash
bun run build
```

---

# NGÀY 10 — DATE UTILS + AGE TESTS

## Mục tiêu

```text
□ Tạo normalizeDate.ts.
□ Tạo ageCalculation.ts.
□ Tạo tests date/age.
□ Test pass trước migration.
```

## 10.1. Tạo thư mục

```bash
mkdir -p utils/date-parser utils/calendar tests/date
```

## 10.2. Tạo normalizeDate.ts

```bash
nano utils/date-parser/normalizeDate.ts
```

Dán:

```ts
export function buildDateRange(year: number, month?: number | null, day?: number | null) {
  const pad = (n: number) => String(n).padStart(2, '0');

  if (year && month && day) {
    const d = `${year}-${pad(month)}-${pad(day)}`;
    return {
      start_date: d,
      end_date: d,
      sort_date: d,
      date_precision: 'day' as const,
      date_modifier: 'exact' as const,
      canonical_calendar: 'gregorian' as const,
      date_original_text: `${pad(day)}-${pad(month)}-${year}`,
    };
  }

  if (year && month) {
    const start = `${year}-${pad(month)}-01`;
    const end = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
    return {
      start_date: start,
      end_date: end,
      sort_date: `${year}-${pad(month)}-15`,
      date_precision: 'month' as const,
      date_modifier: 'exact' as const,
      canonical_calendar: 'gregorian' as const,
      date_original_text: `${pad(month)}-${year}`,
    };
  }

  return {
    start_date: `${year}-01-01`,
    end_date: `${year}-12-31`,
    sort_date: `${year}-06-30`,
    date_precision: 'year' as const,
    date_modifier: 'exact' as const,
    canonical_calendar: 'gregorian' as const,
    date_original_text: String(year),
  };
}
```

## 10.3. Tạo ageCalculation.ts

```bash
nano utils/calendar/ageCalculation.ts
```

Dán toàn bộ code sau:

```ts
export type AgePrecision = 'exact' | 'year_only' | 'partial' | 'unknown';

export interface AgeResult {
  minAge: number | null;
  maxAge: number | null;
  precision: AgePrecision;
  display: string;
  displayShort: string;
}

export function calculateAgeFromEvents(
  birthEvent: { start_date: string | null; end_date: string | null; date_precision: string } | null,
  deathEvent: { start_date: string | null; end_date: string | null; date_precision: string } | null,
): AgeResult {
  const unknown: AgeResult = {
    minAge: null,
    maxAge: null,
    precision: 'unknown',
    display: '',
    displayShort: '',
  };

  if (!birthEvent?.start_date) return unknown;

  const birthStart = new Date(birthEvent.start_date);
  const birthEnd = birthEvent.end_date ? new Date(birthEvent.end_date) : birthStart;
  const now = new Date();
  const refStart = deathEvent?.start_date ? new Date(deathEvent.start_date) : now;
  const refEnd = deathEvent?.end_date ? new Date(deathEvent.end_date) : now;

  const birthExact = birthEvent.date_precision === 'day';
  const deathExact = !deathEvent || deathEvent.date_precision === 'day';
  const birthIsYear = ['year', 'decade', 'unknown'].includes(birthEvent.date_precision);
  const deathIsYear = deathEvent ? ['year', 'decade', 'unknown'].includes(deathEvent.date_precision) : false;

  if (birthExact && deathExact) {
    const age = calcAge(birthStart, refStart);
    return { minAge: age, maxAge: age, precision: 'exact', display: `${age} tuổi`, displayShort: `${age} tuổi` };
  }

  if (birthIsYear || deathIsYear) {
    const min = calcAge(birthEnd, refStart);
    const max = calcAge(birthStart, refEnd);
    const display = min === max ? `khoảng ${min} tuổi` : `khoảng ${min}–${max} tuổi`;
    return { minAge: min, maxAge: max, precision: 'year_only', display, displayShort: `~${min}–${max} tuổi` };
  }

  const min = calcAge(birthEnd, refStart);
  const max = calcAge(birthStart, refEnd);
  const mid = Math.round((min + max) / 2);
  return {
    minAge: min,
    maxAge: max,
    precision: 'partial',
    display: min === max ? `khoảng ${min} tuổi` : `khoảng ${min}–${max} tuổi`,
    displayShort: `~${mid} tuổi`,
  };
}

function calcAge(birthDate: Date, refDate: Date): number {
  let age = refDate.getFullYear() - birthDate.getFullYear();
  const m = refDate.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && refDate.getDate() < birthDate.getDate())) age--;
  return Math.max(0, age);
}

export function formatLifespan(
  birthEvent: Parameters<typeof calculateAgeFromEvents>[0],
  deathEvent: Parameters<typeof calculateAgeFromEvents>[1],
  isLiving: boolean,
): string {
  if (!birthEvent?.start_date) return '';

  const bYear = new Date(birthEvent.start_date).getFullYear();
  const bApprox = birthEvent.date_precision !== 'day' ? '~' : '';

  if (isLiving) {
    const age = calculateAgeFromEvents(birthEvent, null);
    const ageStr = age.precision !== 'unknown' ? ` (${age.displayShort})` : '';
    return `${bApprox}${bYear} – nay${ageStr}`;
  }

  if (!deathEvent?.start_date) {
    return `${bApprox}${bYear} – ?`;
  }

  const dYear = new Date(deathEvent.start_date).getFullYear();
  const dApprox = deathEvent.date_precision !== 'day' ? '~' : '';
  const age = calculateAgeFromEvents(birthEvent, deathEvent);
  const ageStr = age.precision !== 'unknown' ? ` (${age.displayShort})` : '';
  return `${bApprox}${bYear} – ${dApprox}${dYear}${ageStr}`;
}
```

## 10.4. Tạo tests

```bash
nano tests/date/normalizeDate.test.ts
```

Dán:

```ts
import { describe, expect, it } from 'vitest';
import { buildDateRange } from '../../utils/date-parser/normalizeDate';

describe('buildDateRange', () => {
  it('handles year only', () => {
    expect(buildDateRange(1980)).toMatchObject({
      start_date: '1980-01-01',
      end_date: '1980-12-31',
      sort_date: '1980-06-30',
      date_precision: 'year',
    });
  });

  it('handles month precision', () => {
    expect(buildDateRange(2001, 3)).toMatchObject({
      start_date: '2001-03-01',
      end_date: '2001-03-31',
      sort_date: '2001-03-15',
      date_precision: 'month',
    });
  });

  it('handles day precision', () => {
    expect(buildDateRange(1980, 3, 12)).toMatchObject({
      start_date: '1980-03-12',
      end_date: '1980-03-12',
      sort_date: '1980-03-12',
      date_precision: 'day',
    });
  });
});
```

```bash
nano tests/date/ageCalculation.test.ts
```

Dán test tối thiểu:

```ts
import { describe, expect, it } from 'vitest';
import { formatLifespan } from '../../utils/calendar/ageCalculation';

describe('formatLifespan', () => {
  it('does not calculate current age for deceased person without death date', () => {
    const out = formatLifespan(
      { start_date: '1945-01-01', end_date: '1945-12-31', date_precision: 'year' },
      null,
      false,
    );
    expect(out).toBe('~1945 – ?');
  });

  it('shows living person age label', () => {
    const out = formatLifespan(
      { start_date: '1980-01-01', end_date: '1980-12-31', date_precision: 'year' },
      null,
      true,
    );
    expect(out).toContain('~1980 – nay');
  });

  it('shows death year for deceased person with death event', () => {
    const out = formatLifespan(
      { start_date: '1945-01-01', end_date: '1945-12-31', date_precision: 'year' },
      { start_date: '2001-03-01', end_date: '2001-03-31', date_precision: 'month' },
      false,
    );
    expect(out).toContain('~1945 – ~2001');
  });
});
```

## 10.5. Chạy test/build

```bash
bun run test
bun run build
```

## 10.6. Checklist cuối Ngày 10

```text
□ normalizeDate.ts tạo được.
□ ageCalculation.ts tạo được.
□ Year/month/day precision tests pass.
□ Người đã mất không có death event hiển thị birth – ?.
□ bun run test pass.
□ bun run build pass.
```

---

# NGÀY 11 — EVENT MIGRATION DRY-RUN

## Mục tiêu

```text
□ Tạo script migrate-dates-to-events-safe.ts.
□ DRY_RUN=true chạy được.
□ Chưa ghi events thật.
□ Có report birth/death/skipped/invalid.
```


## 11.0. Cài `tsx` nếu chưa có

Runbook dùng `bunx tsx` để chạy script TypeScript. Cài dependency dev trước khi chạy script migration lần đầu:

```bash
cd /opt/giapha-os
bun add -d tsx
```

Kiểm tra nhanh:

```bash
bunx tsx --version
```

Nếu lệnh trên lỗi, dừng lại và sửa môi trường trước khi chạy migration.

## 11.1. Tạo script

```bash
nano scripts/migrate-dates-to-events-safe.ts
```

Nguyên tắc script phải có:

```text
- DRY_RUN=true mặc định.
- Đọc persons_active.
- Nếu birth_year có giá trị → chuẩn bị birth event.
- Nếu is_deceased=true và death_year có giá trị → chuẩn bị death event.
- Nếu is_deceased=true nhưng không có death_year → skipped_no_death_date.
- Không xóa/sửa persons.*.
- DRY_RUN=true không insert events/person_events.
- DRY_RUN=false insert idempotent.
- Ghi report rõ ràng.
```

## 11.2. Chạy dry-run

```bash
DRY_RUN=true bunx tsx scripts/migrate-dates-to-events-safe.ts
```

Kết quả mong muốn dạng:

```text
=== EVENT DATE MIGRATION SAFE ===
DRY_RUN = true
persons read: ...
birth events would create: ...
death events would create: ...
deceased without death date: ...
invalid dates: ...
skipped: ...
```

## 11.3. Verify chưa ghi event thật

```sql
SELECT COUNT(*) FROM public.events;
SELECT COUNT(*) FROM public.person_events;
```

Nếu trước đó bảng mới trống thì vẫn phải là 0. Nếu đã có test event, số không được tăng sau dry-run.

## 11.4. Checklist cuối Ngày 11

```text
□ DRY_RUN=true chạy được.
□ Report rõ birth/death/skipped/invalid.
□ Không insert events khi DRY_RUN=true.
□ Không lỗi invalid date nghiêm trọng.
□ bun run build pass.
```

---

# NGÀY 12 — EVENT MIGRATION THẬT + VERIFY

## Mục tiêu

```text
□ Backup ngay trước khi chạy thật.
□ DRY_RUN=false tạo events/person_events.
□ Verify counts.
□ Không bật READ_EVENTS ngay nếu UI chưa sẵn sàng.
```

## 12.1. Backup ngay trước migration thật

```bash
export DATABASE_URL='postgresql://...'
bash scripts/backup-before-migration.sh
```

## 12.2. Chạy migration thật

```bash
DRY_RUN=false bunx tsx scripts/migrate-dates-to-events-safe.ts
```

Chạy lại lần 2 để test idempotent:

```bash
DRY_RUN=false bunx tsx scripts/migrate-dates-to-events-safe.ts
```

Lần 2 không được tạo duplicate.

## 12.3. Verify SQL

```sql
SELECT COUNT(*) AS legacy_birth_persons
FROM public.persons
WHERE deleted_at IS NULL AND birth_year IS NOT NULL;

SELECT COUNT(*) AS birth_events_from_legacy
FROM public.events e
JOIN public.person_events pe ON pe.event_id = e.id
WHERE e.deleted_at IS NULL
  AND e.type = 'birth'
  AND e.legacy_source = 'persons.birth_*';

SELECT COUNT(*) AS legacy_death_persons_with_year
FROM public.persons
WHERE deleted_at IS NULL
  AND is_deceased = true
  AND death_year IS NOT NULL;

SELECT COUNT(*) AS death_events_from_legacy
FROM public.events e
JOIN public.person_events pe ON pe.event_id = e.id
WHERE e.deleted_at IS NULL
  AND e.type = 'death'
  AND e.legacy_source = 'persons.death_*';

SELECT COUNT(*) AS invalid_event_dates
FROM public.events
WHERE deleted_at IS NULL
  AND start_date IS NOT NULL
  AND end_date IS NOT NULL
  AND end_date < start_date;

SELECT legacy_person_id, type, legacy_source, COUNT(*)
FROM public.events
WHERE deleted_at IS NULL
  AND legacy_person_id IS NOT NULL
  AND legacy_source IS NOT NULL
GROUP BY legacy_person_id, type, legacy_source
HAVING COUNT(*) > 1;

SELECT COUNT(*) AS orphan_events
FROM public.events e
WHERE e.deleted_at IS NULL
  AND e.family_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.person_events pe WHERE pe.event_id = e.id);
```

## 12.4. Không bật READ_EVENTS nếu UI chưa xong

Sau migration thật, vẫn giữ:

```env
NEXT_PUBLIC_FF_READ_EVENTS=false
NEXT_PUBLIC_FF_WRITE_EVENTS=false
```

Đây không phải rollback. Đây là trạng thái an toàn: dữ liệu event đã có, UI vẫn đọc legacy cho tới khi compat/UI pass.

## 12.5. Checklist cuối Ngày 12

```text
□ Có backup ngay trước migration thật.
□ DRY_RUN=false chạy xong.
□ Chạy lần 2 không tạo duplicate.
□ birth_events_from_legacy gần khớp legacy_birth_persons.
□ death_events_from_legacy khớp legacy_death_persons_with_year.
□ invalid_event_dates = 0.
□ Duplicate query không trả dòng nào.
□ orphan_events = 0 hoặc đã giải thích được.
□ READ_EVENTS vẫn false nếu UI chưa xong.
□ Family Model không bị ảnh hưởng.
□ bun run test pass.
□ bun run build pass.
```

---

# NGÀY 13 — DATE COMPAT + BẬT READ_EVENTS CÓ KIỂM SOÁT

## Mục tiêu

```text
□ Tạo compat/date.compat.ts.
□ READ_EVENTS=true ưu tiên events.
□ Missing event vẫn fallback legacy.
□ UI không mất ngày sinh/ngày mất.
```

## 13.1. Tạo compat/date.compat.ts

```bash
mkdir -p compat
nano compat/date.compat.ts
```

Rule bắt buộc trong file:

```text
Nếu featureFlags.readEvents=true:
  query birth/death events trước.
  nếu thiếu thì fallback legacy persons.*.
Nếu featureFlags.readEvents=false:
  dùng legacy persons.*.
```

## 13.2. Tạo tests eventCompat

```bash
mkdir -p tests/events
nano tests/events/eventCompat.test.ts
```

Test tối thiểu:

```text
□ READ_EVENTS=false dùng legacy.
□ READ_EVENTS=true có event thì dùng event.
□ READ_EVENTS=true thiếu event thì fallback legacy.
□ is_deceased=true thiếu death event thì format birth – ?.
```

## 13.3. Bật thử READ_EVENTS local

Trong `.env.local`:

```env
NEXT_PUBLIC_FF_READ_EVENTS=true
NEXT_PUBLIC_FF_WRITE_EVENTS=false
```

Chạy:

```bash
bun run test
bun run build
bun run dev
```

Kiểm tra thủ công:

```text
□ Danh sách thành viên vẫn có ngày sinh.
□ Trang chi tiết vẫn có ngày sinh/ngày mất.
□ Cây gia phả không mất lifespan.
□ Người đã mất không rõ ngày mất không bị tính tuổi hiện tại.
```

## 13.4. Nếu lỗi UI

Không restore DB. Chỉ tắt:

```env
NEXT_PUBLIC_FF_READ_EVENTS=false
```

Rồi sửa compat/UI.

## 13.5. Checklist cuối Ngày 13

```text
□ date.compat.ts tạo được.
□ eventCompat tests pass.
□ READ_EVENTS=false pass.
□ READ_EVENTS=true local pass.
□ Missing event fallback legacy pass.
□ Không bật WRITE_EVENTS nếu form chưa sửa.
```

---

# NGÀY 14 — DATE UI + PERSON TIMELINE

## Mục tiêu

```text
□ Hiển thị ngày sinh/tuổi chuẩn.
□ Hiển thị năm sinh-năm mất/lúc x tuổi.
□ Có PersonTimeline đọc từ events.
□ Form chưa cần WRITE_EVENTS nếu chưa chắc.
```

## 14.1. Tạo components

```bash
nano components/GenealogyDateDisplay.tsx
nano components/PersonLifespan.tsx
nano components/PersonTimeline.tsx
```

## 14.2. Sửa Person Detail / FamilyTree

Tùy code hiện tại, cập nhật các nơi đang hiển thị ngày:

```text
components/FamilyTree.tsx
components/PersonDetail.tsx
app/dashboard/members/page.tsx
components/DashboardMemberList.tsx
```

Quy tắc hiển thị:

```text
Người sống:
Sinh: dd-mm-yyyy (x tuổi)
Sinh: yyyy (~x–y tuổi) nếu chỉ biết năm

Người mất:
yyyy – yyyy (mất lúc x tuổi)
yyyy – ? nếu mất nhưng không rõ ngày mất
```

## 14.3. PersonTimeline

Timeline đọc từ:

```text
events_active + person_events
```

Sắp xếp:

```text
sort_date ASC NULLS LAST
```

Các event tối thiểu:

```text
Sinh
Mất
Kết hôn nếu có marriage event sau này
Sự kiện custom sau này
```

## 14.4. Checklist cuối Ngày 14

```text
□ Người sống hiển thị Sinh + tuổi.
□ Người mất hiển thị năm sinh–năm mất/lúc x tuổi.
□ Người mất không rõ ngày mất hiển thị yyyy – ?.
□ Timeline hiển thị birth/death events.
□ READ_EVENTS=true pass.
□ WRITE_EVENTS vẫn false nếu chưa dual-write.
□ bun run test pass.
□ bun run build pass.
```

---

# NGÀY 15 — VIETNAMESE FAMILYTREE LAYOUT

## Mục tiêu

```text
□ Con nối trực tiếp với cha/mẹ dù đã có vợ/chồng.
□ Dâu/rễ xác định theo root.
□ Có filter ẩn dâu/rễ.
□ Có tùy chọn con trưởng kiểu miền Nam.
```

## 15.1. Tạo utilities

```bash
mkdir -p utils/tree tests/tree
nano utils/tree/rootClassifier.ts
nano utils/tree/sideClassifier.ts
nano utils/tree/birthOrderDisplay.ts
```

## 15.2. Root classifier rule

```text
- Từ root, đi theo parent-child edges để xác định bloodline.
- Spouse của bloodline nhưng không thuộc bloodline là spouse_in_law.
- Nhánh qua cha là paternal_branch.
- Nhánh qua mẹ là maternal_branch.
- Không ghi kết quả này vào DB, vì đổi root thì classification đổi.
```


## 15.2.A. Tạo `sideClassifier.ts`

File này tách riêng logic xác định phía cha/mẹ/huyết thống/dâu rễ để `rootClassifier.ts` và màn hình Họ ngoại dùng lại được. Không lưu kết quả vào DB vì đổi root thì phân loại đổi.

```bash
nano utils/tree/sideClassifier.ts
```

Dán bản khung an toàn sau, sau này có thể mở rộng theo cấu trúc graph thật của dự án:

```ts
export type TreeSide = 'root' | 'paternal' | 'maternal' | 'both' | 'in_law' | 'unknown';

export interface PersonNodeLike {
  id: string;
  gender?: 'male' | 'female' | 'other' | string | null;
}

export interface ParentChildEdgeLike {
  parentId: string;
  childId: string;
}

export interface SpouseEdgeLike {
  spouseA: string;
  spouseB: string;
}

export interface SideClassification {
  personId: string;
  side: TreeSide;
  isBloodline: boolean;
  isInLaw: boolean;
}

export function classifyTreeSides(input: {
  rootPersonId: string;
  fatherId?: string | null;
  motherId?: string | null;
  parentChildEdges: ParentChildEdgeLike[];
  spouseEdges: SpouseEdgeLike[];
}): Map<string, SideClassification> {
  const result = new Map<string, SideClassification>();

  const paternal = input.fatherId
    ? collectRelatives(input.fatherId, input.parentChildEdges)
    : new Set<string>();

  const maternal = input.motherId
    ? collectRelatives(input.motherId, input.parentChildEdges)
    : new Set<string>();

  result.set(input.rootPersonId, {
    personId: input.rootPersonId,
    side: 'root',
    isBloodline: true,
    isInLaw: false,
  });

  for (const personId of new Set([...paternal, ...maternal])) {
    if (personId === input.rootPersonId) continue;
    const inPaternal = paternal.has(personId);
    const inMaternal = maternal.has(personId);
    result.set(personId, {
      personId,
      side: inPaternal && inMaternal ? 'both' : inPaternal ? 'paternal' : 'maternal',
      isBloodline: true,
      isInLaw: false,
    });
  }

  for (const edge of input.spouseEdges) {
    const a = result.get(edge.spouseA);
    const b = result.get(edge.spouseB);

    if (a?.isBloodline && !b) {
      result.set(edge.spouseB, {
        personId: edge.spouseB,
        side: 'in_law',
        isBloodline: false,
        isInLaw: true,
      });
    }

    if (b?.isBloodline && !a) {
      result.set(edge.spouseA, {
        personId: edge.spouseA,
        side: 'in_law',
        isBloodline: false,
        isInLaw: true,
      });
    }
  }

  return result;
}

function collectRelatives(startPersonId: string, edges: ParentChildEdgeLike[]): Set<string> {
  const out = new Set<string>();
  const queue = [startPersonId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (out.has(current)) continue;
    out.add(current);

    for (const edge of edges) {
      // Đi lên ancestors.
      if (edge.childId === current && !out.has(edge.parentId)) queue.push(edge.parentId);
      // Đi xuống descendants.
      if (edge.parentId === current && !out.has(edge.childId)) queue.push(edge.childId);
    }
  }

  return out;
}
```

## 15.3. Birth order display miền Nam

```text
sort_order = 1 → Anh Hai/Chị Hai
sort_order = 2 → Anh Ba/Chị Ba
sort_order = 3 → Anh Tư/Chị Tư
```

Không đổi `sort_order` trong DB.

## 15.4. Sửa FamilyTree layout

File chính thường là:

```text
components/FamilyTree.tsx
utils/treeHelpers.ts hoặc utils/graph/buildUnifiedGraph.ts
```

Rule bắt buộc:

```text
Parent-child edge nối vào person node của child.
Không nối parent-child edge vào midpoint child-spouse.
Spouse edge là line ngang riêng.
Family center chỉ dùng cho nhóm con của một cặp cha mẹ.
```

## 15.5. Bật flag local

```env
NEXT_PUBLIC_FF_VIETNAMESE_TREE_LAYOUT=true
```

Chạy:

```bash
bun run test
bun run build
bun run dev
```

## 15.6. Test thủ công

Chọn một người con đã có vợ/chồng.

Kiểm tra:

```text
□ Line từ cha/mẹ nối vào chính người con.
□ Vợ/chồng của người con nằm ngang với người con.
□ Không còn line từ cha/mẹ nối vào giữa cặp vợ chồng của người con.
□ Tắt dâu/rễ thì spouse ngoài huyết thống ẩn được.
□ Đổi root thì dâu/rễ tính lại.
□ sideClassifier phân loại lại khi đổi root.
□ Chọn kiểu miền Nam thì con đầu hiển thị Anh Hai/Chị Hai.
```

## 15.7. Checklist cuối Ngày 15

```text
□ rootClassifier tạo được.
□ birthOrderDisplay tạo được.
□ Tree layout mới pass.
□ Filter dâu/rễ pass.
□ Southern birth-order display pass.
□ Flag off vẫn fallback layout cũ.
□ bun run test pass.
□ bun run build pass.
```

---

# NGÀY 16 — ROOT-BASED STATISTICS

## Mục tiêu

```text
□ Không thống kê dâu/rễ tuyệt đối toàn DB.
□ Có thống kê global.
□ Có thống kê theo root.
```

## 16.1. Tạo statistics service

```bash
mkdir -p services/statistics
nano services/statistics/globalStats.service.ts
nano services/statistics/rootStats.service.ts
```

## 16.2. Global stats

Phải có:

```text
- Tổng người active.
- Nam/nữ/khác/chưa rõ.
- Còn sống/đã mất/chưa rõ.
- Có gia đình/chưa có gia đình.
- Có con/chưa có con.
- Tổng families.
- Tổng events.
```

## 16.3. Root stats

Phải có:

```text
- Người huyết thống theo root.
- Dâu/rễ theo root.
- Họ nội theo root.
- Họ ngoại theo root.
- Nam/nữ trong nhánh root.
- Có gia đình/chưa có gia đình trong nhánh root.
```

## 16.4. UI

Có thể thêm vào:

```text
/dashboard/data-quality
hoặc /dashboard/statistics
```

Label phải rõ:

```text
Dâu/rễ theo gốc đang chọn
```

Không ghi:

```text
Tổng dâu/rễ toàn gia phả
```

## 16.5. Bật flag local

```env
NEXT_PUBLIC_FF_ROOT_STATS=true
```

## 16.6. Checklist cuối Ngày 16

```text
□ Global stats có Nam/Nữ/độc thân/có gia đình.
□ Root stats có dâu/rễ theo root.
□ Đổi root thì dâu/rễ thay đổi hợp lý.
□ Không dùng is_in_law tuyệt đối làm nguồn chính.
□ bun run test pass.
□ bun run build pass.
```

---

# NGÀY 17 — HỌ NGOẠI / DUAL PATERNAL-MATERNAL VIEW

## Mục tiêu

```text
□ Người gốc ở giữa.
□ Một bên nhánh cha.
□ Một bên nhánh mẹ.
□ Mặc định 3 đời trước/sau.
□ Không làm hỏng FamilyTree chính.
```

## 17.1. Tạo files

```bash
nano utils/tree/buildDualAncestryGraph.ts
nano components/MaternalPaternalTree.tsx
nano components/DualAncestryPanel.tsx
```

Nếu có route dashboard:

```bash
mkdir -p app/dashboard/dual-ancestry
nano app/dashboard/dual-ancestry/page.tsx
```

## 17.2. Input mặc định

```ts
{
  rootPersonId: string;
  generationsUp: 3;
  generationsDown: 3;
  includeSpouses: true;
  includeInLaws: true;
}
```

## 17.3. Layout

```text
Root ở giữa.
Nhánh cha một bên.
Nhánh mẹ một bên.
Con/cháu root ở phía dưới hoặc vùng trung tâm dưới.
Nếu thiếu cha/mẹ, vẫn render nhánh còn lại.
Nếu cycle hoặc người xuất hiện cả hai bên, đưa vào shared/warnings.
```

## 17.4. Bật flag local

```env
NEXT_PUBLIC_FF_MATERNAL_PATERNAL_VIEW=true
```

## 17.5. Test thủ công

Chọn 3 root:

```text
1. Root có đủ cha mẹ.
2. Root chỉ có cha hoặc chỉ có mẹ.
3. Root có vợ/chồng/con.
```

Kiểm tra:

```text
□ View không crash.
□ Nhánh cha/mẹ tách rõ.
□ Có 3 đời trước/sau mặc định.
□ Có thể đổi số đời.
□ Có thể ẩn dâu/rễ.
```

## 17.6. Checklist cuối Ngày 17

```text
□ Dual graph build được.
□ Root ở giữa.
□ Nhánh cha/mẹ hiển thị đúng.
□ Thiếu cha/mẹ không crash.
□ Filter dâu/rễ hoạt động.
□ Không ảnh hưởng FamilyTree chính.
□ bun run test pass.
□ bun run build pass.
```

---

# SAU NGÀY 17 — GEDCOM THEO FAMILY/EVENT

## Mục tiêu

```text
□ GEDCOM export ưu tiên person_names/families/events.
□ Fallback legacy nếu thiếu dữ liệu mới.
□ Không import GEDCOM thẳng DB chính.
```

## Làm sau khi READ_EVENTS ổn

Sửa:

```text
utils/gedcom/exporter.ts
utils/gedcom/parser.ts
components/DataImportExport.tsx
```

Priority:

```text
person_names primary → persons.full_name
families → relationships
birth/death events → persons.birth_*/death_*
event lunar fields → persons.death_lunar_*
```

Test:

```bash
bun run test
bun run build
```

Kiểm tra GEDCOM thủ công:

```text
□ Tên Việt đúng.
□ FAM đúng từ Family Model.
□ BIRT/DEAT đúng từ Event Model.
□ Lunar death không mất.
□ Import thử FamilyGem/Gramps không lỗi font.
```

---

# SAU NỮA — GEDCOM STAGING IMPORT

Chỉ làm khi Family/Event/UI ổn.

Quy tắc:

```text
- Upload GEDCOM chỉ ghi import_sessions/staging.
- Preview trước.
- User xác nhận mới commit.
- Commit dùng Approach A.
- Không dùng importData() legacy cho GEDCOM staging.
```

Không làm chung với Event Model trong cùng ngày.

---

# TROUBLESHOOTING

## 1. Event migration sai count

Không rollback Family Model.

Làm:

```text
1. Tắt READ_EVENTS=false.
2. Kiểm tra script migration.
3. Kiểm tra duplicate index.
4. Sửa event rows nếu cần.
5. Chạy verify lại.
```

Nếu cần xóa event migration để chạy lại, chỉ khi chắc chắn event chưa được production write thủ công:

```sql
-- Chỉ dùng khi reset Event migration legacy và chắc chắn chưa có event production write thủ công.
-- Không dùng cho thao tác xóa event bình thường trong app.
BEGIN;
SET LOCAL app.allow_hard_delete = 'true';

DELETE FROM public.person_events
WHERE event_id IN (
  SELECT id FROM public.events
  WHERE legacy_source IN ('persons.birth_*','persons.death_*')
);

DELETE FROM public.events
WHERE legacy_source IN ('persons.birth_*','persons.death_*');

COMMIT;
-- SET LOCAL tự hết hiệu lực sau transaction.
```

Không đụng `families`.

## 2. READ_EVENTS bật lên mất ngày sinh

Tắt:

```env
NEXT_PUBLIC_FF_READ_EVENTS=false
```

Sửa `compat/date.compat.ts` để fallback legacy khi thiếu event.

Không restore DB.

## 3. Người đã mất không rõ ngày mất bị tính tuổi hiện tại

Lỗi ở `formatLifespan()` hoặc compat truyền sai `isLiving`.

Rule đúng:

```text
is_deceased=true + không có deathEvent → birth – ?
```

Không gọi `calculateAgeFromEvents(birth, null)` cho người đã mất.

## 4. Tree layout vẫn nối vào giữa cặp vợ chồng của con

Lỗi ở layout renderer.

Rule đúng:

```text
parent-child edge target = child person node
spouse edge = ngang giữa child và spouse
không dùng spouse midpoint làm target của parent-child
```

## 5. Dâu/rễ thống kê sai

Kiểm tra root classifier.

Rule đúng:

```text
Dâu/rễ phụ thuộc root.
Không dùng is_in_law tuyệt đối làm thống kê chính.
```

---

# CHECKLIST CUỐI V2.3.4

```text
□ Không rollback Family Model.
□ Event schema tạo được.
□ Event migration dry-run pass.
□ Event migration thật pass.
□ Chạy migration lần 2 không duplicate.
□ READ_EVENTS=true pass.
□ WRITE_EVENTS=false cho tới khi form dual-write xong.
□ Người sống hiển thị tuổi đúng.
□ Người mất hiển thị năm sinh-năm mất/lúc x tuổi.
□ Người mất không rõ ngày mất hiển thị yyyy – ?.
□ Tree layout con nối trực tiếp cha/mẹ.
□ Dâu/rễ filter theo root.
□ Tùy chọn miền Nam hoạt động.
□ Root stats hoạt động.
□ Họ ngoại dual-view hoạt động.
□ GEDCOM export không lỗi tiếng Việt.
□ Data Quality không có lỗi nghiêm trọng.
□ Chưa cleanup legacy.
```

---

# Kết luận

Runbook v2.3.4 tiếp tục đúng từ trạng thái Family Model đã hoàn thành. Việc tiếp theo nên làm là Event Model theo hướng song song, sau đó mới bật UI đọc events. Khi có lỗi, chỉ tắt flag hoặc sửa phần Event/UI; không rollback những gì đã làm ở Family Model.

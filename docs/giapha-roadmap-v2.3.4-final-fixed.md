# GIAPHA-OS — ROADMAP v2.3.4 FINAL
### Bản tiếp tục sau Family Model · Không rollback phần đã làm · Event Model trước · UI cây Việt Nam sau

> **Trạng thái xuất phát của v2.3.4:** bạn đã làm xong theo runbook v2.3.3 đến **Family Model** và test pass. Bản v2.3.4 này **không yêu cầu rollback**, **không truncate** `families`, `family_parents`, `family_children`, `migration_review`, và **không quay lại schema legacy**. Các phần đã hoàn thành được xem là baseline mới.
>
> **Mục tiêu v2.3.4:** tiếp tục từ baseline Family Model để triển khai Event Date System, hiển thị ngày sinh/ngày mất/tuổi, sau đó nâng cấp UI cây gia phả Việt Nam: con nối trực tiếp cha mẹ, lọc dâu/rễ theo root, tùy chọn miền Nam, thống kê theo root, và màn hình họ ngoại hai nhánh cha/mẹ.

> **Bản chỉnh sửa sau review kỹ thuật:** áp dụng 4 sửa trước khi triển khai: reset Event migration dùng `SET LOCAL app.allow_hard_delete`, runbook dán thẳng `ageCalculation.ts`, bổ sung bước tạo `sideClassifier.ts`, và thêm `bun add -d tsx` trước khi chạy script bằng `bunx tsx`.

---

## 0. Quyết định chính của v2.3.4

### 0.1. Không rollback những gì đã làm

```text
✅ Giữ nguyên GEDCOM hotfix đã làm.
✅ Giữ nguyên soft delete persons/relationships.
✅ Giữ nguyên person_names.
✅ Giữ nguyên Family Model đã migrate/test pass.
✅ Giữ nguyên migration_review hiện tại.
✅ Không truncate family tables.
✅ Không drop relationships legacy.
✅ Không drop birth_year/death_year legacy.
✅ Không cleanup legacy sớm.
```

Nếu trong quá trình Event Model có lỗi, rollback nhanh là:

```text
1. Tắt READ_EVENTS/WRITE_EVENTS.
2. App fallback dữ liệu cũ trong persons.*.
3. Sửa code/migration event.
4. Không đụng lại Family Model.
```

### 0.2. Baseline mới

Từ v2.3.4 trở đi, coi các bảng sau là nền tảng đang tồn tại:

```text
persons
relationships
person_names
families
family_parents
family_children
migration_review
audit_logs
migration_log
feature_flags
persons_active
relationships_active
```

Nếu `READ_FAMILIES=true` đã bật và UI/test pass thì giữ. Nếu chưa bật, v2.3.4 vẫn có thể tiếp tục Event Model; chỉ cần graph adapter vẫn pass.

### 0.3. Thứ tự triển khai mới

```text
PHASE 5  — Event Date System song song
PHASE 6  — Date UI + Person Timeline + Lifespan display
PHASE 7  — Vietnamese FamilyTree Layout v2
PHASE 8  — Root-based statistics
PHASE 9  — Họ ngoại / dual paternal-maternal view
PHASE 10 — GEDCOM update theo Family/Event Model
PHASE 11 — GEDCOM staging import
PHASE 12 — Data Quality + Production hardening
PHASE 13 — Legacy cleanup rất cuối
```

---

## 1. Feature flags v2.3.4

Giữ các flag cũ và bổ sung flag UI mới.

### 1.1. Env flags

File: `lib/featureFlags.ts`

```ts
export const featureFlags = {
  gedcomExporterV233:   process.env.NEXT_PUBLIC_FF_GEDCOM_EXPORTER_V233 === 'true',
  readPersonNames:      process.env.NEXT_PUBLIC_FF_READ_PERSON_NAMES === 'true',
  readFamilies:         process.env.NEXT_PUBLIC_FF_READ_FAMILIES === 'true',
  writeFamilies:        process.env.NEXT_PUBLIC_FF_WRITE_FAMILIES === 'true',

  readEvents:           process.env.NEXT_PUBLIC_FF_READ_EVENTS === 'true',
  writeEvents:          process.env.NEXT_PUBLIC_FF_WRITE_EVENTS === 'true',

  vietnameseTreeLayout: process.env.NEXT_PUBLIC_FF_VIETNAMESE_TREE_LAYOUT === 'true',
  rootStats:            process.env.NEXT_PUBLIC_FF_ROOT_STATS === 'true',
  maternalPaternalView: process.env.NEXT_PUBLIC_FF_MATERNAL_PATERNAL_VIEW === 'true',

  gedcomImportStaging:  process.env.NEXT_PUBLIC_FF_GEDCOM_IMPORT_STAGING === 'true',
  allowLegacyCleanup:   process.env.NEXT_PUBLIC_FF_ALLOW_LEGACY_CLEANUP === 'true',
};
```

`.env.local` gợi ý ở đầu v2.3.4:

```env
NEXT_PUBLIC_FF_READ_EVENTS=false
NEXT_PUBLIC_FF_WRITE_EVENTS=false
NEXT_PUBLIC_FF_VIETNAMESE_TREE_LAYOUT=false
NEXT_PUBLIC_FF_ROOT_STATS=false
NEXT_PUBLIC_FF_MATERNAL_PATERNAL_VIEW=false
NEXT_PUBLIC_FF_GEDCOM_IMPORT_STAGING=false
NEXT_PUBLIC_FF_ALLOW_LEGACY_CLEANUP=false
```

### 1.2. DB flags bổ sung

```sql
INSERT INTO public.feature_flags (key, enabled, description)
VALUES
  ('read_events', false, 'Đọc ngày từ Event Model'),
  ('write_events', false, 'Ghi ngày vào Event Model'),
  ('vietnamese_tree_layout', false, 'Cây gia phả kiểu Việt Nam: con nối trực tiếp cha mẹ'),
  ('root_stats', false, 'Thống kê theo gốc gia phả'),
  ('maternal_paternal_view', false, 'Màn hình họ ngoại/hai nhánh cha mẹ')
ON CONFLICT (key) DO UPDATE
SET description = EXCLUDED.description;
```

### 1.3. Thứ tự bật flags từ đây

```text
1. WRITE_EVENTS=true                 Sau khi event schema + service ghi event pass.
2. READ_EVENTS=true                  Sau khi event migration thật + verify + UI fallback pass.
3. VIETNAMESE_TREE_LAYOUT=true       Sau khi layout regression test pass.
4. ROOT_STATS=true                   Sau khi root classifier/statistics pass.
5. MATERNAL_PATERNAL_VIEW=true       Sau khi dual-view pass.
6. GEDCOM_IMPORT_STAGING=true        Sau khi Family/Event export/import preview ổn.
7. ALLOW_LEGACY_CLEANUP=true         Chỉ ở phase cuối, sau nhiều backup ổn định.
```

---

# PHASE 5 — Event Date System song song

## 5.1. Mục tiêu

```text
- Chuyển birth/death date từ persons.* sang events/person_events song song.
- Không drop birth_year/birth_month/birth_day/death_year/death_month/death_day.
- Không xóa dữ liệu cũ.
- READ_EVENTS=false thì app vẫn chạy legacy.
- READ_EVENTS=true thì ưu tiên events, thiếu event thì fallback legacy.
- Người đã mất nhưng chưa có ngày mất vẫn hiển thị birth – ?, không tính tuổi hiện tại.
```

## 5.2. Schema Event Model

Tạo migration mới, ví dụ:

```text
docs/migrations/020_event_model_v234.sql
```

### 5.2.1. Enums

```sql
DO $$ BEGIN
  CREATE TYPE public.date_precision_enum AS ENUM (
    'day','month','year','decade','range','text','unknown'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.date_modifier_enum AS ENUM (
    'exact','about','before','after','between','from_to',
    'estimated','calculated','interpreted','phrase','unknown'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.calendar_type_enum AS ENUM (
    'gregorian','lunar','text','unknown'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.event_type_enum AS ENUM (
    'birth','death','marriage','divorce','burial','baptism','confirmation',
    'ordination','graduation','occupation','residence','migration','military',
    'award','retirement','custom'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.event_role_enum AS ENUM (
    'principal','child','husband','wife','witness','officiant','deceased','participant'
  );
EXCEPTION WHEN duplicate_object THEN null;
END $$;
```

### 5.2.2. Tables

```sql
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
```

### 5.2.3. Idempotency indexes

Để migration chạy lại không tạo trùng birth/death event:

```sql
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
```

### 5.2.4. Active view

```sql
CREATE OR REPLACE VIEW public.events_active AS
SELECT * FROM public.events WHERE deleted_at IS NULL;
```

## 5.3. RLS Event Model

```sql
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
```

Nếu dự án không có `public.is_admin()` hoặc `public.is_editor()`, dùng helper quyền hiện tại của app, không tự bỏ RLS.

## 5.4. Audit/version/hard-delete blocker cho events

Chỉ attach nếu các function `log_changes`, `increment_version`, `prevent_hard_delete` đã tồn tại từ phase trước.

```sql
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

## 5.5. Date utility

Tạo:

```text
utils/date-parser/normalizeDate.ts
utils/calendar/ageCalculation.ts
compat/date.compat.ts
services/event.service.ts
scripts/migrate-dates-to-events-safe.ts
scripts/verify-event-migration.ts
```

### 5.5.1. `normalizeDate.ts`

```ts
export type DatePrecision = 'day' | 'month' | 'year';

export function buildDateRange(
  year: number,
  month?: number | null,
  day?: number | null,
) {
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

### 5.5.2. `ageCalculation.ts`

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

## 5.6. Event migration safe

Script:

```text
scripts/migrate-dates-to-events-safe.ts
```

### 5.6.1. Nguyên tắc

```text
- DRY_RUN=true mặc định.
- Không xóa/sửa persons.birth_* hoặc persons.death_*.
- Không tạo death event nếu người đã mất nhưng không có death_year/death_month/death_day/lunar date.
- Nếu is_deceased=true nhưng không có ngày mất → để UI hiển thị birth – ?.
- Mỗi birth/death legacy chỉ tạo 1 event nhờ unique index.
- Insert person_events dùng ON CONFLICT DO NOTHING.
- Có report rõ: birth would create, death would create, skipped, invalid.
- Ghi migration_log.
```


### 5.6.1.A. Reset Event migration khi cần chạy lại

Nếu Event migration thật bị sai count và cần xóa lại các event legacy để chạy lại, không dùng `DELETE` trần vì `events` có thể đã gắn trigger chặn hard delete. Chỉ reset khi chắc chắn các event đó chưa được production write thủ công:

```sql
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
```

`SET LOCAL` tự hết hiệu lực sau transaction. Không đụng `families`, `family_parents`, `family_children`, hoặc `migration_review`.

### 5.6.2. Mapping

```text
persons.birth_year/month/day
  → events.type='birth'
  → person_events.role='principal'
  → legacy_source='persons.birth_*'
  → legacy_person_id=person.id

persons.death_year/month/day + death_lunar_*
  → events.type='death'
  → person_events.role='deceased'
  → legacy_source='persons.death_*'
  → legacy_person_id=person.id

families.start_year nếu có
  → events.type='marriage'
  → family_id=family.id
  → person_events role husband/wife theo family_parents.role
  → legacy_source='families.start_year'
```

Marriage event chỉ nên migrate nếu có `families.start_year` hoặc legacy marriage date thật. Nếu hiện chưa có ngày cưới, không tạo marriage event rỗng.

## 5.7. Event verification SQL

```sql
-- 1. Số người có năm sinh legacy
SELECT COUNT(*) AS legacy_birth_persons
FROM public.persons
WHERE deleted_at IS NULL AND birth_year IS NOT NULL;

-- 2. Số birth events đã tạo từ legacy
SELECT COUNT(*) AS birth_events_from_legacy
FROM public.events e
JOIN public.person_events pe ON pe.event_id = e.id
WHERE e.deleted_at IS NULL
  AND e.type = 'birth'
  AND e.legacy_source = 'persons.birth_*';

-- 3. Người đã mất có death_year legacy
SELECT COUNT(*) AS legacy_death_persons_with_year
FROM public.persons
WHERE deleted_at IS NULL
  AND is_deceased = true
  AND death_year IS NOT NULL;

-- 4. Death events đã tạo từ legacy
SELECT COUNT(*) AS death_events_from_legacy
FROM public.events e
JOIN public.person_events pe ON pe.event_id = e.id
WHERE e.deleted_at IS NULL
  AND e.type = 'death'
  AND e.legacy_source = 'persons.death_*';

-- 5. Event date lỗi
SELECT COUNT(*) AS invalid_event_dates
FROM public.events
WHERE deleted_at IS NULL
  AND start_date IS NOT NULL
  AND end_date IS NOT NULL
  AND end_date < start_date;

-- 6. Duplicate legacy event
SELECT legacy_person_id, type, legacy_source, COUNT(*)
FROM public.events
WHERE deleted_at IS NULL
  AND legacy_person_id IS NOT NULL
  AND legacy_source IS NOT NULL
GROUP BY legacy_person_id, type, legacy_source
HAVING COUNT(*) > 1;

-- 7. Event orphan không gắn person/family
SELECT COUNT(*) AS orphan_events
FROM public.events e
WHERE e.deleted_at IS NULL
  AND e.family_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.person_events pe WHERE pe.event_id = e.id);
```

## 5.8. Pass criteria Phase 5

```text
✅ Event schema tạo được.
✅ RLS không chặn admin/editor.
✅ DRY_RUN=true migration ra report đúng.
✅ DRY_RUN=false không tạo duplicate khi chạy lại.
✅ birth events count gần khớp persons.birth_year.
✅ death events count khớp người đã mất có death_year.
✅ death 03/2001 thành 2001-03-01 → 2001-03-31.
✅ Chỉ biết năm sinh hiển thị khoảng tuổi.
✅ Người đã mất không có ngày mất hiển thị 1945 – ?, không tính tuổi hiện tại.
✅ READ_EVENTS=false app vẫn chạy legacy.
✅ READ_EVENTS=true ưu tiên events, thiếu event fallback legacy.
```

---

# PHASE 6 — Date UI + Person Timeline + Lifespan display

## 6.1. Component cần tạo/sửa

```text
components/GenealogyDateDisplay.tsx
components/PersonLifespan.tsx
components/PersonTimeline.tsx
components/GenealogyDatePicker.tsx
compat/date.compat.ts
services/event.service.ts
components/MemberForm.tsx
components/FamilyTree.tsx
components/PersonDetail.tsx hoặc trang detail hiện tại
```

## 6.2. Quy tắc hiển thị ngày sinh/ngày mất

```text
Người còn sống có ngày sinh đủ:
Sinh: 12-03-1980 (46 tuổi)

Người còn sống chỉ có năm sinh:
Sinh: ~1980 (~45–46 tuổi)

Người đã mất có ngày sinh/ngày mất:
1945 – 2001 (mất lúc ~56 tuổi)

Người đã mất nhưng không có ngày mất:
1945 – ?

Không có ngày sinh:
Không hiển thị lifespan, hoặc hiển thị “Chưa rõ ngày sinh” trong detail.
```

## 6.3. Compat đọc ngày

`compat/date.compat.ts` phải có rule:

```text
Nếu READ_EVENTS=true:
  1. Query events/person_events.
  2. Nếu có birth/death event hợp lệ → dùng event.
  3. Nếu thiếu event → fallback persons.birth_*/death_*.

Nếu READ_EVENTS=false:
  Chỉ dùng persons.birth_*/death_*.
```

Không được để bật `READ_EVENTS=true` làm người thiếu event mất ngày sinh trên UI.

## 6.4. Write strategy

Giai đoạn đầu:

```text
WRITE_EVENTS=false:
- Form vẫn ghi legacy persons.birth_*/death_* như cũ.
- Event Model chỉ đọc/migrate.
```

Sau khi UI pass:

```text
WRITE_EVENTS=true:
- Khi sửa ngày sinh/ngày mất, ghi event qua event.service.
- Tạm thời vẫn dual-write legacy persons.* để fallback an toàn.
- Không drop legacy columns.
```

## 6.5. Test cần có

```text
tests/date/normalizeDate.test.ts
tests/date/ageCalculation.test.ts
tests/events/eventCompat.test.ts
```

Các case bắt buộc:

```text
□ 1980 → start 1980-01-01, end 1980-12-31, sort 1980-06-30, precision year.
□ 03/2001 → start 2001-03-01, end 2001-03-31, sort 2001-03-15, precision month.
□ 12/03/1980 → start=end=1980-03-12, precision day.
□ living exact birth tính tuổi hiện tại.
□ deceased exact birth/death tính tuổi mất.
□ deceased no death event hiển thị birth – ?.
□ READ_EVENTS=true nhưng missing event thì fallback legacy.
```

---

# PHASE 7 — Vietnamese FamilyTree Layout v2

## 7.1. Mục tiêu

Giải quyết yêu cầu cây gia phả Việt Nam:

```text
- Con nối trực tiếp với cha/mẹ, dù con đã có vợ/chồng.
- Không nối parent-child vào midpoint của cặp vợ chồng của người con.
- Vợ/chồng chỉ là spouse edge ngang.
- Dâu/rễ xác định theo root đang xem.
- Có filter ẩn/hiện dâu rễ.
- Có tùy chọn miền Nam: con trưởng hiển thị là con thứ 2/Anh Hai/Chị Hai.
```

## 7.2. Rule layout mới

```text
Person node là điểm neo chính.
Parent-child edge luôn nối vào person node của child.
Spouse edge chỉ nối ngang giữa hai person nodes.
Family center chỉ dùng để gom siblings hoặc vẽ nhánh con của một cặp, không thay thế child node.
Nếu child có spouse, parent edge vẫn nối vào child node, không nối vào midpoint child-spouse.
```

## 7.3. Data classifier theo root

Tạo:

```text
utils/tree/rootClassifier.ts
```

Output:

```ts
export type RootRelationClass =
  | 'root'
  | 'bloodline'
  | 'spouse_in_law'
  | 'maternal_branch'
  | 'paternal_branch'
  | 'unrelated_visible'
  | 'unknown';
```

Rule:

```text
- root là người gốc.
- bloodline là người nối được với root qua parent-child edges.
- spouse_in_law là spouse của bloodline nhưng không thuộc bloodline.
- paternal_branch là nhánh đi qua cha của root.
- maternal_branch là nhánh đi qua mẹ của root.
- Classification phụ thuộc root, không lưu cứng vào DB.
```

## 7.4. Filter UI

```text
□ Hiển thị dâu/rễ
□ Hiển thị họ ngoại
□ Hiển thị vợ/chồng không có con
□ Số đời trước
□ Số đời sau
□ Kiểu xưng thứ: Chuẩn / Miền Nam
```

## 7.5. Southern Vietnam birth-order display

Không đổi dữ liệu `sort_order`. Chỉ đổi label.

```ts
export type BirthOrderDisplayMode = 'standard' | 'southern_vietnam';

export function formatBirthOrderLabel(
  sortOrder: number | null | undefined,
  gender: 'male' | 'female' | 'other',
  mode: BirthOrderDisplayMode,
) {
  if (!sortOrder || sortOrder < 1) return '';

  if (mode === 'standard') {
    if (sortOrder === 1) return 'Con trưởng';
    return `Con thứ ${sortOrder}`;
  }

  const southernNumber = sortOrder + 1;
  const prefix = gender === 'female' ? 'Chị' : 'Anh';
  const names: Record<number, string> = {
    2: 'Hai',
    3: 'Ba',
    4: 'Tư',
    5: 'Năm',
    6: 'Sáu',
    7: 'Bảy',
    8: 'Tám',
    9: 'Chín',
    10: 'Mười',
  };

  return `${prefix} ${names[southernNumber] ?? southernNumber}`;
}
```

## 7.6. Pass criteria Phase 7

```text
✅ Child có vợ/chồng vẫn nhận line trực tiếp từ cha/mẹ vào node của child.
✅ Tắt dâu/rễ thì spouse ngoài huyết thống ẩn được.
✅ Đổi root thì dâu/rễ tính lại, không dùng is_in_law tuyệt đối.
✅ Birth order miền Nam chỉ đổi label, không đổi sort_order.
✅ Layout cũ vẫn fallback được khi flag off.
```

---

# PHASE 8 — Root-based statistics

## 8.1. Vấn đề cần giải quyết

Thống kê “dâu/rễ” toàn database là tương đối vì nếu có cả họ nội/họ ngoại thì dâu/rễ phụ thuộc root. Vì vậy v2.3.4 tách:

```text
Global statistics: thống kê toàn bộ dữ liệu.
Root-based statistics: thống kê theo gốc gia phả đang chọn.
```

## 8.2. Global statistics

```text
- Tổng số người active.
- Nam / nữ / khác / chưa rõ.
- Còn sống / đã mất / chưa rõ.
- Có gia đình / chưa có gia đình / chưa rõ.
- Có cha/mẹ trong hệ thống / chưa có cha/mẹ.
- Có con / chưa có con.
- Số families active.
- Số events active.
```

## 8.3. Root-based statistics

```text
- Người trong huyết thống của root.
- Dâu/rễ theo root.
- Họ nội theo root.
- Họ ngoại theo root.
- Nam/nữ trong nhánh root.
- Người có gia đình trong nhánh root.
- Người độc thân hoặc chưa có family trong nhánh root.
- Số đời trước/sau đang hiển thị.
```

## 8.4. Marital status rule

Không nên chỉ dựa vào gender hoặc is_in_law. Dùng Family Model:

```text
Có gia đình:
  person_id xuất hiện trong family_parents của một family active.

Có con:
  person_id là parent trong family_parents và family đó có family_children.

Độc thân/chưa có gia đình:
  không xuất hiện trong family_parents active.

Không rõ:
  thiếu dữ liệu hoặc record bị review.
```

## 8.5. Pass criteria Phase 8

```text
✅ Global stats không gọi ai là dâu/rễ tuyệt đối.
✅ Root stats ghi rõ “theo gốc đang chọn”.
✅ Đổi root thì số dâu/rễ thay đổi hợp lý.
✅ Nam/nữ/độc thân/có gia đình thống kê được không phụ thuộc root.
```

---

# PHASE 9 — Họ ngoại / Dual paternal-maternal view

## 9.1. Mục tiêu

Tạo màn hình tương tự logic FamilyGem:

```text
- Người gốc ở trung tâm.
- Một bên là nhánh cha.
- Một bên là nhánh mẹ.
- Mặc định 3 đời trước và 3 đời sau.
- Có thể đổi số đời.
- Không làm thay FamilyTree chính.
```

## 9.2. Component mới

```text
components/MaternalPaternalTree.tsx
components/DualAncestryPanel.tsx
utils/tree/buildDualAncestryGraph.ts
utils/tree/sideClassifier.ts
app/dashboard/dual-ancestry/page.tsx hoặc route tương ứng
```


### 9.2.A. `sideClassifier.ts`

`sideClassifier.ts` là module dùng chung cho Họ ngoại view và root-based statistics. Vai trò:

```text
- Xác định node thuộc nhánh cha, nhánh mẹ, cả hai, hay dâu/rễ.
- Kết quả phụ thuộc root đang chọn.
- Không lưu classification vào DB.
- Dùng parent-child edges từ Family Model, spouse edges từ family_parents.
```

Nếu implementation ban đầu đã đặt logic này trong `rootClassifier.ts`, vẫn nên tách ra file riêng để tránh bỏ sót khi làm `buildDualAncestryGraph.ts`.

## 9.3. Query graph

Input:

```ts
{
  rootPersonId: string;
  generationsUp: number;     // default 3
  generationsDown: number;   // default 3
  includeSpouses: boolean;
  includeInLaws: boolean;
}
```

Output:

```ts
{
  root: PersonNode;
  paternal: TreeSubgraph;
  maternal: TreeSubgraph;
  shared: TreeSubgraph;
  warnings: string[];
}
```

## 9.4. Layout rule

```text
Root ở giữa.
Cha/root paternal side ở trái hoặc trên-trái.
Mẹ/root maternal side ở phải hoặc trên-phải.
Con/cháu của root nằm dưới root hoặc giữa dưới.
Nếu một người xuất hiện ở cả hai nhánh do kết hôn nội tộc hoặc dữ liệu vòng lặp → đưa vào shared và cảnh báo.
```

## 9.5. Pass criteria Phase 9

```text
✅ Có root ở trung tâm.
✅ Nhánh cha/mẹ tách rõ.
✅ 3 đời trước/sau mặc định.
✅ Có thể ẩn dâu/rễ.
✅ Không làm hỏng FamilyTree chính.
✅ Nếu thiếu cha hoặc mẹ, view vẫn render phần còn lại.
```

---

# PHASE 10 — GEDCOM update theo Family/Event Model

## 10.1. Mục tiêu

Sau khi Family/Event ổn, GEDCOM exporter nên ưu tiên schema mới:

```text
READ_FAMILIES=true → export FAM từ families/family_parents/family_children.
READ_EVENTS=true → export BIRT/DEAT/MARR từ events/person_events/family_id.
Nếu thiếu dữ liệu mới → fallback legacy.
```

## 10.2. Export priority

```text
Person name:
  person_names primary → fallback persons.full_name.

Family:
  families active → fallback relationships marriage/child.

Birth/death:
  events birth/death → fallback persons.birth_*/death_*.

Lunar death:
  events lunar_* → fallback persons.death_lunar_*.
```

## 10.3. Warnings

Exporter phải cảnh báo:

```text
- Person có nhiều birth events active.
- Person có nhiều death events active.
- Family thiếu parent nhưng có child.
- Child thuộc nhiều family birth/adopted không rõ loại.
- Event date precision text/range không map chuẩn GEDCOM.
```

---

# PHASE 11 — GEDCOM staging import

Giữ nguyên nguyên tắc v2.3.3:

```text
- Upload GEDCOM chỉ ghi staging.
- Không ghi persons/families/events thật khi parse.
- Preview trước.
- User xác nhận mới commit.
- Commit dùng Approach A: app/service quản lý status, RPC chỉ commit data.
- Không dùng importData() legacy cho GEDCOM staging.
```

Bổ sung cho v2.3.4:

```text
- Parser DATE phải map vào Event Model.
- FAM phải map vào Family Model.
- NAME phải map vào person_names.
- _GIAPHA_LUNAR/_LUNAR phải map vào events lunar fields.
- SOUR/OBJE giữ staging nếu Media/Source chưa triển khai.
```

---

# PHASE 12 — Data Quality + Production hardening

## 12.1. Data Quality v2.3.4

Mở rộng `/dashboard/data-quality`:

```text
Family:
- family không có parent.
- family có child nhưng không có parent.
- child trong nhiều family biological không rõ.
- migration_review pending/resolved/skipped.

Event:
- birth event duplicate.
- death event duplicate.
- death trước birth.
- event orphan không person/family.
- event end_date < start_date.
- person is_deceased=true nhưng không có death event/date.

Tree/UI:
- soft-deleted person vẫn hiện.
- soft-deleted relationship vẫn hiện.
- spouse edge thiếu node.
- parent-child edge thiếu node.

Stats:
- root stats classifier warning.
- dual ancestry cycle warning.
```

## 12.2. Production checklist

```text
□ Backup tạo được.
□ Restore test OK.
□ bun run test pass.
□ bun run build pass.
□ Family Model vẫn pass sau Event Model.
□ Event migration verify pass.
□ READ_EVENTS=true không làm mất ngày sinh/ngày mất.
□ Vietnamese tree layout không làm sai parent-child line.
□ Root stats đúng với vài root test.
□ Dual ancestry view render được người thiếu cha/mẹ.
□ GEDCOM export vẫn pass font tiếng Việt.
□ Không cleanup legacy.
```

---

# PHASE 13 — Legacy cleanup rất cuối

Không làm trong v2.3.4 nếu app chưa chạy ổn qua nhiều vòng backup.

Điều kiện mới:

```text
✅ Family Model production ổn.
✅ Event Model production ổn.
✅ READ_FAMILIES=true ổn.
✅ READ_EVENTS=true ổn.
✅ WRITE_EVENTS dual-write ổn.
✅ GEDCOM exporter đọc schema mới ổn.
✅ Data Quality không có lỗi nghiêm trọng.
✅ Backup/restore đã test.
✅ Admin xác nhận cleanup.
✅ ALLOW_LEGACY_CLEANUP=true.
```

Chưa cleanup:

```text
persons.birth_year/month/day
persons.death_year/month/day
persons.death_lunar_*
persons.is_deceased
relationships
custom_events
```

Chỉ cleanup khi thật sự chắc chắn.

---

## File cần tạo/cập nhật trong v2.3.4

### Tạo mới

```text
docs/migrations/020_event_model_v234.sql
compat/date.compat.ts
services/event.service.ts
utils/date-parser/normalizeDate.ts
utils/calendar/ageCalculation.ts
scripts/migrate-dates-to-events-safe.ts
scripts/verify-event-migration.ts
components/GenealogyDateDisplay.tsx
components/PersonLifespan.tsx
components/PersonTimeline.tsx
components/GenealogyDatePicker.tsx
utils/tree/rootClassifier.ts
utils/tree/sideClassifier.ts
utils/tree/birthOrderDisplay.ts
utils/tree/buildDualAncestryGraph.ts
components/MaternalPaternalTree.tsx
components/DualAncestryPanel.tsx
tests/date/normalizeDate.test.ts
tests/date/ageCalculation.test.ts
tests/events/eventCompat.test.ts
tests/tree/rootClassifier.test.ts
tests/tree/birthOrderDisplay.test.ts
tests/tree/directParentChildLayout.test.ts
```

### Cập nhật

```text
lib/featureFlags.ts
components/FamilyTree.tsx
components/MemberForm.tsx
components/DataImportExport.tsx
components/PersonDetail.tsx hoặc trang detail hiện tại
utils/gedcom/exporter.ts
utils/gedcom/parser.ts
utils/graph/buildUnifiedGraph.ts
app/dashboard/data-quality/page.tsx
package.json nếu thêm script test mới
.env.local
```

---

## Checklist tổng v2.3.4

```text
□ Không rollback Family Model.
□ Backup mới trước Event Model.
□ Event schema tạo được.
□ Event RLS hoạt động.
□ Event migration dry-run pass.
□ Event migration thật pass.
□ Verify event counts pass.
□ Date tests pass.
□ Age display 3 nhánh pass.
□ READ_EVENTS=false fallback legacy pass.
□ READ_EVENTS=true ưu tiên event + fallback legacy pass.
□ UI ngày sinh/ngày mất/tuổi pass.
□ Vietnamese tree layout direct parent-child pass.
□ Dâu/rễ theo root pass.
□ Southern birth-order display pass.
□ Root stats pass.
□ Họ ngoại dual-view pass.
□ GEDCOM export theo Family/Event pass.
□ Data Quality v2.3.4 pass.
□ Chưa cleanup legacy.
```

---

## Kết luận v2.3.4

`v2.3.4-final` là roadmap tiếp tục đúng sau khi Family Model đã xong. Điểm quan trọng nhất là **không quay lại làm lại Family Model**, mà đóng băng nó làm baseline, rồi triển khai Event Model song song. Sau Event Model mới chuyển sang UI cây Việt Nam, thống kê theo root và họ ngoại.

Nếu làm đúng thứ tự, rủi ro chính chỉ nằm ở Event migration/UI date display, còn Family Model đã làm sẽ được giữ nguyên.

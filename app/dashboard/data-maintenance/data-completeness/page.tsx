import Link from "next/link";
import { getSupabase } from "@/utils/supabase/queries";

export const dynamic = "force-dynamic";

type PersonRow = {
  id: string;
  full_name: string | null;
  gender: string | null;
  birth_year: number | null;
  death_year: number | null;
  death_lunar_year: number | null;
  death_lunar_month: number | null;
  death_lunar_day: number | null;
  is_deceased: boolean | null;
  created_at: string | null;
  updated_at: string | null;
};

function isBlankName(name: string | null) {
  const value = (name ?? "").trim().toLowerCase();
  return !value || value === "unknown" || value === "chưa rõ tên";
}

function hasDeathAnniversary(person: PersonRow) {
  return Boolean(
    person.death_lunar_year ||
      person.death_lunar_month ||
      person.death_lunar_day,
  );
}

function genderLabel(gender: string | null) {
  if (gender === "male") return "Nam";
  if (gender === "female") return "Nữ";
  if (gender === "other") return "Khác";
  return "Chưa rõ";
}

export default async function DataCompletenessPage() {
  const supabase = await getSupabase();

  const { data, error } = await supabase
    .from("persons")
    .select(
      "id, full_name, gender, birth_year, death_year, death_lunar_year, death_lunar_month, death_lunar_day, is_deceased, created_at, updated_at",
    )
    .is("deleted_at", null)
    .order("full_name", { ascending: true })
    .limit(100000);

  const persons = ((data ?? []) as PersonRow[]);

  const blankNames = persons.filter((person) => isBlankName(person.full_name));
  const missingBirthYear = persons.filter((person) => !person.birth_year);
  const deceasedMissingDeathYear = persons.filter(
    (person) => person.is_deceased && !person.death_year,
  );
  const deceasedMissingDeathAnniversary = persons.filter(
    (person) => person.is_deceased && !hasDeathAnniversary(person),
  );
  const missingGender = persons.filter(
    (person) => !person.gender || !["male", "female", "other"].includes(person.gender),
  );

  const totalIssues =
    blankNames.length +
    missingBirthYear.length +
    deceasedMissingDeathYear.length +
    deceasedMissingDeathAnniversary.length +
    missingGender.length;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Link
          href="/dashboard/data-maintenance"
          className="text-sm font-medium text-amber-700 hover:text-amber-800"
        >
          ← Quay lại Data Maintenance
        </Link>

        <h1 className="mt-3 text-2xl font-bold text-stone-900">
          Data completeness
        </h1>

        <p className="mt-2 text-sm text-stone-600">
          Kiểm tra hồ sơ người thiếu dữ liệu cơ bản: tên, giới tính, năm sinh, năm mất và ngày giỗ.
        </p>
      </div>

      {error ? (
        <section className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Không tải được dữ liệu: {error.message}
        </section>
      ) : null}

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <StatCard label="Tổng lỗi" value={totalIssues} />
        <StatCard label="Tên trống/chưa rõ" value={blankNames.length} />
        <StatCard label="Thiếu năm sinh" value={missingBirthYear.length} />
        <StatCard label="Đã mất thiếu năm mất" value={deceasedMissingDeathYear.length} />
        <StatCard label="Đã mất thiếu ngày giỗ" value={deceasedMissingDeathAnniversary.length} />
        <StatCard label="Thiếu giới tính" value={missingGender.length} />
      </div>

      <div className="space-y-6">
        <PersonIssueSection
          title="Tên trống / Unknown / Chưa rõ tên"
          description="Nên sửa trước vì ảnh hưởng tìm kiếm, GEDCOM và hiển thị cây."
          persons={blankNames}
        />

        <PersonIssueSection
          title="Thiếu năm sinh"
          description="Năm sinh giúp sắp xếp thế hệ, tuổi và thứ tự hiển thị."
          persons={missingBirthYear}
        />

        <PersonIssueSection
          title="Đã mất nhưng thiếu năm mất"
          description="Các hồ sơ đã đánh dấu đã mất nên có năm mất nếu biết."
          persons={deceasedMissingDeathYear}
        />

        <PersonIssueSection
          title="Đã mất nhưng thiếu ngày giỗ"
          description="Ngày giỗ là dữ liệu dùng cho trang Events và nhắc hằng năm theo âm lịch."
          persons={deceasedMissingDeathAnniversary}
        />

        <PersonIssueSection
          title="Thiếu giới tính"
          description="Giới tính dùng cho quan hệ cha/mẹ, vợ/chồng, cây gia phả và thống kê."
          persons={missingGender}
        />
      </div>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="text-2xl font-bold text-stone-900">{value}</div>
      <div className="mt-1 text-sm text-stone-500">{label}</div>
    </div>
  );
}

function PersonIssueSection({
  title,
  description,
  persons,
}: {
  title: string;
  description: string;
  persons: PersonRow[];
}) {
  return (
    <section className="rounded-2xl border border-stone-200 bg-white shadow-sm">
      <div className="border-b border-stone-200 px-4 py-3">
        <h2 className="font-semibold text-stone-900">{title}</h2>
        <p className="mt-1 text-sm text-stone-500">{description}</p>
      </div>

      {persons.length === 0 ? (
        <p className="p-4 text-sm text-stone-500">Không có dữ liệu thiếu.</p>
      ) : (
        <div className="divide-y divide-stone-100">
          {persons.slice(0, 300).map((person) => (
            <div
              key={person.id}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <div>
                <div className="font-medium text-stone-900">
                  {person.full_name?.trim() || "Không rõ tên"}
                </div>

                <div className="text-xs text-stone-500">
                  Giới tính: {genderLabel(person.gender)} · Sinh:{" "}
                  {person.birth_year ?? "?"} · Mất: {person.death_year ?? "?"}
                  {person.is_deceased ? " · Đã mất" : ""}
                </div>

                {person.is_deceased ? (
                  <div className="mt-1 text-xs text-stone-500">
                    Ngày giỗ âm lịch:{" "}
                    {[
                      person.death_lunar_day ?? "?",
                      person.death_lunar_month ?? "?",
                      person.death_lunar_year ?? "?",
                    ].join("/")}
                  </div>
                ) : null}
              </div>

              <div className="flex shrink-0 items-center gap-3">
                <Link
                  href={`/dashboard/members/${person.id}`}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  Mở
                </Link>

                <Link
                  href={`/dashboard/members/${person.id}/edit`}
                  className="text-sm font-medium text-amber-700 hover:text-amber-800"
                >
                  Sửa
                </Link>
              </div>
            </div>
          ))}

          {persons.length > 300 ? (
            <p className="px-4 py-3 text-sm text-stone-500">
              Đang hiển thị 300 / {persons.length} dòng đầu tiên.
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}

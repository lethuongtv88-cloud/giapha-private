"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  createPersonSource,
  softDeletePersonSourceLink,
  type SourceType,
} from "@/app/actions/sources";
import { createClient } from "@/utils/supabase/client";

type SourceRow = {
  link_id: string;
  source_id: string;
  title: string;
  source_type: SourceType;
  author: string | null;
  repository: string | null;
  url: string | null;
  citation_text: string | null;
  note: string | null;
};

type PersonSourcesPanelProps = {
  personId: string;
};

const SOURCE_TYPES: Array<{ value: SourceType; label: string }> = [
  { value: "document", label: "Tài liệu" },
  { value: "photo", label: "Hình ảnh" },
  { value: "oral_history", label: "Lời kể" },
  { value: "book", label: "Sách" },
  { value: "website", label: "Website" },
  { value: "archive", label: "Lưu trữ" },
  { value: "other", label: "Khác" },
];

function sourceTypeLabel(value: SourceType) {
  return SOURCE_TYPES.find((item) => item.value === value)?.label ?? "Khác";
}

export function PersonSourcesPanel({ personId }: PersonSourcesPanelProps) {
  const supabase = useMemo(() => createClient(), []);
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const [title, setTitle] = useState("");
  const [sourceType, setSourceType] = useState<SourceType>("oral_history");
  const [author, setAuthor] = useState("");
  const [repository, setRepository] = useState("");
  const [url, setUrl] = useState("");
  const [citationText, setCitationText] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loadSources = async () => {
    setLoading(true);
    setError(null);

    const { data, error: loadError } = await supabase
      .from("person_source_links")
      .select(
        `
        id,
        citation_text,
        note,
        sources:source_id (
          id,
          title,
          source_type,
          author,
          repository,
          url,
          note
        )
      `,
      )
      .eq("person_id", personId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (loadError) {
      setError(loadError.message);
      setLoading(false);
      return;
    }

    const rows =
      data?.flatMap((row: any) => {
        const source = Array.isArray(row.sources) ? row.sources[0] : row.sources;
        if (!source) return [];

        return [
          {
            link_id: row.id,
            source_id: source.id,
            title: source.title,
            source_type: source.source_type,
            author: source.author,
            repository: source.repository,
            url: source.url,
            citation_text: row.citation_text,
            note: row.note ?? source.note,
          } satisfies SourceRow,
        ];
      }) ?? [];

    setSources(rows);
    setLoading(false);
  };

  useEffect(() => {
    void loadSources();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personId]);

  const handleAdd = () => {
    setError(null);

    startTransition(async () => {
      const result = await createPersonSource({
        personId,
        title,
        sourceType,
        author,
        repository,
        url,
        citationText,
        note,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setTitle("");
      setSourceType("oral_history");
      setAuthor("");
      setRepository("");
      setUrl("");
      setCitationText("");
      setNote("");

      await loadSources();
    });
  };

  const handleDelete = (linkId: string) => {
    if (!window.confirm("Xóa liên kết nguồn này khỏi người đang xem?")) return;

    startTransition(async () => {
      const result = await softDeletePersonSourceLink(linkId, personId);

      if (!result.ok) {
        setError(result.error);
        return;
      }

      await loadSources();
    });
  };

  return (
    <section className="rounded-xl border border-stone-200 bg-white p-4">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-stone-900">
          Nguồn thông tin
        </h3>
        <p className="mt-1 text-sm text-stone-500">
          Lưu nguồn xác minh cho thông tin của người này: lời kể, giấy tờ, hình
          ảnh, sách, website hoặc tài liệu lưu trữ.
        </p>
      </div>

      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="mb-5 grid gap-3 rounded-lg border border-stone-100 bg-stone-50 p-3">
        <div className="grid gap-2 md:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-stone-700">Tên nguồn</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ví dụ: Lời kể của Bà Tư"
              className="rounded-lg border border-stone-300 px-3 py-2"
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span className="font-medium text-stone-700">Loại nguồn</span>
            <select
              value={sourceType}
              onChange={(event) => setSourceType(event.target.value as SourceType)}
              className="rounded-lg border border-stone-300 px-3 py-2"
            >
              {SOURCE_TYPES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-stone-700">Người cung cấp / tác giả</span>
            <input
              value={author}
              onChange={(event) => setAuthor(event.target.value)}
              placeholder="Ví dụ: Ông Nguyễn Văn B"
              className="rounded-lg border border-stone-300 px-3 py-2"
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span className="font-medium text-stone-700">Nơi lưu / kho lưu trữ</span>
            <input
              value={repository}
              onChange={(event) => setRepository(event.target.value)}
              placeholder="Ví dụ: Gia đình, nhà thờ họ, lưu trữ tỉnh"
              className="rounded-lg border border-stone-300 px-3 py-2"
            />
          </label>
        </div>

        <label className="grid gap-1 text-sm">
          <span className="font-medium text-stone-700">URL</span>
          <input
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://..."
            className="rounded-lg border border-stone-300 px-3 py-2"
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span className="font-medium text-stone-700">Trích dẫn</span>
          <textarea
            value={citationText}
            onChange={(event) => setCitationText(event.target.value)}
            placeholder="Ví dụ: Bà Tư kể ngày 10/06/2026 tại Cà Mau..."
            rows={2}
            className="rounded-lg border border-stone-300 px-3 py-2"
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span className="font-medium text-stone-700">Ghi chú</span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={2}
            className="rounded-lg border border-stone-300 px-3 py-2"
          />
        </label>

        <div>
          <button
            type="button"
            onClick={handleAdd}
            disabled={isPending || !title.trim()}
            className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? "Đang lưu..." : "Thêm nguồn"}
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-stone-500">Đang tải nguồn...</p>
      ) : sources.length === 0 ? (
        <p className="text-sm text-stone-500">
          Chưa có nguồn thông tin nào cho người này.
        </p>
      ) : (
        <div className="space-y-3">
          {sources.map((source) => (
            <article
              key={source.link_id}
              className="rounded-lg border border-stone-200 p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium text-stone-900">{source.title}</div>
                  <div className="mt-1 text-xs text-stone-500">
                    {sourceTypeLabel(source.source_type)}
                    {source.author ? ` · ${source.author}` : ""}
                    {source.repository ? ` · ${source.repository}` : ""}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleDelete(source.link_id)}
                  className="text-xs font-medium text-red-600 hover:text-red-700"
                >
                  Xóa liên kết
                </button>
              </div>

              {source.citation_text ? (
                <p className="mt-2 text-sm text-stone-700">
                  {source.citation_text}
                </p>
              ) : null}

              {source.note ? (
                <p className="mt-2 text-sm text-stone-500">{source.note}</p>
              ) : null}

              {source.url ? (
                <a
                  href={source.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-sm text-blue-600 hover:underline"
                >
                  Mở liên kết
                </a>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

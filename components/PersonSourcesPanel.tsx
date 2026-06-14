"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  createPersonSource,
  linkExistingPersonSource,
  softDeletePersonSourceLink,
  updatePersonSourceLink,
  type SourceType,
} from "@/app/actions/sources";
import { createClient } from "@/utils/supabase/client";
import { Plus, Search, X } from "lucide-react";

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

type ExistingSourceRow = {
  id: string;
  title: string;
  source_type: SourceType;
  author: string | null;
  repository: string | null;
  url: string | null;
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

export default function PersonSourcesPanel({ personId }: PersonSourcesPanelProps) {
  const supabase = useMemo(() => createClient(), []);
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [existingSources, setExistingSources] = useState<ExistingSourceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingSource, setEditingSource] = useState<SourceRow | null>(null);
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [isPending, startTransition] = useTransition();

  const [title, setTitle] = useState("");
  const [sourceType, setSourceType] = useState<SourceType>("oral_history");
  const [author, setAuthor] = useState("");
  const [repository, setRepository] = useState("");
  const [url, setUrl] = useState("");
  const [citationText, setCitationText] = useState("");
  const [note, setNote] = useState("");

  const [sourceSearch, setSourceSearch] = useState("");
  const [selectedSourceId, setSelectedSourceId] = useState("");
  const [existingCitationText, setExistingCitationText] = useState("");
  const [existingNote, setExistingNote] = useState("");

  const [editTitle, setEditTitle] = useState("");
  const [editSourceType, setEditSourceType] = useState<SourceType>("oral_history");
  const [editAuthor, setEditAuthor] = useState("");
  const [editRepository, setEditRepository] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editSourceNote, setEditSourceNote] = useState("");
  const [editCitationText, setEditCitationText] = useState("");
  const [editLinkNote, setEditLinkNote] = useState("");

  const [error, setError] = useState<string | null>(null);

  const linkedSourceIds = useMemo(
    () => new Set(sources.map((source) => source.source_id)),
    [sources],
  );

  const filteredExistingSources = useMemo(() => {
    const q = sourceSearch.trim().toLowerCase();

    return existingSources
      .filter((source) => !linkedSourceIds.has(source.id))
      .filter((source) => {
        if (!q) return true;

        return [
          source.title,
          source.author,
          source.repository,
          source.url,
          source.note,
          source.source_type,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q);
      })
      .slice(0, 20);
  }, [existingSources, linkedSourceIds, sourceSearch]);

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

  const loadExistingSources = async () => {
    const { data, error: loadError } = await supabase
      .from("sources")
      .select("id, title, source_type, author, repository, url, note")
      .is("deleted_at", null)
      .order("title", { ascending: true })
      .limit(200);

    if (loadError) {
      setError(loadError.message);
      return;
    }

    setExistingSources((data ?? []) as ExistingSourceRow[]);
  };

  useEffect(() => {
    void loadSources();
    void loadExistingSources();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personId]);

  const resetNewForm = () => {
    setTitle("");
    setSourceType("oral_history");
    setAuthor("");
    setRepository("");
    setUrl("");
    setCitationText("");
    setNote("");
  };

  const resetExistingForm = () => {
    setSourceSearch("");
    setSelectedSourceId("");
    setExistingCitationText("");
    setExistingNote("");
  };

  const handleAddNew = () => {
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

      resetNewForm();
      setShowForm(false);
      await loadSources();
      await loadExistingSources();
    });
  };

  const handleLinkExisting = () => {
    setError(null);

    startTransition(async () => {
      const result = await linkExistingPersonSource({
        personId,
        sourceId: selectedSourceId,
        citationText: existingCitationText,
        note: existingNote,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      resetExistingForm();
      setShowForm(false);
      await loadSources();
    });
  };

  const startEdit = (source: SourceRow) => {
    setError(null);
    setShowForm(false);
    setEditingSource(source);
    setEditTitle(source.title ?? "");
    setEditSourceType(source.source_type ?? "other");
    setEditAuthor(source.author ?? "");
    setEditRepository(source.repository ?? "");
    setEditUrl(source.url ?? "");
    setEditSourceNote(source.note ?? "");
    setEditCitationText(source.citation_text ?? "");
    setEditLinkNote(source.note ?? "");
  };

  const cancelEdit = () => {
    setEditingSource(null);
    setEditTitle("");
    setEditSourceType("oral_history");
    setEditAuthor("");
    setEditRepository("");
    setEditUrl("");
    setEditSourceNote("");
    setEditCitationText("");
    setEditLinkNote("");
  };

  const handleUpdate = () => {
    if (!editingSource) return;

    setError(null);

    startTransition(async () => {
      const result = await updatePersonSourceLink({
        personId,
        linkId: editingSource.link_id,
        sourceId: editingSource.source_id,
        title: editTitle,
        sourceType: editSourceType,
        author: editAuthor,
        repository: editRepository,
        url: editUrl,
        sourceNote: editSourceNote,
        citationText: editCitationText,
        linkNote: editLinkNote,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      cancelEdit();
      await loadSources();
      await loadExistingSources();
    });
  };

  const handleDelete = (linkId: string) => {
    if (!window.confirm("Xóa liên kết nguồn này khỏi người này?")) return;

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
    <section className="rounded-2xl border border-stone-200 bg-white p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-stone-900">
            Nguồn thông tin
          </h3>
          <p className="mt-1 text-sm text-stone-500">
            Lưu giấy tờ, hình ảnh, lời kể hoặc tài liệu xác minh cho người này.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setError(null);
            setEditingSource(null);
            setShowForm((value) => !value);
          }}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800 transition hover:bg-amber-100"
        >
          {showForm ? <X className="size-4" /> : <Plus className="size-4" />}
          {showForm ? "Đóng" : "Thêm nguồn"}
        </button>
      </div>

      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {editingSource ? (
        <div className="mb-5 grid gap-3 rounded-xl border border-blue-100 bg-blue-50/60 p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold text-stone-900">Sửa nguồn</h4>
              <p className="mt-1 text-xs text-stone-500">
                Thông tin nguồn là dùng chung; trích dẫn và ghi chú riêng chỉ áp dụng cho người này.
              </p>
            </div>
            <button
              type="button"
              onClick={cancelEdit}
              className="rounded-full p-2 text-stone-500 transition hover:bg-white hover:text-stone-900"
              title="Đóng"
            >
              <X className="size-4" />
            </button>
          </div>

          <label className="grid gap-1 text-sm">
            <span className="font-medium text-stone-700">Tên nguồn</span>
            <input
              value={editTitle}
              onChange={(event) => setEditTitle(event.target.value)}
              className="w-full rounded-lg border border-stone-300 px-3 py-2"
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span className="font-medium text-stone-700">Loại nguồn</span>
            <select
              value={editSourceType}
              onChange={(event) => setEditSourceType(event.target.value as SourceType)}
              className="w-full rounded-lg border border-stone-300 px-3 py-2"
            >
              {SOURCE_TYPES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-sm">
            <span className="font-medium text-stone-700">Người cung cấp / tác giả</span>
            <input
              value={editAuthor}
              onChange={(event) => setEditAuthor(event.target.value)}
              className="w-full rounded-lg border border-stone-300 px-3 py-2"
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span className="font-medium text-stone-700">Nơi lưu / kho lưu trữ</span>
            <input
              value={editRepository}
              onChange={(event) => setEditRepository(event.target.value)}
              className="w-full rounded-lg border border-stone-300 px-3 py-2"
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span className="font-medium text-stone-700">URL</span>
            <input
              value={editUrl}
              onChange={(event) => setEditUrl(event.target.value)}
              className="w-full rounded-lg border border-stone-300 px-3 py-2"
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span className="font-medium text-stone-700">Ghi chú nguồn chung</span>
            <textarea
              value={editSourceNote}
              onChange={(event) => setEditSourceNote(event.target.value)}
              rows={2}
              className="w-full rounded-lg border border-stone-300 px-3 py-2"
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span className="font-medium text-stone-700">Trích dẫn riêng cho người này</span>
            <textarea
              value={editCitationText}
              onChange={(event) => setEditCitationText(event.target.value)}
              rows={2}
              className="w-full rounded-lg border border-stone-300 px-3 py-2"
            />
          </label>

          <label className="grid gap-1 text-sm">
            <span className="font-medium text-stone-700">Ghi chú riêng cho người này</span>
            <textarea
              value={editLinkNote}
              onChange={(event) => setEditLinkNote(event.target.value)}
              rows={2}
              className="w-full rounded-lg border border-stone-300 px-3 py-2"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleUpdate}
              disabled={isPending || !editTitle.trim()}
              className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? "Đang lưu..." : "Lưu thay đổi"}
            </button>

            <button
              type="button"
              onClick={cancelEdit}
              className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
            >
              Hủy
            </button>
          </div>
        </div>
      ) : null}

      {showForm ? (
        <div className="mb-5 rounded-xl border border-amber-100 bg-amber-50/60 p-3">
          <div className="mb-4 grid grid-cols-2 gap-2 rounded-lg bg-white p-1">
            <button
              type="button"
              onClick={() => setMode("new")}
              className={`rounded-md px-3 py-2 text-sm font-medium ${
                mode === "new"
                  ? "bg-stone-900 text-white"
                  : "text-stone-600 hover:bg-stone-50"
              }`}
            >
              Tạo nguồn mới
            </button>

            <button
              type="button"
              onClick={() => setMode("existing")}
              className={`rounded-md px-3 py-2 text-sm font-medium ${
                mode === "existing"
                  ? "bg-stone-900 text-white"
                  : "text-stone-600 hover:bg-stone-50"
              }`}
            >
              Chọn nguồn đã có
            </button>
          </div>

          {mode === "new" ? (
            <div className="grid gap-3">
              <label className="grid gap-1 text-sm">
                <span className="font-medium text-stone-700">Tên nguồn</span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Ví dụ: Gia phả giấy, lời kể ông Bảy..."
                  className="w-full rounded-lg border border-stone-300 px-3 py-2"
                />
              </label>

              <label className="grid gap-1 text-sm">
                <span className="font-medium text-stone-700">Loại nguồn</span>
                <select
                  value={sourceType}
                  onChange={(event) => setSourceType(event.target.value as SourceType)}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2"
                >
                  {SOURCE_TYPES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1 text-sm">
                <span className="font-medium text-stone-700">Người cung cấp / tác giả</span>
                <input
                  value={author}
                  onChange={(event) => setAuthor(event.target.value)}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2"
                />
              </label>

              <label className="grid gap-1 text-sm">
                <span className="font-medium text-stone-700">Nơi lưu / kho lưu trữ</span>
                <input
                  value={repository}
                  onChange={(event) => setRepository(event.target.value)}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2"
                />
              </label>

              <label className="grid gap-1 text-sm">
                <span className="font-medium text-stone-700">URL</span>
                <input
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-lg border border-stone-300 px-3 py-2"
                />
              </label>

              <label className="grid gap-1 text-sm">
                <span className="font-medium text-stone-700">Trích dẫn</span>
                <textarea
                  value={citationText}
                  onChange={(event) => setCitationText(event.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2"
                />
              </label>

              <label className="grid gap-1 text-sm">
                <span className="font-medium text-stone-700">Ghi chú</span>
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2"
                />
              </label>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleAddNew}
                  disabled={isPending || !title.trim()}
                  className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isPending ? "Đang lưu..." : "Lưu nguồn mới"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    resetNewForm();
                    setShowForm(false);
                  }}
                  className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
                >
                  Hủy
                </button>
              </div>
            </div>
          ) : (
            <div className="grid gap-3">
              <label className="grid gap-1 text-sm">
                <span className="font-medium text-stone-700">Tìm nguồn đã có</span>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-stone-400" />
                  <input
                    value={sourceSearch}
                    onChange={(event) => setSourceSearch(event.target.value)}
                    placeholder="Tìm theo tên, tác giả, nơi lưu..."
                    className="w-full rounded-lg border border-stone-300 py-2 pl-9 pr-3"
                  />
                </div>
              </label>

              <div className="max-h-56 overflow-y-auto rounded-lg border border-stone-200 bg-white">
                {filteredExistingSources.length === 0 ? (
                  <p className="p-3 text-sm text-stone-500">
                    Không có nguồn phù hợp hoặc nguồn đã được gắn.
                  </p>
                ) : (
                  filteredExistingSources.map((source) => (
                    <button
                      key={source.id}
                      type="button"
                      onClick={() => setSelectedSourceId(source.id)}
                      className={`block w-full border-b border-stone-100 p-3 text-left last:border-b-0 ${
                        selectedSourceId === source.id
                          ? "bg-amber-50"
                          : "bg-white hover:bg-stone-50"
                      }`}
                    >
                      <div className="text-sm font-medium text-stone-900">
                        {source.title}
                      </div>
                      <div className="mt-1 text-xs text-stone-500">
                        {sourceTypeLabel(source.source_type)}
                        {source.author ? ` · ${source.author}` : ""}
                        {source.repository ? ` · ${source.repository}` : ""}
                      </div>
                    </button>
                  ))
                )}
              </div>

              <label className="grid gap-1 text-sm">
                <span className="font-medium text-stone-700">Trích dẫn riêng cho người này</span>
                <textarea
                  value={existingCitationText}
                  onChange={(event) => setExistingCitationText(event.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2"
                />
              </label>

              <label className="grid gap-1 text-sm">
                <span className="font-medium text-stone-700">Ghi chú riêng cho người này</span>
                <textarea
                  value={existingNote}
                  onChange={(event) => setExistingNote(event.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2"
                />
              </label>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleLinkExisting}
                  disabled={isPending || !selectedSourceId}
                  className="rounded-lg bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isPending ? "Đang lưu..." : "Gắn nguồn đã có"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    resetExistingForm();
                    setShowForm(false);
                  }}
                  className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
                >
                  Hủy
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}

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
              className="rounded-lg border border-stone-200 bg-stone-50 p-3"
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

                <div className="flex shrink-0 items-center gap-3">
                  <button
                    type="button"
                    onClick={() => startEdit(source)}
                    className="text-xs font-medium text-blue-600 hover:text-blue-700"
                  >
                    Sửa
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDelete(source.link_id)}
                    className="text-xs font-medium text-red-600 hover:text-red-700"
                  >
                    Xóa liên kết
                  </button>
                </div>
              </div>

              {source.citation_text ? (
                <p className="mt-2 text-sm text-stone-700">{source.citation_text}</p>
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

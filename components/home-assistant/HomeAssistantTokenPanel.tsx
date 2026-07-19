"use client";

import {
  createHomeAssistantToken,
  listHomeAssistantTokens,
  revokeHomeAssistantToken,
  type HomeAssistantTokenSummary,
} from "@/app/actions/home-assistant-tokens";
import { AlertTriangle, CheckCircle2, Copy, KeyRound, Loader2, PlugZap, Trash2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

function formatDate(value: string | null) {
  if (!value) return "Chưa dùng";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("vi-VN");
}

export default function HomeAssistantTokenPanel() {
  const [tokens, setTokens] = useState<HomeAssistantTokenSummary[]>([]);
  const [plainToken, setPlainToken] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadTokens = () => {
    startTransition(async () => {
      const result = await listHomeAssistantTokens();
      if (result.ok) {
        setTokens(result.tokens);
        setError(null);
      } else {
        setError(result.error);
      }
    });
  };

  useEffect(() => {
    loadTokens();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = (formData: FormData) => {
    setPlainToken(null);
    setMessage(null);
    setError(null);

    startTransition(async () => {
      const result = await createHomeAssistantToken(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }

      setPlainToken(result.token);
      setMessage("Đã tạo token. Hãy copy ngay vì token chỉ hiển thị một lần.");
      const refreshed = await listHomeAssistantTokens();
      if (refreshed.ok) setTokens(refreshed.tokens);
    });
  };

  const handleRevoke = (tokenId: string) => {
    if (!window.confirm("Thu hồi token Home Assistant này? Home Assistant sẽ không gọi API được bằng token này nữa.")) {
      return;
    }

    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await revokeHomeAssistantToken(tokenId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage("Đã thu hồi token Home Assistant.");
      const refreshed = await listHomeAssistantTokens();
      if (refreshed.ok) setTokens(refreshed.tokens);
    });
  };

  const copyToken = async () => {
    if (!plainToken) return;
    try {
      await navigator.clipboard.writeText(plainToken);
      setMessage("Đã copy token vào clipboard.");
    } catch {
      setError("Không copy được tự động. Hãy bôi đen token và copy thủ công.");
    }
  };

  return (
    <div className="rounded-2xl border border-stone-200 bg-white/90 p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-emerald-50 p-2 text-emerald-600">
            <PlugZap className="size-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-stone-900">Home Assistant API</h2>
            <p className="mt-1 text-sm leading-6 text-stone-500">
              Tạo token riêng cho Home Assistant để lấy sự kiện sắp tới. Token admin sẽ thấy toàn bộ sự kiện;
              token member/editor chỉ thấy sự kiện trong phạm vi được phép xem.
            </p>
          </div>
        </div>
      </div>

      <form action={handleCreate} className="mt-5 flex flex-col gap-3 sm:flex-row">
        <input
          name="name"
          className="min-w-0 flex-1 rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          placeholder="Tên token, ví dụ: HA nhà chính"
          defaultValue="Home Assistant"
        />
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
        >
          {isPending ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
          Tạo token
        </button>
      </form>

      {plainToken ? (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-bold text-emerald-900">Token mới, chỉ hiển thị một lần</p>
              <code className="mt-2 block overflow-x-auto rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs text-emerald-800">
                {plainToken}
              </code>
            </div>
            <button
              type="button"
              onClick={copyToken}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-50"
            >
              <Copy className="size-3.5" />
              Copy
            </button>
          </div>
        </div>
      ) : null}

      {message ? (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
          <CheckCircle2 className="size-4" />
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          <AlertTriangle className="size-4" />
          {error}
        </div>
      ) : null}

      <div className="mt-5 overflow-hidden rounded-2xl border border-stone-200">
        <div className="grid grid-cols-12 bg-stone-50 px-4 py-2 text-xs font-bold uppercase tracking-wide text-stone-500">
          <div className="col-span-5">Token</div>
          <div className="col-span-3">Lần dùng cuối</div>
          <div className="col-span-2">Trạng thái</div>
          <div className="col-span-2 text-right">Thao tác</div>
        </div>
        {tokens.length === 0 ? (
          <div className="px-4 py-5 text-sm text-stone-500">Chưa có token Home Assistant.</div>
        ) : (
          tokens.map((token) => (
            <div key={token.id} className="grid grid-cols-12 items-center border-t border-stone-100 px-4 py-3 text-sm">
              <div className="col-span-5 min-w-0">
                <p className="truncate font-semibold text-stone-800">{token.name}</p>
                <p className="mt-0.5 font-mono text-xs text-stone-500">{token.token_prefix}</p>
              </div>
              <div className="col-span-3 text-xs text-stone-500">{formatDate(token.last_used_at)}</div>
              <div className="col-span-2">
                <span className={`rounded-full px-2 py-1 text-xs font-semibold ${token.is_active && !token.revoked_at ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-500"}`}>
                  {token.is_active && !token.revoked_at ? "Đang hoạt động" : "Đã thu hồi"}
                </span>
              </div>
              <div className="col-span-2 text-right">
                {token.is_active && !token.revoked_at ? (
                  <button
                    type="button"
                    onClick={() => handleRevoke(token.id)}
                    disabled={isPending}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    <Trash2 className="size-3.5" />
                    Thu hồi
                  </button>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-5 rounded-2xl border border-sky-100 bg-sky-50 p-4 text-xs leading-6 text-sky-900">
        <p className="font-bold">Home Assistant REST sensor mẫu</p>
        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-xl bg-white p-3 text-[11px] text-sky-900">
{`rest:
  - resource: "https://YOUR_DOMAIN/api/home-assistant/events/upcoming?days=30"
    method: GET
    headers:
      Authorization: "Bearer YOUR_TOKEN"
    scan_interval: 3600
    sensor:
      - name: "Gia phả sự kiện hôm nay"
        value_template: "{{ value_json.summary.today }}"
        json_attributes:
          - today
          - next7Days
          - next30Days
          - events`}
        </pre>
      </div>
    </div>
  );
}

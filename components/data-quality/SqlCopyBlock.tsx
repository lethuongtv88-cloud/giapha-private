"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

/**
 * Khối hiển thị SQL repair kèm nút "Copy" (dùng navigator.clipboard).
 * Đây là Client Component vì cần state cho hiệu ứng "Đã copy!" - trang
 * cha (Server Component) vẫn fetch dữ liệu bình thường, chỉ phần này chạy
 * ở client.
 */
export function SqlCopyBlock({ title, sql }: { title: string; sql: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(sql);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Không thể copy vào clipboard:", err);
    }
  };

  return (
    <details className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
      <summary className="cursor-pointer text-sm font-bold text-stone-800">
        {title}
      </summary>
      <div className="relative mt-3">
        <button
          type="button"
          onClick={handleCopy}
          className={`absolute right-2 top-2 z-10 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold shadow-sm transition-colors ${
            copied
              ? "bg-emerald-600 text-white"
              : "bg-stone-800 text-stone-100 hover:bg-stone-700"
          }`}
        >
          {copied ? (
            <>
              <Check className="size-3.5" />
              Đã copy
            </>
          ) : (
            <>
              <Copy className="size-3.5" />
              Copy
            </>
          )}
        </button>
        <pre className="max-h-80 overflow-auto rounded-xl bg-stone-950 p-4 pr-24 text-xs leading-relaxed text-stone-100">
          <code>{sql}</code>
        </pre>
      </div>
    </details>
  );
}

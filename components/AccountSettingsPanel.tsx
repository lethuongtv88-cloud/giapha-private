"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Database, KeyRound, RotateCcw, Save } from "lucide-react";
import type { Person } from "@/types";
import PersonSelector from "@/components/PersonSelector";
import { createClient } from "@/utils/supabase/client";
import { useUser } from "@/components/UserProvider";
import {
  ROOT_PREFERENCE_KINDS,
  createEmptyRootPreferences,
  getRootPreferenceAccountKey,
  hydrateRootPreferencesFromDb,
  readAllRootPreferences,
  writeAllRootPreferences,
  writeAllRootPreferencesToDb,
  type RootPreferenceKind,
  type RootPreferences,
} from "@/utils/preferences/rootPreferences";

type AccountSettingsPanelProps = {
  persons: Person[];
};

function getDisplayName(person: Person): string {
  return person.full_name || person.id;
}

export default function AccountSettingsPanel({ persons }: AccountSettingsPanelProps) {
  const { user } = useUser();
  const accountKey = getRootPreferenceAccountKey({
    userId: user?.id,
    email: user?.email,
  });

  const sortedPersons = useMemo(() => {
    return [...persons].sort((a, b) =>
      getDisplayName(a).localeCompare(getDisplayName(b), "vi"),
    );
  }, [persons]);

  const validPersonIds = useMemo(() => {
    return new Set(sortedPersons.map((person) => person.id));
  }, [sortedPersons]);

  const [preferences, setPreferences] = useState<RootPreferences>(() =>
    createEmptyRootPreferences(),
  );
  const [loaded, setLoaded] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [saveWarning, setSaveWarning] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [linkedPersonId, setLinkedPersonId] = useState<string | null>(null);
  const [linkedPersonLoaded, setLinkedPersonLoaded] = useState(false);

  useEffect(() => {
    let ignore = false;

    async function loadPreferences() {
      setLoaded(false);

      const local = readAllRootPreferences(accountKey);
      const merged = user?.id
        ? await hydrateRootPreferencesFromDb({ userId: user.id, email: user.email })
        : local;

      if (ignore) return;

      const normalized: RootPreferences = createEmptyRootPreferences();
      for (const item of ROOT_PREFERENCE_KINDS) {
        const value = merged[item.kind];
        normalized[item.kind] = value && validPersonIds.has(value) ? value : null;
      }

      setPreferences(normalized);
      setLoaded(true);
    }

    loadPreferences();

    return () => {
      ignore = true;
    };
  }, [accountKey, user?.id, user?.email, validPersonIds]);

  useEffect(() => {
    let ignore = false;

    async function loadLinkedPerson() {
      setLinkedPersonLoaded(false);

      if (!user?.id) {
        setLinkedPersonId(null);
        setLinkedPersonLoaded(true);
        return;
      }

      const supabase = createClient();
      const { data, error } = await supabase
        .from("profiles")
        .select("person_id")
        .eq("id", user.id)
        .maybeSingle();

      if (ignore) return;

      if (error) {
        console.error("Không tải được người gắn với tài khoản:", error);
        setLinkedPersonId(null);
      } else {
        setLinkedPersonId(data?.person_id ?? null);
      }

      setLinkedPersonLoaded(true);
    }

    loadLinkedPerson();

    return () => {
      ignore = true;
    };
  }, [user?.id]);

  const setPreference = (kind: RootPreferenceKind, personId: string | null) => {
    setPreferences((current) => ({
      ...current,
      [kind]: personId,
    }));
    setSavedMessage(null);
    setSaveWarning(null);
  };

  const savePreferences = async () => {
    writeAllRootPreferences(accountKey, preferences);

    const dbResult = await writeAllRootPreferencesToDb(user?.id, preferences);
    if (dbResult.ok) {
      setSavedMessage("Đã lưu cài đặt gốc mặc định vào tài khoản của bạn.");
      setSaveWarning(null);
    } else {
      setSavedMessage("Đã lưu tạm trên trình duyệt hiện tại.");
      setSaveWarning(
        dbResult.error
          ? `Chưa lưu được vào database: ${dbResult.error}`
          : "Chưa lưu được vào database.",
      );
    }

    window.setTimeout(() => {
      setSavedMessage(null);
      setSaveWarning(null);
    }, 6000);
  };

  const changePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordMessage(null);
    setPasswordError(null);

    const formData = new FormData(event.currentTarget);
    const password = formData.get("password")?.toString() ?? "";
    const confirmPassword = formData.get("confirm_password")?.toString() ?? "";

    if (password.length < 6) {
      setPasswordError("Mật khẩu mới phải có ít nhất 6 ký tự.");
      return;
    }

    if (password !== confirmPassword) {
      setPasswordError("Mật khẩu nhập lại không khớp.");
      return;
    }

    setIsChangingPassword(true);

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        setPasswordError(error.message);
        return;
      }

      event.currentTarget.reset();
      setPasswordMessage("Đã cập nhật mật khẩu của bạn.");
      window.setTimeout(() => {
        setPasswordMessage(null);
        setPasswordError(null);
      }, 6000);
    } catch (err: unknown) {
      setPasswordError(
        err instanceof Error ? err.message : "Không thể cập nhật mật khẩu.",
      );
    } finally {
      setIsChangingPassword(false);
    }
  };

  const resetPreferences = async () => {
    const empty = createEmptyRootPreferences();
    setPreferences(empty);
    writeAllRootPreferences(accountKey, empty);

    const dbResult = await writeAllRootPreferencesToDb(user?.id, empty);
    if (dbResult.ok) {
      setSavedMessage("Đã xoá các gốc mặc định trong tài khoản của bạn.");
      setSaveWarning(null);
    } else {
      setSavedMessage("Đã xoá cài đặt tạm trên trình duyệt hiện tại.");
      setSaveWarning(
        dbResult.error
          ? `Chưa xoá được trong database: ${dbResult.error}`
          : "Chưa xoá được trong database.",
      );
    }

    window.setTimeout(() => {
      setSavedMessage(null);
      setSaveWarning(null);
    }, 6000);
  };

  if (persons.length === 0) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-6 text-sm text-stone-500">
        Chưa có dữ liệu thành viên để thiết lập người gốc mặc định.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-amber-100 bg-amber-50/80 p-4 text-sm text-amber-900">
        <p className="font-semibold">Cài đặt này lưu theo tài khoản.</p>
        <p className="mt-1 text-amber-800/80">
          Admin có thể chọn gốc sơ đồ mặc định khi tạo người dùng. Sau khi đăng nhập,
          mỗi thành viên có thể tự đổi gốc mặc định của mình tại đây. Nếu database chưa sẵn sàng,
          hệ thống sẽ lưu tạm trên trình duyệt.
        </p>
      </div>

      <div className="rounded-2xl border border-sky-100 bg-sky-50/80 p-4 text-sm text-sky-900">
        <p className="font-semibold">Người trong gia phả gắn với tài khoản</p>
        <p className="mt-1 text-sky-800/80">
          {linkedPersonLoaded
            ? linkedPersonId
              ? `Tài khoản của bạn đang được gắn với: ${
                  sortedPersons.find((person) => person.id === linkedPersonId)?.full_name ??
                  linkedPersonId
                }`
              : "Tài khoản của bạn chưa được quản trị viên gắn với người trong gia phả."
            : "Đang tải thông tin người được gắn với tài khoản..."}
        </p>
        <p className="mt-1 text-xs text-sky-700/80">
          Chỉ quản trị viên được thay đổi mục này vì đây là khóa phân quyền dữ liệu.
        </p>
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white/90 p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-stone-900">Người gốc mặc định</h2>
            <p className="mt-1 text-sm text-stone-500">
              Chọn sẵn người gốc cho từng nhóm màn để thành viên không phải chọn lại mỗi lần xem.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={resetPreferences}
              className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-600 hover:bg-stone-50"
            >
              <RotateCcw className="size-4" />
              Xoá cài đặt
            </button>
            <button
              type="button"
              onClick={savePreferences}
              disabled={!loaded}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 disabled:opacity-50"
            >
              <Save className="size-4" />
              Lưu cài đặt
            </button>
          </div>
        </div>

        {savedMessage ? (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
            <CheckCircle2 className="size-4" />
            {savedMessage}
          </div>
        ) : null}

        {saveWarning ? (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">
            <AlertTriangle className="size-4" />
            {saveWarning}
          </div>
        ) : null}

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {ROOT_PREFERENCE_KINDS.map((item) => (
            <div
              key={item.kind}
              className="rounded-2xl border border-stone-200 bg-stone-50/60 p-4"
            >
              <PersonSelector
                persons={sortedPersons}
                selectedId={preferences[item.kind]}
                onSelect={(id) => setPreference(item.kind, id)}
                label={item.label}
                placeholder="Chưa chọn người gốc"
                className="w-full"
              />
              <p className="mt-2 text-xs leading-relaxed text-stone-500">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white/90 p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-stone-100 p-2 text-stone-600">
            <KeyRound className="size-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-stone-900">Đổi mật khẩu</h2>
            <p className="mt-1 text-sm text-stone-500">
              Thành viên có thể tự đổi mật khẩu đăng nhập của mình tại đây.
            </p>
          </div>
        </div>

        <form onSubmit={changePassword} className="mt-5 grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">
              Mật khẩu mới
            </label>
            <input
              type="password"
              name="password"
              required
              minLength={6}
              className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 outline-none transition-colors focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              placeholder="Ít nhất 6 ký tự"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-stone-700">
              Nhập lại mật khẩu mới
            </label>
            <input
              type="password"
              name="confirm_password"
              required
              minLength={6}
              className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm text-stone-900 outline-none transition-colors focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            />
          </div>

          <div className="md:col-span-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              {passwordMessage ? (
                <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
                  {passwordMessage}
                </p>
              ) : null}
              {passwordError ? (
                <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
                  {passwordError}
                </p>
              ) : null}
            </div>

            <button
              type="submit"
              disabled={isChangingPassword}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-stone-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-stone-900 disabled:opacity-50"
            >
              <KeyRound className="size-4" />
              {isChangingPassword ? "Đang cập nhật..." : "Cập nhật mật khẩu"}
            </button>
          </div>
        </form>
      </div>

      <div className="rounded-2xl border border-sky-100 bg-sky-50/80 p-4 text-sm text-sky-900">
        <div className="flex gap-3">
          <Database className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-semibold">Lưu ý khi dùng nhiều thiết bị</p>
            <p className="mt-1 text-sky-800/80">
              Sau khi chạy migration <code>user_preferences</code>, cài đặt sẽ đồng bộ theo tài khoản.
              Trước đó, app vẫn fallback an toàn sang localStorage trên từng trình duyệt.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

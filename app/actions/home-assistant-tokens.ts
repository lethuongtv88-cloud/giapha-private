"use server";

import { recordAuditLog } from "@/services/audit/auditLog.service";
import { getProfile, getSupabase, getUser } from "@/utils/supabase/queries";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
import { revalidatePath } from "next/cache";

export type HomeAssistantTokenSummary = {
  id: string;
  name: string;
  token_prefix: string;
  is_active: boolean;
  last_used_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_ROLE_SECRET;

  if (!url || !serviceRoleKey) return null;

  return createSupabaseClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

function createPlainToken() {
  return `gha_${crypto.randomBytes(32).toString("base64url")}`;
}

async function getWritableClient() {
  return getServiceClient() ?? (await getSupabase());
}

export async function listHomeAssistantTokens(): Promise<{
  ok: true;
  tokens: HomeAssistantTokenSummary[];
} | { ok: false; error: string }> {
  const user = await getUser();
  if (!user) return { ok: false, error: "Bạn chưa đăng nhập." };

  const supabase = await getWritableClient();
  const { data, error } = await supabase
    .from("home_assistant_tokens")
    .select("id, name, token_prefix, is_active, last_used_at, revoked_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return { ok: false, error: error.message };

  return { ok: true, tokens: (data ?? []) as HomeAssistantTokenSummary[] };
}

export async function createHomeAssistantToken(formData: FormData): Promise<{
  ok: true;
  token: string;
  tokenRecord: HomeAssistantTokenSummary;
} | { ok: false; error: string }> {
  const user = await getUser();
  const profile = await getProfile();
  if (!user) return { ok: false, error: "Bạn chưa đăng nhập." };

  const name = formData.get("name")?.toString().trim() || "Home Assistant";
  const token = createPlainToken();
  const tokenHash = hashToken(token);
  const tokenPrefix = `${token.slice(0, 10)}…${token.slice(-4)}`;

  const supabase = await getWritableClient();
  const { data, error } = await supabase
    .from("home_assistant_tokens")
    .insert({
      user_id: user.id,
      name,
      token_hash: tokenHash,
      token_prefix: tokenPrefix,
      is_active: true,
    })
    .select("id, name, token_prefix, is_active, last_used_at, revoked_at, created_at")
    .single();

  if (error || !data) {
    return {
      ok: false,
      error: error?.message ?? "Không tạo được token Home Assistant.",
    };
  }

  await recordAuditLog({
    action: "home_assistant.token_created",
    entityType: "home_assistant_token",
    entityId: data.id,
    entityLabel: name,
    actorUserId: user.id,
    actorEmail: user.email,
    actorRole: profile?.role ?? null,
    metadata: {
      tokenPrefix,
      role: profile?.role ?? null,
      source: "account_settings",
    },
  });

  revalidatePath("/dashboard/account-settings");

  return { ok: true, token, tokenRecord: data as HomeAssistantTokenSummary };
}

export async function revokeHomeAssistantToken(tokenId: string): Promise<{
  ok: true;
} | { ok: false; error: string }> {
  const user = await getUser();
  const profile = await getProfile();
  if (!user) return { ok: false, error: "Bạn chưa đăng nhập." };

  const supabase = await getWritableClient();
  const { data: tokenRow, error: loadError } = await supabase
    .from("home_assistant_tokens")
    .select("id, user_id, name, token_prefix")
    .eq("id", tokenId)
    .maybeSingle();

  if (loadError) return { ok: false, error: loadError.message };
  if (!tokenRow || tokenRow.user_id !== user.id) {
    return { ok: false, error: "Không tìm thấy token hoặc bạn không có quyền thu hồi." };
  }

  const { error } = await supabase
    .from("home_assistant_tokens")
    .update({
      is_active: false,
      revoked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", tokenId);

  if (error) return { ok: false, error: error.message };

  await recordAuditLog({
    action: "home_assistant.token_revoked",
    entityType: "home_assistant_token",
    entityId: tokenId,
    entityLabel: tokenRow.name,
    actorUserId: user.id,
    actorEmail: user.email,
    actorRole: profile?.role ?? null,
    severity: "warning",
    metadata: {
      tokenPrefix: tokenRow.token_prefix,
      source: "account_settings",
    },
  });

  revalidatePath("/dashboard/account-settings");
  return { ok: true };
}

import { buildHomeAssistantUpcomingEvents } from "@/utils/home-assistant/upcomingEvents";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type TokenRow = {
  id: string;
  user_id: string;
  name: string;
  token_prefix: string;
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

function readBearerToken(request: NextRequest) {
  const auth = request.headers.get("authorization") || request.headers.get("Authorization");
  const match = auth?.match(/^Bearer\s+(.+)$/i);
  if (match?.[1]) return match[1].trim();

  return request.nextUrl.searchParams.get("token")?.trim() || null;
}

function clampDays(value: string | null) {
  const parsed = Number(value ?? 30);
  if (!Number.isFinite(parsed)) return 30;
  return Math.min(Math.max(Math.trunc(parsed), 1), 90);
}

export async function GET(request: NextRequest) {
  const token = readBearerToken(request);
  if (!token) {
    return NextResponse.json(
      { error: "Missing Home Assistant bearer token." },
      { status: 401 },
    );
  }

  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Missing SUPABASE_SERVICE_ROLE_KEY on server." },
      { status: 500 },
    );
  }

  const tokenHash = hashToken(token);
  const { data: tokenRow, error: tokenError } = await supabase
    .from("home_assistant_tokens")
    .select("id, user_id, name, token_prefix")
    .eq("token_hash", tokenHash)
    .eq("is_active", true)
    .is("revoked_at", null)
    .maybeSingle();

  if (tokenError) {
    return NextResponse.json({ error: tokenError.message }, { status: 500 });
  }

  if (!tokenRow) {
    return NextResponse.json({ error: "Invalid or revoked Home Assistant token." }, { status: 401 });
  }

  const tokenData = tokenRow as TokenRow;
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role, person_id")
    .eq("id", tokenData.user_id)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  if (!profile) {
    return NextResponse.json({ error: "Token user profile not found." }, { status: 403 });
  }

  const [
    personsRes,
    relationshipsRes,
    familiesRes,
    familyParentsRes,
    familyChildrenRes,
    eventsRes,
    personEventsRes,
    customEventsRes,
  ] = await Promise.all([
    supabase
      .from("persons")
      .select("id, full_name, birth_year, birth_month, birth_day, death_year, death_month, death_day, death_lunar_year, death_lunar_month, death_lunar_day, is_deceased, deleted_at")
      .is("deleted_at", null),
    supabase.from("relationships").select("id, type, person_a, person_b, deleted_at").is("deleted_at", null),
    supabase.from("families").select("id, deleted_at").is("deleted_at", null),
    supabase.from("family_parents").select("family_id, person_id, role"),
    supabase.from("family_children").select("family_id, person_id, relationship_type"),
    supabase.from("events").select("*").is("deleted_at", null),
    supabase.from("person_events").select("person_id, event_id, role"),
    supabase
      .from("custom_events")
      .select("id, name, content, event_date, location")
      .is("deleted_at", null),
  ]);

  const firstError = [
    personsRes.error,
    relationshipsRes.error,
    familiesRes.error,
    familyParentsRes.error,
    familyChildrenRes.error,
    eventsRes.error,
    personEventsRes.error,
    customEventsRes.error,
  ].find(Boolean);

  if (firstError) {
    return NextResponse.json({ error: firstError.message }, { status: 500 });
  }

  const maxDays = clampDays(request.nextUrl.searchParams.get("days"));
  const result = buildHomeAssistantUpcomingEvents({
    profile,
    persons: personsRes.data ?? [],
    relationships: relationshipsRes.data ?? [],
    families: familiesRes.data ?? [],
    familyParents: familyParentsRes.data ?? [],
    familyChildren: familyChildrenRes.data ?? [],
    events: eventsRes.data ?? [],
    personEvents: personEventsRes.data ?? [],
    customEvents: customEventsRes.data ?? [],
    maxDays,
  });

  await supabase
    .from("home_assistant_tokens")
    .update({ last_used_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", tokenData.id);

  return NextResponse.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    viewer: {
      userId: tokenData.user_id,
      role: profile.role,
      scope: profile.role === "admin" ? "all" : "visible_persons",
      personId: profile.person_id ?? null,
      tokenName: tokenData.name,
      tokenPrefix: tokenData.token_prefix,
    },
    summary: result.summary,
    today: result.today,
    next7Days: result.next7Days,
    next30Days: result.next30Days,
    events: result.events,
  });
}

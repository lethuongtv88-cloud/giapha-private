export interface GedcomPerson {
  id?: string;
  full_name?: string | null;
  surname?: string | null;
  given_name?: string | null;
  gender?: "male" | "female" | "other" | string;
  birth_year?: number | null;
  birth_month?: number | null;
  birth_day?: number | null;
  death_year?: number | null;
  death_month?: number | null;
  death_day?: number | null;
  death_lunar_year?: number | null;
  death_lunar_month?: number | null;
  death_lunar_day?: number | null;
  death_lunar_is_leap?: boolean | null;
  is_deceased?: boolean;
  is_in_law?: boolean;
  birth_order?: number | null;
  generation?: number | null;
  avatar_url?: string | null;
  note?: string | null;
}

export interface GedcomRelationship {
  id?: string;
  type?: string;
  person_a?: string;
  person_b?: string;
  status?: string | null;
  note?: string | null;
}

export interface GedcomPersonName {
  id?: string;
  person_id: string;
  full_name?: string | null;
  surname?: string | null;
  given_name?: string | null;
  name_type?: string | null;
  is_primary?: boolean | null;
  sort_order?: number | null;
}

export interface GedcomFamily {
  id: string;
  status?: string | null;
  deleted_at?: string | null;
}

export interface GedcomFamilyParent {
  id?: string;
  family_id: string;
  person_id: string;
  role?: string | null;
  sort_order?: number | null;
}

export interface GedcomFamilyChild {
  id?: string;
  family_id: string;
  person_id: string;
  relationship_type?: string | null;
  sort_order?: number | null;
}

export interface GedcomEvent {
  id: string;
  type?: string | null;
  title?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  sort_date?: string | null;
  date_precision?: string | null;
  date_modifier?: string | null;
  canonical_calendar?: string | null;
  date_original_text?: string | null;
  date_phrase?: string | null;
  lunar_year?: number | null;
  lunar_month?: number | null;
  lunar_day?: number | null;
  lunar_is_leap_month?: boolean | null;
  place_text?: string | null;
  description?: string | null;
  family_id?: string | null;
  legacy_person_id?: string | null;
  legacy_family_id?: string | null;
  legacy_source?: string | null;
  deleted_at?: string | null;
}

export interface GedcomPersonEvent {
  id?: string;
  person_id: string;
  event_id: string;
  role?: string | null;
  sort_order?: number | null;
}

export interface GedcomExportResult {
  content: string;
  warnings: string[];
}

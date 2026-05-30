export interface GedcomPerson {
  id?: string;
  full_name?: string | null;
  surname?: string | null;
  given_name?: string | null;
  gender?: 'male' | 'female' | 'other' | string;
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
}

export interface GedcomExportResult {
  content: string;
  warnings: string[];
}

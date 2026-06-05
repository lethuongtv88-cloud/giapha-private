export async function ensureFamilyModelMarriage({
  supabase,
  personAId,
  personBId,
}: {
  supabase: any;
  personAId: string;
  personBId: string;
}) {
  const { data, error } = await supabase.rpc("ensure_family_model_marriage", {
    p_person_a: personAId,
    p_person_b: personBId,
  });

  if (error) {
    console.error("Failed to ensure Family Model marriage:", error);
    throw error;
  }

  return data as string;
}

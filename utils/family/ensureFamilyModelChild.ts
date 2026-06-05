export async function ensureFamilyModelChild({
  supabase,
  parentAId,
  childId,
  parentBId = null,
}: {
  supabase: any;
  parentAId: string;
  childId: string;
  parentBId?: string | null;
}) {
  const { data, error } = await supabase.rpc("ensure_family_model_child", {
    p_parent_a: parentAId,
    p_child: childId,
    p_parent_b: parentBId,
  });

  if (error) {
    console.error("Failed to ensure Family Model child:", error);
    throw error;
  }

  return data as string;
}

/**
 * Gọi RPC atomic public.link_child_with_family_sync: gộp việc ghi quan hệ
 * (cha/mẹ đã biết -> con, và vợ/chồng còn lại -> con nếu có) + đồng bộ
 * Family Model (ensure_family_model_child) vào 1 lệnh SQL duy nhất, để
 * tránh tình trạng "có relationships nhưng Family Model chưa đồng bộ" nếu
 * 1 trong các bước bị lỗi giữa chừng (xem migration 065).
 */
export async function linkChildWithFamilySync({
  supabase,
  parentAId,
  childId,
  type,
  note = null,
  parentBId = null,
  autoLinkSpouse = true,
}: {
  supabase: any;
  parentAId: string;
  childId: string;
  type: "biological_child" | "adopted_child";
  note?: string | null;
  parentBId?: string | null;
  autoLinkSpouse?: boolean;
}) {
  const { data, error } = await supabase.rpc("link_child_with_family_sync", {
    p_parent_a: parentAId,
    p_child: childId,
    p_type: type,
    p_note: note,
    p_parent_b: parentBId,
    p_auto_link_spouse: autoLinkSpouse,
  });

  if (error) {
    console.error("Failed to link child with family sync:", error);
    throw error;
  }

  return data as {
    family_id: string;
    parent_b_used: string | null;
    relationship_a_id: string | null;
    relationship_b_id: string | null;
  };
}

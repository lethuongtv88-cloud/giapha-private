import { buildVisiblePersons } from "../../utils/permissions/visiblePersons";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error("FAIL: " + msg);
  console.log("OK: " + msg);
}

// ===========================================================================
// Kịch bản đúng như báo cáo của người dùng:
// - "minh" (chồng) có cha mẹ (cha_minh, me_minh) và em ruột (em_minh).
// - "minh" x "vo_minh" (vợ) -> con1, con2.
// - con1 x vo_con1 -> chau1.
// - "vo_minh" có cha mẹ riêng (cha_vo, me_vo) và em ruột riêng (em_vo).
// - Admin cấp quyền editor cho tài khoản của "vo_minh", gán gốc edit = "minh".
//
// Yêu cầu: vo_minh chỉ được SỬA: minh, con cái chung (con1, con2, chau1,
// vo_con1), và toàn bộ nội ngoại nhà VỢ (chính vo_minh, cha_vo, me_vo,
// em_vo) - KHÔNG được sửa nội ngoại nhà CHỒNG (cha_minh, me_minh, em_minh),
// dù vẫn được XEM (quyền xem thành viên bình thường không đổi).
// ===========================================================================

const persons = [
  { id: "minh" },
  { id: "cha_minh" },
  { id: "me_minh" },
  { id: "em_minh" },
  { id: "vo_minh" },
  { id: "cha_vo" },
  { id: "me_vo" },
  { id: "em_vo" },
  { id: "con1" },
  { id: "con2" },
  { id: "vo_con1" },
  { id: "chau1" },
  { id: "nguoi_ngoai" },
];

const relationships = [
  { type: "biological_child", person_a: "cha_minh", person_b: "minh" },
  { type: "biological_child", person_a: "me_minh", person_b: "minh" },
  { type: "biological_child", person_a: "cha_minh", person_b: "em_minh" },
  { type: "biological_child", person_a: "me_minh", person_b: "em_minh" },
  { type: "biological_child", person_a: "cha_vo", person_b: "vo_minh" },
  { type: "biological_child", person_a: "me_vo", person_b: "vo_minh" },
  { type: "biological_child", person_a: "cha_vo", person_b: "em_vo" },
  { type: "biological_child", person_a: "me_vo", person_b: "em_vo" },
  { type: "marriage", person_a: "minh", person_b: "vo_minh" },
  { type: "biological_child", person_a: "minh", person_b: "con1" },
  { type: "biological_child", person_a: "vo_minh", person_b: "con1" },
  { type: "biological_child", person_a: "minh", person_b: "con2" },
  { type: "biological_child", person_a: "vo_minh", person_b: "con2" },
  { type: "marriage", person_a: "con1", person_b: "vo_con1" },
  { type: "biological_child", person_a: "con1", person_b: "chau1" },
  { type: "biological_child", person_a: "vo_con1", person_b: "chau1" },
];

console.log("=== Tài khoản của vo_minh (editor), rootedit = minh ===");
{
  const result = buildVisiblePersons({
    role: "editor",
    viewerPersonId: "vo_minh",
    editRootPersonId: "minh",
    persons,
    relationships,
  });

  const editable = result.editablePersonIds;
  const visible = result.visiblePersonIds;

  // --- Quyền SỬA (editable) phải hẹp: chỉ nhánh rootedit ---
  assert(editable.has("minh"), "SỬA được minh (gốc)");
  assert(editable.has("con1") && editable.has("con2"), "SỬA được các con");
  assert(editable.has("chau1"), "SỬA được cháu (chắt)");
  assert(editable.has("vo_con1"), "SỬA được dâu (vợ của con1)");
  assert(editable.has("vo_minh"), "SỬA được chính vo_minh (vợ của gốc)");
  assert(
    editable.has("cha_vo") && editable.has("me_vo"),
    "SỬA được cha mẹ VỢ (nội ngoại nhà vợ)",
  );
  assert(editable.has("em_vo"), "SỬA được em VỢ (nội ngoại nhà vợ)");

  assert(
    !editable.has("cha_minh") && !editable.has("me_minh"),
    "KHÔNG được SỬA cha mẹ CHỒNG (nội ngoại nhà chồng) - đây là bug đã báo cáo",
  );
  assert(
    !editable.has("em_minh"),
    "KHÔNG được SỬA em CHỒNG (nội ngoại nhà chồng)",
  );
  assert(!editable.has("nguoi_ngoai"), "KHÔNG được sửa người không liên quan");

  // --- Quyền XEM (visible) vẫn rộng như thành viên bình thường (không đổi) ---
  assert(
    visible.has("cha_minh") && visible.has("me_minh") && visible.has("em_minh"),
    "VẪN XEM được nội ngoại nhà chồng (quyền xem thành viên bình thường, không bị rootedit thu hẹp)",
  );
  assert(visible.has("cha_vo") && visible.has("em_vo"), "VẪN XEM được nội ngoại nhà vợ");
}

console.log("\n=== Không có rootedit -> hành vi cũ giữ nguyên (editable = visible) ===");
{
  const result = buildVisiblePersons({
    role: "editor",
    viewerPersonId: "vo_minh",
    persons,
    relationships,
  });
  assert(
    result.editablePersonIds.size === result.visiblePersonIds.size,
    "không có rootedit -> editable trùng với visible (hành vi cũ, không phá vỡ các editor hiện có)",
  );
  assert(result.editablePersonIds.has("cha_minh"), "editor không rootedit vẫn sửa được như trước (legacy)");
}

console.log("\n=== Admin luôn sửa được tất cả ===");
{
  const result = buildVisiblePersons({ role: "admin", persons, relationships });
  assert(result.editablePersonIds.size === persons.length, "admin editable = toàn bộ");
}

console.log("\nALL PASS");


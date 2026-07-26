"use server";

import { getSupabase } from "@/utils/supabase/queries";
import { assertCanEditPerson } from "@/utils/permissions/assertPersonAccess";
import { getSupabaseServiceRole } from "@/utils/supabase/serviceRole";
import { recordAuditLog } from "@/services/audit/auditLog.service";
import { revalidatePath } from "next/cache";

const AVATAR_BUCKET = "avatars";

function slugify(str: string) {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .replace(/([^0-9a-z-\s])/g, "")
    .replace(/(\s+)/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Xoá TẤT CẢ các file avatar cũ của một người trong storage, bất kể đuôi
 * file gì (jpg/png/webp...). Dùng service_role để không bị chặn bởi RLS
 * của bucket "avatars" (vd. chính sách chỉ cho phép chủ sở hữu ban đầu của
 * file mới được xoá/ghi đè — khiến admin/editor khác không xoá được ảnh cũ
 * để thay ảnh mới).
 */
async function removeExistingAvatarFiles(personId: string) {
  const admin = getSupabaseServiceRole();
  const { data: files, error: listError } = await admin.storage
    .from(AVATAR_BUCKET)
    .list("", { search: personId });

  if (listError) {
    console.error("Error listing avatar files:", listError);
    return { error: listError.message };
  }

  const matching = (files ?? [])
    .filter((f) => f.name.startsWith(`${personId}_`))
    .map((f) => f.name);

  if (matching.length === 0) return { error: null };

  const { error: removeError } = await admin.storage
    .from(AVATAR_BUCKET)
    .remove(matching);

  if (removeError) {
    console.error("Error removing avatar files:", removeError);
    return { error: removeError.message };
  }

  return { error: null };
}

export async function deletePersonAvatar(personId: string) {
  const permission = await assertCanEditPerson(personId, {
    action: "person.avatar.delete",
    entityType: "person",
    entityId: personId,
  });
  if (!permission.ok) {
    return { error: permission.error ?? "Bạn không có quyền xoá ảnh đại diện." };
  }

  const { error: removeError } = await removeExistingAvatarFiles(personId);
  if (removeError) {
    return { error: "Không xoá được ảnh cũ trong kho lưu trữ: " + removeError };
  }

  const supabase = await getSupabase();
  const { error: updateError } = await supabase
    .from("persons")
    .update({ avatar_url: null })
    .eq("id", personId)
    .is("deleted_at", null);

  if (updateError) {
    console.error("Error clearing avatar_url:", updateError);
    return { error: "Đã xoá ảnh nhưng không cập nhật được hồ sơ." };
  }

  await recordAuditLog({
    action: "person.avatar.deleted",
    entityType: "person",
    entityId: personId,
  });

  revalidatePath("/dashboard/members");
  return { error: null };
}

export async function uploadPersonAvatar(formData: FormData) {
  const personId = formData.get("personId")?.toString();
  const fullName = formData.get("fullName")?.toString() ?? "";
  const file = formData.get("file") as File | null;

  if (!personId || !file) {
    return { error: "Thiếu thông tin để tải ảnh lên.", url: null };
  }

  const permission = await assertCanEditPerson(personId, {
    action: "person.avatar.upload",
    entityType: "person",
    entityId: personId,
  });
  if (!permission.ok) {
    return {
      error: permission.error ?? "Bạn không có quyền thay đổi ảnh đại diện.",
      url: null,
    };
  }

  // Xoá hết các file avatar cũ trước (kể cả khi đổi đuôi file, ví dụ
  // jpg -> png) để không bị kẹt do RLS hoặc để lại file rác.
  const { error: removeError } = await removeExistingAvatarFiles(personId);
  if (removeError) {
    console.error("Could not clear old avatar before upload:", removeError);
  }

  const admin = getSupabaseServiceRole();
  const fileExt = file.name.split(".").pop() || "jpg";
  const slugName = slugify(fullName) || "thanh-vien";
  const filePath = `${personId}_${slugName}.${fileExt}`;

  const arrayBuffer = await file.arrayBuffer();

  const { error: uploadError } = await admin.storage
    .from(AVATAR_BUCKET)
    .upload(filePath, arrayBuffer, {
      contentType: file.type || undefined,
      upsert: true,
    });

  if (uploadError) {
    console.error("Error uploading avatar:", uploadError);
    return { error: "Tải ảnh lên thất bại: " + uploadError.message, url: null };
  }

  const {
    data: { publicUrl },
  } = admin.storage.from(AVATAR_BUCKET).getPublicUrl(filePath);

  const supabase = await getSupabase();
  const { error: updateError } = await supabase
    .from("persons")
    .update({ avatar_url: publicUrl })
    .eq("id", personId)
    .is("deleted_at", null);

  if (updateError) {
    console.error("Error saving avatar_url:", updateError);
    return { error: "Đã tải ảnh lên nhưng không lưu được vào hồ sơ.", url: null };
  }

  await recordAuditLog({
    action: "person.avatar.updated",
    entityType: "person",
    entityId: personId,
  });

  revalidatePath("/dashboard/members");
  return { error: null, url: publicUrl };
}

"use server";

import { getCurrentPersonAccess } from "@/utils/permissions/assertPersonAccess";

/**
 * Trả về phạm vi phân quyền của tài khoản hiện tại dưới dạng mảng (để dùng
 * được ở client component). Dùng cho các nơi mở chỉnh sửa nhanh (modal) mà
 * không đi qua trang server-render đã có sẵn permission gate, ví dụ
 * MemberDetailModal mở từ cây gia phả.
 */
export async function getMyPermissionScope() {
  const access = await getCurrentPersonAccess();

  return {
    ok: access.ok,
    isAdmin: access.isAdmin,
    visiblePersonIds: Array.from(access.visiblePersonIds),
    editablePersonIds: Array.from(access.editablePersonIds),
  };
}

"use server";

import { recordAuditLog } from "@/services/audit/auditLog.service";
import { UserRole } from "@/types";
import { getSupabase } from "@/utils/supabase/queries";
import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_ROLE ||
    process.env.SUPABASE_SERVICE_ROLE_DEFAULT_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Thiếu SUPABASE_SERVICE_ROLE_KEY để quản trị tài khoản người dùng.",
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// "User not allowed" / "not_admin" là lỗi Supabase trả về trực tiếp khi
// SUPABASE_SERVICE_ROLE_KEY không phải là service_role key hợp lệ (ví dụ bị
// dán nhầm anon key, hoặc key đã bị revoke/xoay vòng trong Supabase Dashboard
// nhưng biến môi trường trên server chưa được cập nhật lại). Đây KHÔNG phải
// lỗi phân quyền admin trong ứng dụng — dịch lại cho rõ để dễ chẩn đoán.
function describeSupabaseAdminError(error: { message?: string; status?: number }): string {
  const message = error.message || "";
  if (
    message.toLowerCase().includes("not allowed") ||
    message.toLowerCase().includes("not_admin") ||
    error.status === 403
  ) {
    return (
      "Máy chủ chưa có quyền quản trị tài khoản (SUPABASE_SERVICE_ROLE_KEY " +
      "đang sai hoặc đã hết hiệu lực). Vào Supabase Dashboard → Project " +
      "Settings → API, sao chép lại đúng \"service_role\" key (không phải " +
      "\"anon\"/\"public\" key), cập nhật vào biến môi trường " +
      "SUPABASE_SERVICE_ROLE_KEY trên server, rồi khởi động lại ứng dụng. " +
      `(Chi tiết lỗi gốc: ${message || "không rõ"})`
    );
  }

  return message || "Có lỗi không xác định từ Supabase.";
}

function normalizeRole(role: string | null | undefined): UserRole | null {
  if (role === "admin" || role === "editor" || role === "member") return role;
  return null;
}

function normalizeOptionalUuid(value: FormDataEntryValue | null) {
  const text = value?.toString().trim();
  return text ? text : null;
}


function normalizeUsername(value: FormDataEntryValue | string | null | undefined) {
  const raw = typeof value === "string" ? value : value?.toString();
  const username = raw?.trim().toLowerCase() ?? "";
  if (!username) return null;
  return username;
}

function validateUsername(username: string | null) {
  if (!username) return null;

  if (username.length < 3 || username.length > 32) {
    return "Tên đăng nhập phải dài từ 3 đến 32 ký tự.";
  }

  if (!/^[a-z0-9._]+$/.test(username)) {
    return "Tên đăng nhập chỉ được dùng chữ thường không dấu, số, dấu chấm và dấu gạch dưới.";
  }

  if (username.includes("..") || username.startsWith(".") || username.endsWith(".")) {
    return "Tên đăng nhập không được bắt đầu/kết thúc bằng dấu chấm hoặc có hai dấu chấm liên tiếp.";
  }

  return null;
}

async function ensureUsernameAvailable(username: string | null, exceptUserId?: string) {
  if (!username) return null;
  const admin = getSupabaseAdmin();
  let query = admin.from("profiles").select("id").eq("username", username).limit(1);
  if (exceptUserId) query = query.neq("id", exceptUserId);
  const { data, error } = await query;

  if (error) {
    console.error("Failed to check username availability:", error);
    return "Không kiểm tra được tên đăng nhập: " + error.message;
  }

  if (data && data.length > 0) return "Tên đăng nhập này đã được sử dụng.";
  return null;
}

export async function resolveLoginIdentifier(identifier: string) {
  const loginId = identifier.trim().toLowerCase();
  if (!loginId) return { error: "Vui lòng nhập email hoặc tên đăng nhập." };

  if (loginId.includes("@")) {
    return { email: loginId };
  }

  const usernameError = validateUsername(loginId);
  if (usernameError) return { error: "Email hoặc tên đăng nhập không hợp lệ." };

  try {
    const admin = getSupabaseAdmin();
    const { data: profile, error } = await admin
      .from("profiles")
      .select("id, username")
      .eq("username", loginId)
      .maybeSingle();

    if (error) {
      console.error("Failed to resolve username:", error);
      return { error: "Không thể kiểm tra tên đăng nhập. Vui lòng thử lại." };
    }

    if (!profile?.id) {
      return { error: "Email hoặc tên đăng nhập không đúng." };
    }

    const { data: userData, error: userError } = await admin.auth.admin.getUserById(profile.id);
    if (userError || !userData.user?.email) {
      console.error("Failed to resolve username to auth email:", userError);
      return { error: "Email hoặc tên đăng nhập không đúng." };
    }

    return { email: userData.user.email.toLowerCase() };
  } catch (err) {
    console.error("Unexpected username resolve error:", err);
    return { error: "Không thể đăng nhập bằng tên đăng nhập lúc này." };
  }
}

export async function changeUserRole(userId: string, newRole: UserRole) {
  const supabase = await getSupabase();
  const { error } = await supabase.rpc("set_user_role", {
    target_user_id: userId,
    new_role: newRole,
  });

  if (error) {
    console.error("Failed to change user role:", error);
    return { error: error.message };
  }

  await recordAuditLog({
    action: "user.role_changed",
    entityType: "user",
    entityId: userId,
    severity: "warning",
    metadata: { newRole },
  });

  revalidatePath("/dashboard/users");
  return { success: true };
}

export async function deleteUser(userId: string) {
  const supabase = await getSupabase();
  const { error } = await supabase.rpc("delete_user", {
    target_user_id: userId,
  });

  if (error) {
    console.error("Failed to delete user:", error);
    return { error: error.message };
  }

  await recordAuditLog({
    action: "user.deleted",
    entityType: "user",
    entityId: userId,
    severity: "danger",
  });

  revalidatePath("/dashboard/users");
  return { success: true };
}

export async function adminCreateUser(formData: FormData) {
  const email = formData.get("email")?.toString()?.trim().toLowerCase();
  const password = formData.get("password")?.toString();
  const fullName = formData.get("full_name")?.toString()?.trim() || "";
  const username = normalizeUsername(formData.get("username"));
  const role = normalizeRole(formData.get("role")?.toString() || "member");
  const defaultTreeRootId = normalizeOptionalUuid(
    formData.get("default_tree_root_id"),
  );
  const linkedPersonId = normalizeOptionalUuid(formData.get("person_id"));

  if (!role) {
    return { error: "Vai trò không hợp lệ." };
  }

  const isActiveStr = formData.get("is_active")?.toString();
  const isActive = isActiveStr === "false" ? false : true;

  if (!email || !password) {
    return { error: "Email và mật khẩu là bắt buộc." };
  }

  const usernameError = validateUsername(username);
  if (usernameError) return { error: usernameError };

  const usernameTaken = await ensureUsernameAvailable(username);
  if (usernameTaken) return { error: usernameTaken };

  const supabase = await getSupabase();

  const { error } = await supabase.rpc("admin_create_user", {
    new_email: email,
    new_password: password,
    new_role: role,
    new_active: isActive,
  });

  if (error) {
    console.error("Failed to create user:", error);
    return { error: error.message };
  }

  const { data: adminUsers, error: usersError } = await supabase.rpc(
    "get_admin_users",
  );

  if (usersError) {
    console.error("Created user but failed to refetch user id:", usersError);
    return {
      error:
        "Đã tạo người dùng, nhưng chưa cập nhật được thông tin bổ sung: " +
        usersError.message,
    };
  }

  const createdUser = Array.isArray(adminUsers)
    ? adminUsers.find((user: { id?: string; email?: string }) => {
        return user.email?.toLowerCase() === email;
      })
    : null;

  if (createdUser?.id) {
    const admin = getSupabaseAdmin();

    if (fullName) {
      const { error: metadataError } = await admin.auth.admin.updateUserById(
        createdUser.id,
        {
          user_metadata: {
            full_name: fullName,
            name: fullName,
          },
        },
      );

      if (metadataError) {
        console.error("Created user but failed to update name:", metadataError);
        return {
          error:
            "Đã tạo người dùng, nhưng chưa lưu được tên hiển thị: " +
            describeSupabaseAdminError(metadataError),
        };
      }
    }

    if (defaultTreeRootId) {
      const { error: preferenceError } = await admin
        .from("user_preferences")
        .upsert(
          {
            user_id: createdUser.id,
            default_tree_root_id: defaultTreeRootId,
          },
          { onConflict: "user_id" },
        );

      if (preferenceError) {
        console.error(
          "Created user but failed to save default tree root:",
          preferenceError,
        );
        return {
          error:
            "Đã tạo người dùng, nhưng chưa lưu được gốc gia phả mặc định: " +
            preferenceError.message,
        };
      }
    }

    if (linkedPersonId || username) {
      const { error: profileError } = await admin
        .from("profiles")
        .update({ person_id: linkedPersonId, username })
        .eq("id", createdUser.id);

      if (profileError) {
        console.error("Created user but failed to update profile:", profileError);
        return {
          error:
            "Đã tạo người dùng, nhưng chưa lưu được tên đăng nhập/người trong gia phả: " +
            profileError.message,
        };
      }
    }
  }

  await recordAuditLog({
    action: "user.created",
    entityType: "user",
    entityId: createdUser?.id ?? null,
    entityLabel: email,
    severity: "warning",
    metadata: {
      email,
      fullName,
      username,
      role,
      isActive,
      defaultTreeRootId,
      linkedPersonId,
    },
  });

  revalidatePath("/dashboard/users");
  return { success: true };
}

export async function adminUpdateUser(formData: FormData) {
  const userId = formData.get("user_id")?.toString()?.trim();
  const email = formData.get("email")?.toString()?.trim().toLowerCase();
  const fullName = formData.get("full_name")?.toString()?.trim() || "";
  const username = normalizeUsername(formData.get("username"));
  const role = normalizeRole(formData.get("role")?.toString());
  const isActive = formData.get("is_active")?.toString() === "true";
  const defaultTreeRootId = normalizeOptionalUuid(
    formData.get("default_tree_root_id"),
  );
  const linkedPersonId = normalizeOptionalUuid(formData.get("person_id"));

  if (!userId) return { error: "Thiếu ID người dùng." };
  if (!email) return { error: "Email là bắt buộc." };
  if (!role) return { error: "Vai trò không hợp lệ." };

  const usernameError = validateUsername(username);
  if (usernameError) return { error: usernameError };

  const usernameTaken = await ensureUsernameAvailable(username, userId);
  if (usernameTaken) return { error: usernameTaken };

  const admin = getSupabaseAdmin();
  const supabase = await getSupabase();

  const { error: authError } = await admin.auth.admin.updateUserById(userId, {
    email,
    user_metadata: {
      full_name: fullName,
      name: fullName,
    },
  });

  if (authError) {
    console.error("Failed to update user auth profile:", authError);
    return { error: describeSupabaseAdminError(authError) };
  }

  const { error: roleError } = await supabase.rpc("set_user_role", {
    target_user_id: userId,
    new_role: role,
  });

  if (roleError) {
    console.error("Failed to update user role:", roleError);
    return { error: roleError.message };
  }

  const { error: activeError } = await supabase.rpc("set_user_active_status", {
    target_user_id: userId,
    new_status: isActive,
  });

  if (activeError) {
    console.error("Failed to update user status:", activeError);
    return { error: activeError.message };
  }

  const { error: preferenceError } = await admin
    .from("user_preferences")
    .upsert(
      {
        user_id: userId,
        default_tree_root_id: defaultTreeRootId,
      },
      { onConflict: "user_id" },
    );

  if (preferenceError) {
    console.error("Failed to update user root preference:", preferenceError);
    return { error: preferenceError.message };
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({ person_id: linkedPersonId, username })
    .eq("id", userId);

  if (profileError) {
    console.error("Failed to update linked person:", profileError);
    return { error: profileError.message };
  }

  await recordAuditLog({
    action: "user.updated",
    entityType: "user",
    entityId: userId,
    entityLabel: email,
    severity: "warning",
    metadata: {
      email,
      fullName,
      username,
      role,
      isActive,
      defaultTreeRootId,
      linkedPersonId,
    },
  });

  revalidatePath("/dashboard/users");
  return { success: true };
}

export async function adminResetUserPassword(formData: FormData) {
  const userId = formData.get("user_id")?.toString()?.trim();
  const password = formData.get("password")?.toString();
  const confirmPassword = formData.get("confirm_password")?.toString();

  if (!userId) return { error: "Thiếu ID người dùng." };
  if (!password || password.length < 6) {
    return { error: "Mật khẩu mới phải có ít nhất 6 ký tự." };
  }
  if (password !== confirmPassword) {
    return { error: "Mật khẩu nhập lại không khớp." };
  }

  const admin = getSupabaseAdmin();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    password,
  });

  if (error) {
    console.error("Failed to reset user password:", error);
    return { error: describeSupabaseAdminError(error) };
  }

  await recordAuditLog({
    action: "user.password_reset",
    entityType: "user",
    entityId: userId,
    severity: "danger",
  });

  revalidatePath("/dashboard/users");
  return { success: true };
}

export async function toggleUserStatus(userId: string, newStatus: boolean) {
  const supabase = await getSupabase();
  const { error } = await supabase.rpc("set_user_active_status", {
    target_user_id: userId,
    new_status: newStatus,
  });

  if (error) {
    console.error("Failed to change user status:", error);
    return { error: error.message };
  }


  await recordAuditLog({
    action: "user.status_changed",
    entityType: "user",
    entityId: userId,
    severity: "warning",
    metadata: { newStatus },
  });

  revalidatePath("/dashboard/users");
  return { success: true };
}

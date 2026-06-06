"use server";

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

function normalizeRole(role: string | null | undefined): UserRole | null {
  if (role === "admin" || role === "editor" || role === "member") return role;
  return null;
}

function normalizeOptionalUuid(value: FormDataEntryValue | null) {
  const text = value?.toString().trim();
  return text ? text : null;
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

  revalidatePath("/dashboard/users");
  return { success: true };
}

export async function adminCreateUser(formData: FormData) {
  const email = formData.get("email")?.toString()?.trim().toLowerCase();
  const password = formData.get("password")?.toString();
  const fullName = formData.get("full_name")?.toString()?.trim() || "";
  const role = normalizeRole(formData.get("role")?.toString() || "member");
  const defaultTreeRootId = normalizeOptionalUuid(
    formData.get("default_tree_root_id"),
  );

  if (!role) {
    return { error: "Vai trò không hợp lệ." };
  }

  const isActiveStr = formData.get("is_active")?.toString();
  const isActive = isActiveStr === "false" ? false : true;

  if (!email || !password) {
    return { error: "Email và mật khẩu là bắt buộc." };
  }

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
            metadataError.message,
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
  }

  revalidatePath("/dashboard/users");
  return { success: true };
}

export async function adminUpdateUser(formData: FormData) {
  const userId = formData.get("user_id")?.toString()?.trim();
  const email = formData.get("email")?.toString()?.trim().toLowerCase();
  const fullName = formData.get("full_name")?.toString()?.trim() || "";
  const role = normalizeRole(formData.get("role")?.toString());
  const isActive = formData.get("is_active")?.toString() === "true";
  const defaultTreeRootId = normalizeOptionalUuid(
    formData.get("default_tree_root_id"),
  );

  if (!userId) return { error: "Thiếu ID người dùng." };
  if (!email) return { error: "Email là bắt buộc." };
  if (!role) return { error: "Vai trò không hợp lệ." };

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
    return { error: authError.message };
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
    return { error: error.message };
  }

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

  revalidatePath("/dashboard/users");
  return { success: true };
}

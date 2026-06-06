"use client";

import {
  adminCreateUser,
  adminResetUserPassword,
  adminUpdateUser,
  changeUserRole,
  deleteUser,
  toggleUserStatus,
} from "@/app/actions/user";
import config from "@/app/config";
import { AdminUserData, Person, UserRole } from "@/types";
import { AnimatePresence, motion } from "framer-motion";
import { KeyRound, Pencil, Trash, UserRound, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import PersonSelector from "./PersonSelector";

interface AdminUserListProps {
  initialUsers: AdminUserData[];
  currentUserId: string;
  persons: Person[];
}

interface Notification {
  message: string;
  type: "success" | "error" | "info";
}

function getUserName(user: AdminUserData) {
  return user.full_name?.trim() || user.name?.trim() || "";
}

function getPersonName(persons: Person[], personId?: string | null) {
  if (!personId) return "Chưa chọn";
  return persons.find((person) => person.id === personId)?.full_name ?? "Không tìm thấy";
}

export default function AdminUserList({
  initialUsers,
  currentUserId,
  persons,
}: AdminUserListProps) {
  const [users, setUsers] = useState<AdminUserData[]>(initialUsers);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [notification, setNotification] = useState<Notification | null>(null);
  const [isDemo, setIsDemo] = useState(false);

  const [defaultTreeRootId, setDefaultTreeRootId] = useState<string | null>(null);

  const [editingUser, setEditingUser] = useState<AdminUserData | null>(null);
  const [editRootId, setEditRootId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const [resetUser, setResetUser] = useState<AdminUserData | null>(null);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  const sortedPersons = useMemo(() => {
    return [...persons].sort((a, b) =>
      (a.full_name || "").localeCompare(b.full_name || "", "vi"),
    );
  }, [persons]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsDemo(window.location.hostname === config.demoDomain);
    }
  }, []);

  const showNotification = (
    message: string,
    type: "success" | "error" | "info" = "info",
  ) => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  };

  const openEditModal = (user: AdminUserData) => {
    setEditingUser(user);
    setEditRootId(user.default_tree_root_id ?? null);
  };

  const closeEditModal = () => {
    setEditingUser(null);
    setEditRootId(null);
    setIsEditing(false);
  };

  const openResetPasswordModal = (user: AdminUserData) => {
    setResetUser(user);
  };

  const closeResetPasswordModal = () => {
    setResetUser(null);
    setIsResettingPassword(false);
  };

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    if (isDemo) {
      showNotification(
        "Đây là tài khoản demo cho mọi người sử dụng, vui lòng không thay đổi thông tin này.",
        "info",
      );
      return;
    }
    try {
      setLoadingId(userId);
      const result = await changeUserRole(userId, newRole);

      if (result?.error) {
        showNotification(result.error, "error");
        return;
      }

      setUsers((current) =>
        current.map((u) => (u.id === userId ? { ...u, role: newRole } : u)),
      );
      showNotification("Đã cập nhật vai trò người dùng thành công.", "success");
    } catch (error: unknown) {
      const msg =
        error instanceof Error
          ? error.message
          : "Lỗi không xác định khi đổi quyền";
      showNotification(msg, "error");
    } finally {
      setLoadingId(null);
    }
  };

  const handleStatusChange = async (userId: string, newStatus: boolean) => {
    if (isDemo) {
      showNotification(
        "Đây là tài khoản demo cho mọi người sử dụng, vui lòng không thay đổi thông tin này.",
        "info",
      );
      return;
    }
    try {
      setLoadingId(userId);
      const result = await toggleUserStatus(userId, newStatus);

      if (result?.error) {
        showNotification(result.error, "error");
        return;
      }

      setUsers((current) =>
        current.map((u) =>
          u.id === userId ? { ...u, is_active: newStatus } : u,
        ),
      );
      showNotification(
        `Đã ${newStatus ? "duyệt" : "khoá"} người dùng thành công.`,
        "success",
      );
    } catch (error: unknown) {
      const msg =
        error instanceof Error
          ? error.message
          : "Lỗi không xác định khi đổi trạng thái";
      showNotification(msg, "error");
    } finally {
      setLoadingId(null);
    }
  };

  const handleDelete = async (userId: string) => {
    if (isDemo) {
      showNotification(
        "Đây là tài khoản demo cho mọi người sử dụng, vui lòng không thay đổi thông tin này.",
        "info",
      );
      return;
    }
    if (
      !confirm(
        "Bạn có chắc chắn muốn xóa user này khỏi hệ thống vĩnh viễn không?",
      )
    ) {
      return;
    }

    try {
      setLoadingId(userId);
      const result = await deleteUser(userId);

      if (result?.error) {
        showNotification(result.error, "error");
        return;
      }

      setUsers((current) => current.filter((u) => u.id !== userId));
      showNotification("Đã xóa người dùng thành công.", "success");
    } catch (error: unknown) {
      const msg =
        error instanceof Error
          ? error.message
          : "Lỗi không xác định khi xoá user";
      showNotification(msg, "error");
    } finally {
      setLoadingId(null);
    }
  };

  const handleCreateUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isDemo) {
      showNotification(
        "Đây là trang demo, chức năng tạo người dùng bị hạn chế.",
        "info",
      );
      setIsCreateModalOpen(false);
      return;
    }

    setIsCreating(true);
    const formData = new FormData(e.currentTarget);

    try {
      const result = await adminCreateUser(formData);

      if (result?.error) {
        showNotification(result.error, "error");
        return;
      }

      showNotification(
        "Tạo người dùng thành công! Họ có thể đăng nhập ngay bây giờ.",
        "success",
      );
      setIsCreateModalOpen(false);
      setDefaultTreeRootId(null);
      setTimeout(() => window.location.reload(), 1200);
    } catch (error: unknown) {
      const msg =
        error instanceof Error
          ? error.message
          : "Lỗi không xác định khi tạo user";
      showNotification(msg, "error");
    } finally {
      setIsCreating(false);
    }
  };

  const handleEditUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingUser) return;

    if (isDemo) {
      showNotification(
        "Đây là tài khoản demo cho mọi người sử dụng, vui lòng không thay đổi thông tin này.",
        "info",
      );
      return;
    }

    setIsEditing(true);
    const formData = new FormData(e.currentTarget);

    try {
      const result = await adminUpdateUser(formData);

      if (result?.error) {
        showNotification(result.error, "error");
        return;
      }

      const nextEmail = formData.get("email")?.toString()?.trim().toLowerCase() ?? editingUser.email;
      const nextName = formData.get("full_name")?.toString()?.trim() ?? "";
      const nextRole = (formData.get("role")?.toString() || editingUser.role) as UserRole;
      const nextActive = formData.get("is_active")?.toString() === "true";
      const nextRootId = formData.get("default_tree_root_id")?.toString()?.trim() || null;

      setUsers((current) =>
        current.map((user) =>
          user.id === editingUser.id
            ? {
                ...user,
                email: nextEmail,
                full_name: nextName,
                name: nextName,
                role: nextRole,
                is_active: nextActive,
                default_tree_root_id: nextRootId,
              }
            : user,
        ),
      );

      closeEditModal();
      showNotification("Đã cập nhật thông tin người dùng.", "success");
    } catch (error: unknown) {
      const msg =
        error instanceof Error
          ? error.message
          : "Lỗi không xác định khi cập nhật user";
      showNotification(msg, "error");
    } finally {
      setIsEditing(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!resetUser) return;

    if (isDemo) {
      showNotification(
        "Đây là tài khoản demo cho mọi người sử dụng, vui lòng không thay đổi thông tin này.",
        "info",
      );
      return;
    }

    if (
      !confirm(
        `Đặt lại mật khẩu cho ${resetUser.email}? Người dùng sẽ đăng nhập bằng mật khẩu mới ngay sau khi lưu.`,
      )
    ) {
      return;
    }

    setIsResettingPassword(true);
    const formData = new FormData(e.currentTarget);

    try {
      const result = await adminResetUserPassword(formData);

      if (result?.error) {
        showNotification(result.error, "error");
        return;
      }

      closeResetPasswordModal();
      showNotification("Đã đặt lại mật khẩu người dùng.", "success");
    } catch (error: unknown) {
      const msg =
        error instanceof Error
          ? error.message
          : "Lỗi không xác định khi reset mật khẩu";
      showNotification(msg, "error");
    } finally {
      setIsResettingPassword(false);
    }
  };

  return (
    <div className="space-y-6 relative">
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: -20, x: "-50%" }}
            className={`fixed top-1/2 left-1/2 z-100 px-6 py-3 rounded-xl shadow-lg border flex items-center gap-3 min-w-[320px] max-w-[90vw] ${
              notification.type === "success"
                ? "bg-emerald-50/90 border-emerald-200 text-emerald-800"
                : notification.type === "error"
                  ? "bg-red-50/90 border-red-200 text-red-800"
                  : "bg-amber-50/90 border-amber-200 text-amber-800"
            }`}
          >
            <p className="text-sm font-medium">{notification.message}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex justify-end">
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="btn-primary"
        >
          <svg
            className="size-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          Thêm người dùng
        </button>
      </div>

      <div className="bg-white/60 backdrop-blur-xl rounded-2xl shadow-sm border border-stone-200/60 overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="uppercase tracking-wider border-b border-stone-200/60 bg-stone-50/50">
              <tr>
                <th className="px-6 py-4 text-stone-500 font-semibold text-xs">
                  Email
                </th>
                <th className="px-6 py-4 text-stone-500 font-semibold text-xs">
                  Tên
                </th>
                <th className="px-6 py-4 text-stone-500 font-semibold text-xs">
                  Vai trò
                </th>
                <th className="px-6 py-4 text-stone-500 font-semibold text-xs">
                  Gốc sơ đồ
                </th>
                <th className="px-6 py-4 text-stone-500 font-semibold text-xs">
                  Trạng thái
                </th>
                <th className="px-6 py-4 text-stone-500 font-semibold text-xs">
                  Ngày tạo
                </th>
                <th className="px-6 py-4 text-stone-500 font-semibold text-xs text-right">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {users.map((user) => {
                const displayName = getUserName(user);
                return (
                  <tr
                    key={user.id}
                    className="hover:bg-stone-50/80 transition-colors"
                  >
                    <td className="px-6 py-4 font-medium text-stone-900">
                      {user.email}
                    </td>
                    <td className="px-6 py-4 text-stone-700">
                      {displayName ? (
                        <span>{displayName}</span>
                      ) : (
                        <span className="text-stone-400 italic">Chưa đặt</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {user.id === currentUserId ? (
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${
                            user.role === "admin"
                              ? "bg-amber-100 text-amber-800 border border-amber-200"
                              : user.role === "editor"
                                ? "bg-sky-100 text-sky-800 border border-sky-200"
                                : "bg-stone-100 text-stone-600 border border-stone-200"
                          }`}
                        >
                          {user.role}
                        </span>
                      ) : (
                        <select
                          value={user.role}
                          onChange={(e) =>
                            handleRoleChange(user.id, e.target.value as UserRole)
                          }
                          disabled={loadingId === user.id}
                          className="bg-stone-50 text-stone-700 border border-stone-200 text-xs rounded-md focus:ring-amber-500 focus:border-amber-500 px-2 py-1 hover:border-stone-300 transition-colors disabled:opacity-50 outline-none"
                        >
                          <option value="admin">Admin</option>
                          <option value="editor">Editor</option>
                          <option value="member">Member</option>
                        </select>
                      )}
                    </td>
                    <td className="px-6 py-4 text-stone-600 max-w-[220px] truncate">
                      {getPersonName(persons, user.default_tree_root_id)}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        disabled={
                          loadingId === user.id || user.id === currentUserId
                        }
                        onClick={() =>
                          handleStatusChange(user.id, !user.is_active)
                        }
                        className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                          user.is_active
                            ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                            : "bg-stone-100 text-stone-800 border border-stone-200"
                        } ${
                          user.id !== currentUserId
                            ? "hover:opacity-80 cursor-pointer"
                            : "opacity-50 cursor-not-allowed"
                        } disabled:opacity-50`}
                        title={
                          user.id !== currentUserId
                            ? user.is_active
                              ? "Nhấn để khoá"
                              : "Nhấn để duyệt"
                            : "Không thể thay đổi trạng thái của chính bạn"
                        }
                      >
                        {user.is_active ? "Đã duyệt" : "Chờ duyệt"}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-stone-500">
                      {new Date(user.created_at).toLocaleDateString("vi-VN")}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end items-center gap-2">
                        <button
                          title="Sửa thông tin"
                          disabled={loadingId === user.id}
                          onClick={() => openEditModal(user)}
                          className="p-1.5 text-stone-400 hover:text-amber-700 hover:bg-amber-50 rounded-md transition-colors disabled:opacity-50"
                        >
                          <Pencil className="size-4" />
                        </button>
                        {user.id !== currentUserId && (
                          <button
                            title="Reset mật khẩu"
                            disabled={loadingId === user.id}
                            onClick={() => openResetPasswordModal(user)}
                            className="p-1.5 text-stone-400 hover:text-sky-700 hover:bg-sky-50 rounded-md transition-colors disabled:opacity-50"
                          >
                            <KeyRound className="size-4" />
                          </button>
                        )}
                        {user.id !== currentUserId && (
                          <button
                            title="Xoá người dùng"
                            disabled={loadingId === user.id}
                            onClick={() => handleDelete(user.id)}
                            className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50"
                          >
                            <Trash className="size-4" />
                          </button>
                        )}
                        {user.id === currentUserId && (
                          <span className="text-stone-400 italic text-xs">Bạn</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-8 text-center text-stone-500"
                  >
                    Không tìm thấy người dùng nào.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isCreateModalOpen && (
        <UserFormModal
          title="Tạo Người Dùng Mới"
          persons={sortedPersons}
          defaultTreeRootId={defaultTreeRootId}
          setDefaultTreeRootId={setDefaultTreeRootId}
          onClose={() => {
            setIsCreateModalOpen(false);
            setDefaultTreeRootId(null);
          }}
          onSubmit={handleCreateUser}
          submitLabel={isCreating ? "Đang tạo..." : "Tạo người dùng"}
          disabled={isCreating}
        />
      )}

      {editingUser && (
        <EditUserModal
          user={editingUser}
          persons={sortedPersons}
          editRootId={editRootId}
          setEditRootId={setEditRootId}
          onClose={closeEditModal}
          onSubmit={handleEditUser}
          disabled={isEditing}
        />
      )}

      {resetUser && (
        <ResetPasswordModal
          user={resetUser}
          onClose={closeResetPasswordModal}
          onSubmit={handleResetPassword}
          disabled={isResettingPassword}
        />
      )}
    </div>
  );
}

function ModalShell({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm transition-opacity duration-300">
      <div className="bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-stone-200/60 w-full max-w-xl overflow-hidden transform transition-all">
        <div className="px-6 py-5 border-b border-stone-100/80 flex justify-between items-center bg-stone-50/50">
          <h3 className="text-xl font-serif font-bold text-stone-800">
            {title}
          </h3>
          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 transition-colors size-8 flex items-center justify-center hover:bg-stone-100 rounded-full"
          >
            <X className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function UserFormModal({
  title,
  persons,
  defaultTreeRootId,
  setDefaultTreeRootId,
  onClose,
  onSubmit,
  submitLabel,
  disabled,
}: {
  title: string;
  persons: Person[];
  defaultTreeRootId: string | null;
  setDefaultTreeRootId: (id: string | null) => void;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  submitLabel: string;
  disabled: boolean;
}) {
  return (
    <ModalShell title={title} onClose={onClose}>
      <form onSubmit={onSubmit} className="p-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              name="email"
              required
              className="w-full px-3 py-2 sm:py-2.5 bg-white text-stone-900 placeholder-stone-400 border border-stone-300 rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 transition-colors"
              placeholder="email@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Tên hiển thị
            </label>
            <input
              type="text"
              name="full_name"
              className="w-full px-3 py-2 sm:py-2.5 bg-white text-stone-900 placeholder-stone-400 border border-stone-300 rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 transition-colors"
              placeholder="Ví dụ: Nguyễn Văn A"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Mật khẩu <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              name="password"
              required
              minLength={6}
              className="w-full px-3 py-2 sm:py-2.5 bg-white text-stone-900 placeholder-stone-400 border border-stone-300 rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 transition-colors"
              placeholder="Ít nhất 6 ký tự"
            />
          </div>

          <RoleStatusFields />

          <div>
            <input
              type="hidden"
              name="default_tree_root_id"
              value={defaultTreeRootId ?? ""}
            />
            <PersonSelector
              persons={persons}
              selectedId={defaultTreeRootId}
              onSelect={setDefaultTreeRootId}
              label="Gốc gia phả mặc định"
              placeholder="Chưa chọn gốc gia phả"
              className="w-full"
            />
            <p className="mt-2 text-xs leading-relaxed text-stone-500">
              Gốc này dùng chung cho Cây gia phả, Mindmap và Bong bóng. Người dùng vẫn có thể tự đổi trong Cài đặt tài khoản.
            </p>
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn">
            Hủy
          </button>
          <button type="submit" disabled={disabled} className="btn-primary">
            {submitLabel}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function EditUserModal({
  user,
  persons,
  editRootId,
  setEditRootId,
  onClose,
  onSubmit,
  disabled,
}: {
  user: AdminUserData;
  persons: Person[];
  editRootId: string | null;
  setEditRootId: (id: string | null) => void;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  disabled: boolean;
}) {
  return (
    <ModalShell title="Sửa thông tin người dùng" onClose={onClose}>
      <form onSubmit={onSubmit} className="p-6">
        <input type="hidden" name="user_id" value={user.id} />
        <div className="space-y-4">
          <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
            Thay đổi email có thể yêu cầu người dùng xác nhận email mới tuỳ cấu hình Supabase Auth.
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              name="email"
              required
              defaultValue={user.email}
              className="w-full px-3 py-2 sm:py-2.5 bg-white text-stone-900 placeholder-stone-400 border border-stone-300 rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Tên hiển thị
            </label>
            <input
              type="text"
              name="full_name"
              defaultValue={getUserName(user)}
              className="w-full px-3 py-2 sm:py-2.5 bg-white text-stone-900 placeholder-stone-400 border border-stone-300 rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 transition-colors"
              placeholder="Ví dụ: Nguyễn Văn A"
            />
          </div>

          <RoleStatusFields defaultRole={user.role} defaultActive={user.is_active} />

          <div>
            <input
              type="hidden"
              name="default_tree_root_id"
              value={editRootId ?? ""}
            />
            <PersonSelector
              persons={persons}
              selectedId={editRootId}
              onSelect={setEditRootId}
              label="Gốc gia phả mặc định"
              placeholder="Chưa chọn gốc gia phả"
              className="w-full"
            />
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn">
            Hủy
          </button>
          <button type="submit" disabled={disabled} className="btn-primary">
            {disabled ? "Đang lưu..." : "Lưu thay đổi"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function RoleStatusFields({
  defaultRole = "member",
  defaultActive = true,
}: {
  defaultRole?: UserRole;
  defaultActive?: boolean;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <label className="block text-sm font-medium text-stone-700 mb-1">
          Vai trò
        </label>
        <select
          name="role"
          className="w-full px-3 py-2 sm:py-2.5 bg-white text-stone-900 placeholder-stone-400 border border-stone-300 rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 transition-colors"
          defaultValue={defaultRole}
        >
          <option value="member">Thành viên</option>
          <option value="editor">Biên tập</option>
          <option value="admin">Quản trị viên</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-stone-700 mb-1">
          Trạng thái
        </label>
        <select
          name="is_active"
          className="w-full px-3 py-2 sm:py-2.5 bg-white text-stone-900 placeholder-stone-400 border border-stone-300 rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 transition-colors"
          defaultValue={defaultActive ? "true" : "false"}
        >
          <option value="true">Đã duyệt</option>
          <option value="false">Chờ duyệt</option>
        </select>
      </div>
    </div>
  );
}

function ResetPasswordModal({
  user,
  onClose,
  onSubmit,
  disabled,
}: {
  user: AdminUserData;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  disabled: boolean;
}) {
  return (
    <ModalShell title="Reset mật khẩu" onClose={onClose}>
      <form onSubmit={onSubmit} className="p-6">
        <input type="hidden" name="user_id" value={user.id} />
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl border border-sky-100 bg-sky-50 px-3 py-3 text-sm text-sky-900">
            <UserRound className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-semibold">{user.email}</p>
              <p className="mt-1 text-xs leading-relaxed text-sky-800/80">
                Sau khi lưu, người dùng sẽ đăng nhập bằng mật khẩu mới.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Mật khẩu mới <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              name="password"
              required
              minLength={6}
              className="w-full px-3 py-2 sm:py-2.5 bg-white text-stone-900 placeholder-stone-400 border border-stone-300 rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 transition-colors"
              placeholder="Ít nhất 6 ký tự"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              Nhập lại mật khẩu mới <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              name="confirm_password"
              required
              minLength={6}
              className="w-full px-3 py-2 sm:py-2.5 bg-white text-stone-900 placeholder-stone-400 border border-stone-300 rounded-lg shadow-sm focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 transition-colors"
            />
          </div>
        </div>

        <div className="mt-8 flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn">
            Hủy
          </button>
          <button type="submit" disabled={disabled} className="btn-primary">
            {disabled ? "Đang reset..." : "Reset mật khẩu"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

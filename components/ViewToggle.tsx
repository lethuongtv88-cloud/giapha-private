"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { Circle, GitBranch, List, ListTree, Network, Users } from "lucide-react";
import { useMemberListView } from "@/context/MemberListContext";
import { useUser } from "@/components/UserProvider";

export type ViewMode = "list" | "tree" | "mindmap" | "bubble" | "noi-ngoai" | "sui-gia";

// Nội Ngoại và Sui gia chưa hoàn thiện — tạm chỉ cho admin truy cập.
const ADMIN_ONLY_VIEWS: ViewMode[] = ["noi-ngoai", "sui-gia"];

export default function ViewToggle() {
  const { view: currentView, setView } = useMemberListView();
  const { profile } = useUser();
  const isAdmin = profile?.role === "admin";

  // Nếu đang ở 1 view chỉ-dành-cho-admin (ví dụ do URL cũ ?view=noi-ngoai)
  // nhưng tài khoản không phải admin, tự chuyển về Sơ đồ cây.
  useEffect(() => {
    if (!isAdmin && ADMIN_ONLY_VIEWS.includes(currentView)) {
      setView("tree");
    }
  }, [isAdmin, currentView, setView]);

  const allTabs = [
    {
      id: "list",
      label: "Danh sách",
      icon: <List className="size-6 sm:size-4" />,
    },
    {
      id: "tree",
      label: "Sơ đồ cây",
      icon: <Network className="size-6 sm:size-4" />,
    },
    {
      id: "mindmap",
      label: "Mindmap",
      icon: <ListTree className="size-6 sm:size-4" />,
    },
    {
      id: "bubble",
      label: "Bong bóng",
      icon: <Circle className="size-6 sm:size-4" />,
    },
    {
      id: "noi-ngoai",
      label: "Nội Ngoại",
      icon: <GitBranch className="size-6 sm:size-4" />,
    },
    {
      id: "sui-gia",
      label: "Sui gia",
      icon: <Users className="size-6 sm:size-4" />,
    },
  ] as const;

  const tabs = allTabs.filter((tab) => isAdmin || !ADMIN_ONLY_VIEWS.includes(tab.id));

  return (
    <div className="flex bg-stone-200/50 p-1.5 rounded-full shadow-inner w-fit mx-auto mt-4 mb-2 relative border border-stone-200/60 backdrop-blur-sm z-10">
      {tabs.map((tab) => {
        const isActive = currentView === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => setView(tab.id as ViewMode)}
            className={`relative px-4 sm:px-6 py-1.5 sm:py-2.5 text-sm font-semibold rounded-full transition-colors duration-300 ease-in-out z-10 flex items-center gap-2 ${isActive
              ? "text-stone-900"
              : "text-stone-500 hover:text-stone-800"
              }`}
          >
            {isActive && (
              <motion.div
                layoutId="activeTab"
                className="absolute inset-0 bg-white rounded-full shadow-sm border border-stone-200/60 z-[-1]"
                transition={{ type: "spring", stiffness: 450, damping: 30 }}
              />
            )}
            <span
              className={`transition-colors duration-300 ${isActive ? "text-amber-700" : "text-stone-400"}`}
            >
              {tab.icon}
            </span>
            <span className="hidden sm:block tracking-wide">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

"use client";

import { useMemberListView } from "@/context/MemberListContext";
import MemberList from "@/components/MemberList";
import PersonSelector from "@/components/PersonSelector";
import { Person, Relationship } from "@/types";
import { useEffect, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { featureFlags } from "@/lib/featureFlags";
import { useUser } from "@/components/UserProvider";
import {
  getRootPreferenceAccountKey,
  readRootPreference,
  writeRootPreference,
  type RootPreferenceKind,
} from "@/utils/preferences/rootPreferences";

const FamilyTree = dynamic(() => import("@/components/FamilyTree"));
const VietnameseFamilyTree = dynamic(
  () => import("@/components/VietnameseFamilyTree"),
  {
    ssr: false,
  },
);
const MindmapTree = dynamic(() => import("@/components/MindmapTree"));
const BubbleMapTree = dynamic(
  () =>
    import("@/components/BubbleMapTree").catch((err) => {
      console.error("Failed to load BubbleMapTree:", err);
      return {
        default: () => (
          <div className="flex absolute inset-0 items-center justify-center p-4 text-center bg-stone-50 rounded-2xl border border-stone-200/60 shadow-inner text-stone-500">
            Tính năng này không được hỗ trợ trên trình duyệt của bạn. Vui lòng cập nhật hoặc sử dụng trình duyệt khác.
          </div>
        ),
      };
    }),
  { ssr: false },
);

type FamilyRow = {
  id: string;
  type?: string | null;
  status?: string | null;
  start_year?: number | null;
  end_year?: number | null;
  note?: string | null;
  legacy_relationship_id?: string | null;
  version?: number | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type FamilyParentRow = {
  id: string;
  family_id: string;
  person_id: string;
  role?: string | null;
  sort_order?: number | null;
};

type FamilyChildRow = {
  id: string;
  family_id: string;
  person_id: string;
  relationship_type?: string | null;
  sort_order?: number | null;
  legacy_relationship_id?: string | null;
  migration_confidence?: string | null;
};

type MembersViewsProps = {
  persons: Person[];
  relationships: Relationship[];
  families?: FamilyRow[];
  familyParents?: FamilyParentRow[];
  familyChildren?: FamilyChildRow[];
  canEdit?: boolean;
  allowedPersonIds?: string[] | null;
};

export default function MembersViews({
  persons,
  relationships,
  families = [],
  familyParents = [],
  familyChildren = [],
  canEdit,
  allowedPersonIds = null,
}: MembersViewsProps) {
  const { view: currentView, rootId, setView, setRootId } = useMemberListView();
  const searchParams = useSearchParams();
  const { user } = useUser();
  const accountKey = getRootPreferenceAccountKey({
    userId: user?.id,
    email: user?.email,
  });
  const hasRestored = useRef(false);
  const allowedPersonIdSet = useMemo(
    () => (allowedPersonIds ? new Set(allowedPersonIds) : null),
    [allowedPersonIds],
  );

  // Prepare map and roots for tree views
  const { personsMap, roots, defaultRootId } = useMemo(() => {
    const pMap = new Map<string, Person>();
    persons.forEach((p) => pMap.set(p.id, p));

    const childIds = new Set(
      relationships
        .filter(
          (r) => r.type === "biological_child" || r.type === "adopted_child",
        )
        .map((r) => r.person_b),
    );

    let finalRootId = rootId;

    // If no rootId is provided, fallback to generation 1 or earliest birth year
    if (!finalRootId || !pMap.has(finalRootId)) {
      const rootsFallback = persons.filter((p) => !childIds.has(p.id));
      if (rootsFallback.length > 0) {
        const gen1 = rootsFallback.filter((p) => p.generation === 1);
        const sortByBirthYear = (a: Person, b: Person) => {
          const ya = a.birth_year ?? Infinity;
          const yb = b.birth_year ?? Infinity;
          return ya - yb;
        };

        if (gen1.length > 0) {
          finalRootId = gen1.sort(sortByBirthYear)[0].id;
        } else {
          finalRootId = rootsFallback.sort(sortByBirthYear)[0].id;
        }
      } else if (persons.length > 0) {
        finalRootId = persons[0].id; // ultimate fallback
      }
    }

    let calculatedRoots: Person[] = [];
    if (finalRootId && pMap.has(finalRootId)) {
      calculatedRoots = [pMap.get(finalRootId)!];
    }

    return {
      personsMap: pMap,
      roots: calculatedRoots,
      defaultRootId: finalRootId,
    };
  }, [persons, relationships, rootId]);

  const activeRootId = rootId || defaultRootId;

  // Cây gia phả, Mindmap và Bong bóng dùng chung rootId của trang thành viên,
  // nên chỉ dùng một gốc mặc định chung: "Gốc sơ đồ".
  const currentRootPreferenceKind: RootPreferenceKind = "tree";

  // Khôi phục lựa chọn từ localStorage
  useEffect(() => {
    if (hasRestored.current) return;

    const urlRootId = searchParams.get("rootId");

    if (!urlRootId) {
      try {
        const savedRootId =
          readRootPreference(currentRootPreferenceKind, accountKey) ||
          localStorage.getItem("members_rootId");

        if (
          savedRootId &&
          savedRootId !== rootId &&
          persons.some((person) => person.id === savedRootId) &&
          (!allowedPersonIdSet || allowedPersonIdSet.has(savedRootId))
        ) {
          setRootId(savedRootId);
        }
      } catch (e) {
        console.warn("Failed to read root preference:", e);
      }
    }

    hasRestored.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lưu lựa chọn vào localStorage
  useEffect(() => {
    if (!hasRestored.current) return;

    const timeout = setTimeout(() => {
      try {
        if (activeRootId) {
          writeRootPreference(currentRootPreferenceKind, accountKey, activeRootId);
        }
      } catch (e) {
        console.warn("Failed to write root preference:", e);
      }
    }, 100);

    return () => clearTimeout(timeout);
  }, [currentView, activeRootId, currentRootPreferenceKind, accountKey]);

  return (
    <>
      <main className="flex-1 overflow-auto bg-stone-50/50 flex flex-col">
        {currentView !== "list" && persons.length > 0 && activeRootId && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-2 w-full flex flex-col sm:flex-row flex-wrap items-center sm:justify-between gap-4 relative z-20">
            <PersonSelector
              persons={persons}
              selectedId={activeRootId}
              onSelect={(id) => {
                if (id) setRootId(id);
              }}
              label="Người gốc"
              placeholder="Tìm người gốc..."
              className="w-full sm:w-80"
            />
            <div
              id="tree-toolbar-portal"
              className="flex items-center gap-2 flex-wrap justify-center"
            />
          </div>
        )}

        {currentView === "list" && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full relative z-10">
            <MemberList
              initialPersons={persons}
              relationships={relationships}
              canEdit={canEdit}
            />
          </div>
        )}

        <div className="flex-1 w-full relative z-10">
          {currentView === "tree" &&
           (featureFlags.vietnameseTreeLayout ? (
             <VietnameseFamilyTree
               personsMap={personsMap}
               relationships={relationships}
               families={families}
               familyParents={familyParents}
               familyChildren={familyChildren}
               roots={roots}
               canEdit={canEdit}
             />
          ) : (
             <FamilyTree
              personsMap={personsMap}
              relationships={relationships}
              roots={roots}
              canEdit={canEdit}
             />
        ))}
          {currentView === "mindmap" && (
            <MindmapTree
              personsMap={personsMap}
              relationships={relationships}
              roots={roots}
              canEdit={canEdit}
            />
          )}
          {currentView === "bubble" && (
            <BubbleMapTree
              personsMap={personsMap}
              relationships={relationships}
              roots={roots}
              canEdit={canEdit}
            />
          )}
        </div>
      </main>
    </>
  );
}

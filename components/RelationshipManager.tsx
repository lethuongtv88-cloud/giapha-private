"use client";

import { MemberListContext, useMemberListView } from "@/context/MemberListContext";
import { Person, RelationshipType } from "@/types";
import { formatDisplayDate } from "@/utils/dateHelpers";
import { getAvatarBg } from "@/utils/styleHelprs";
import { createClient } from "@/utils/supabase/client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import DefaultAvatar from "./DefaultAvatar";
import { ensureFamilyModelChild } from "@/utils/family/ensureFamilyModelChild";
import { createFamilyEvent } from "@/app/actions/events";

interface RelationshipManagerProps {
  person: Person;
  isAdmin: boolean;
  canEdit?: boolean;
  allowedPersonIds?: string[] | null;
  /**
   * Phạm vi được phép THAY ĐỔI (thêm/sửa/xoá quan hệ) - có thể hẹp hơn
   * allowedPersonIds (phạm vi xem) khi tài khoản được admin gán rootedit.
   * Nếu không truyền, mặc định dùng allowedPersonIds (hành vi cũ).
   */
  editablePersonIds?: string[] | null;
  onStatsLoaded?: (stats: {
    biologicalChildren: number;
    maleBiologicalChildren: number;
    femaleBiologicalChildren: number;
    paternalGrandchildren: number;
    maternalGrandchildren: number;
    sonInLaw: number;
    daughterInLaw: number;
  }) => void;
}

interface EnrichedRelationship {
  id: string;
  type: RelationshipType;
  direction: "parent" | "child" | "spouse" | "child_in_law";
  targetPerson: Person;
  note: string | null;
  status?: string | null;
  ended_at?: string | null;
  divorce_note?: string | null;
}

export default function RelationshipManager({
  person,
  isAdmin,
  canEdit = false,
  allowedPersonIds = null,
  editablePersonIds = null,
  onStatsLoaded,
}: RelationshipManagerProps) {
  const supabase = createClient();
  const memberListContext = useContext(MemberListContext);
  const { setMemberModalId } = useMemberListView();
  const router = useRouter();

  const personId = person.id;
  const personGender = person.gender;
  const allowedPersonIdSet = useMemo(
    () => (allowedPersonIds ? new Set(allowedPersonIds) : null),
    [allowedPersonIds],
  );
  const isAllowedPerson = useCallback(
    (id: string | null | undefined) =>
      !allowedPersonIdSet || Boolean(id && allowedPersonIdSet.has(id)),
    [allowedPersonIdSet],
  );

  const editablePersonIdSet = useMemo(
    () => (editablePersonIds ? new Set(editablePersonIds) : allowedPersonIdSet),
    [editablePersonIds, allowedPersonIdSet],
  );
  const isEditablePerson = useCallback(
    (id: string | null | undefined) =>
      !editablePersonIdSet || Boolean(id && editablePersonIdSet.has(id)),
    [editablePersonIdSet],
  );

  const denyWrite = useCallback((message = "Bạn không có quyền sửa dữ liệu này.") => {
    setError(message);
    setTimeout(() => setError(null), 5000);
  }, []);

  const canWriteCurrentPerson = useCallback(() => {
    if (!canEdit || !isEditablePerson(personId)) {
      denyWrite(
        "Bạn không có quyền sửa người ngoài phạm vi được phép chỉnh sửa (gốc chỉnh sửa).",
      );
      return false;
    }
    return true;
  }, [canEdit, denyWrite, isEditablePerson, personId]);

  // If inside DashboardProvider → open modal; otherwise → navigate to full page
  const handlePersonClick = (id: string) => {
    if (memberListContext !== undefined) {
      setMemberModalId(id);
    } else {
      router.push(`/dashboard/members/${id}`);
    }
  };

  const [relationships, setRelationships] = useState<EnrichedRelationship[]>(
    [],
  );
  const [loading, setLoading] = useState(true);

  // Add Relationship State
  const [isAdding, setIsAdding] = useState(false);
  const [newRelType, setNewRelType] =
    useState<RelationshipType>("biological_child");
  const [newRelDirection, setNewRelDirection] = useState<
    "parent" | "child" | "spouse"
  >("parent");
  const [newRelNote, setNewRelNote] = useState("");
  const [newMarriageDate, setNewMarriageDate] = useState("");
  const [newMarriageDatePrecision, setNewMarriageDatePrecision] = useState<"day" | "month" | "year" | "unknown">("unknown");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<Person[]>([]);
  const [recentMembers, setRecentMembers] = useState<Person[]>([]);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bulk Add State
  const [isAddingBulk, setIsAddingBulk] = useState(false);
  const [selectedSpouseId, setSelectedSpouseId] = useState<string>("");
  const [bulkChildren, setBulkChildren] = useState<
    {
      name: string;
      gender: "male" | "female" | "other";
      birthYear: string;
      birthOrder: string;
      isProcessing: boolean;
    }[]
  >([
    {
      name: "",
      gender: "male",
      birthYear: "",
      birthOrder: "1",
      isProcessing: false,
    },
  ]);

  // Quick Add Spouse State
  const [isAddingSpouse, setIsAddingSpouse] = useState(false);
  const [newSpouseName, setNewSpouseName] = useState("");
  const [newSpouseBirthYear, setNewSpouseBirthYear] = useState("");
  const [newSpouseNote, setNewSpouseNote] = useState("");
  const [newSpouseMarriageDate, setNewSpouseMarriageDate] = useState("");
  const [newSpouseMarriageDatePrecision, setNewSpouseMarriageDatePrecision] = useState<"day" | "month" | "year" | "unknown">("unknown");

  // Add Parent State
  const [isAddingParent, setIsAddingParent] = useState(false);
  const [newParentName, setNewParentName] = useState("");
  const [newParentGender, setNewParentGender] = useState<"male" | "female">("male");
  const [newParentBirthYear, setNewParentBirthYear] = useState("");
  const [newParentRelType, setNewParentRelType] = useState<
    "biological_child" | "adopted_child"
  >("biological_child");
  const [newParentNote, setNewParentNote] = useState("");

  const [divorceRel, setDivorceRel] = useState<EnrichedRelationship | null>(null);
  const [divorceDate, setDivorceDate] = useState("");
  const [divorceDatePrecision, setDivorceDatePrecision] = useState<"day" | "month" | "year" | "unknown">("unknown");
  const [divorceNote, setDivorceNote] = useState("");

  const buildFamilyEventFormData = ({
    type,
    personAId,
    personBId,
    familyId,
    dateText,
    datePrecision,
    description,
  }: {
    type: "marriage" | "divorce";
    personAId: string;
    personBId: string;
    familyId?: string | null;
    dateText: string;
    datePrecision: string;
    description?: string | null;
  }) => {
    const formData = new FormData();
    formData.set("type", type);
    formData.set("person_a_id", personAId);
    formData.set("person_b_id", personBId);
    if (familyId) formData.set("family_id", familyId);
    formData.set("date_text", dateText.trim());
    formData.set("date_precision", dateText.trim() ? datePrecision : "unknown");
    formData.set("title", type === "marriage" ? "Kết hôn" : "Ly hôn");
    if (description?.trim()) formData.set("description", description.trim());
    return formData;
  };

  const saveFamilyEvent = async (input: {
    type: "marriage" | "divorce";
    personAId: string;
    personBId: string;
    familyId?: string | null;
    dateText: string;
    datePrecision: string;
    description?: string | null;
  }) => {
    if (!input.dateText.trim() && !input.description?.trim()) return;

    const result = await createFamilyEvent(buildFamilyEventFormData(input));
    if (result?.error) {
      throw new Error(result.error);
    }
  };

  // Fetch relationships
  const fetchRelationships = useCallback(async () => {
    try {
      // Get all relationships where this person involved
      // This is a bit complex because we need to check both a and b columns
      const { data: relsA, error: errA } = await supabase
        .from("relationships")
        .select(`*, target:persons!person_b(*)`) // if I am A, target is B
        .eq("person_a", personId)
        .is("deleted_at", null);

      const { data: relsB, error: errB } = await supabase
       .from("relationships")
       .select(`*, target:persons!person_a(*)`) // if I am B, target is A
       .eq("person_b", personId)
       .is("deleted_at", null);

      if (errA || errB) throw errA || errB;

      const formattedRels: EnrichedRelationship[] = [];

      // Process Rels where I am Person A
      relsA?.forEach((r) => {
        if (!isAllowedPerson(r.target?.id)) return;
        let direction: "parent" | "child" | "spouse" = "spouse";
        if (r.type === "marriage") direction = "spouse";
        else if (r.type === "biological_child" || r.type === "adopted_child")
          direction = "child"; // I am A (Parent), B is Child

        formattedRels.push({
          id: r.id,
          type: r.type,
          direction,
          targetPerson: r.target,
          note: r.note,
          status: r.status,
          ended_at: r.ended_at,
          divorce_note: r.divorce_note,
        });
      });

      // Process Rels where I am Person B
      relsB?.forEach((r) => {
        if (!isAllowedPerson(r.target?.id)) return;
        let direction: "parent" | "child" | "spouse" = "spouse";
        if (r.type === "marriage") direction = "spouse";
        else if (r.type === "biological_child" || r.type === "adopted_child")
          direction = "parent"; // I am B (Child), A is Parent

        formattedRels.push({
          id: r.id,
          type: r.type,
          direction,
          targetPerson: r.target,
          note: r.note,
          status: r.status,
          ended_at: r.ended_at,
          divorce_note: r.divorce_note,
        });
      });

      // Family Model fallback: fetch parents via two-step query.
      // Legacy relationships may be incomplete after migration, while the tree uses Family Model.
      const { data: childFamilyRows, error: childFamilyError } = await supabase
        .from("family_children")
        .select("family_id")
        .eq("person_id", personId);

      if (childFamilyError) throw childFamilyError;

      const familyIds = Array.from(
        new Set((childFamilyRows ?? []).map((row: any) => row.family_id).filter(Boolean)),
      );

      if (familyIds.length > 0) {
        const { data: familyParentRows, error: familyParentError } = await supabase
          .from("family_parents")
          .select("id, family_id, role, person_id")
          .in("family_id", familyIds);

        if (familyParentError) throw familyParentError;

        const parentIds = Array.from(
          new Set(
            (familyParentRows ?? [])
              .map((row: any) => row.person_id)
              .filter((id: string | null) => Boolean(id) && isAllowedPerson(id)),
          ),
        );

        const { data: parentPeople, error: parentPeopleError } =
          parentIds.length > 0
            ? await supabase
                .from("persons")
                .select(`
                  id,
                  full_name,
                  gender,
                  birth_year,
                  birth_month,
                  birth_day,
                  death_year,
                  death_month,
                  death_day,
                  avatar_url,
                  note,
                  created_at,
                  updated_at,
                  is_deceased,
                  is_in_law,
                  birth_order,
                  generation,
                  other_names
                `)
                .in("id", parentIds)
            : { data: [], error: null };

        if (parentPeopleError) throw parentPeopleError;

        const parentById = new Map(
          (parentPeople ?? []).map((parent: any) => [parent.id, parent]),
        );

        const existingParentIds = new Set(
          formattedRels
            .filter((rel) => rel.direction === "parent")
            .map((rel) => rel.targetPerson.id),
        );

        familyParentRows?.forEach((parentRow: any) => {
          const parent = parentById.get(parentRow.person_id);
          if (!parent?.id) return;
          if (existingParentIds.has(parent.id)) return;

          formattedRels.push({
            id: `family-parent:${parentRow.family_id}:${parent.id}`,
            type: "biological_child",
            direction: "parent",
            targetPerson: parent,
            note:
              parent.gender === "male"
                ? "Cha"
                : parent.gender === "female"
                  ? "Mẹ"
                  : parentRow.role || null,
          });

          existingParentIds.add(parent.id);
        });
      }

      // Family Model fallback: fetch children via family_parents -> family_children.
      // This fixes the reverse direction where mother/father should see children even if legacy relationships are incomplete.
      const { data: parentFamilyRows, error: parentFamilyError } = await supabase
        .from("family_parents")
        .select("family_id")
        .eq("person_id", personId);

      if (parentFamilyError) throw parentFamilyError;

      const parentFamilyIds = Array.from(
        new Set((parentFamilyRows ?? []).map((row: any) => row.family_id).filter(Boolean)),
      );

      if (parentFamilyIds.length > 0) {
        const { data: familyChildRows, error: familyChildError } = await supabase
          .from("family_children")
          .select("id, family_id, person_id")
          .in("family_id", parentFamilyIds);

        if (familyChildError) throw familyChildError;

        const childIdsFromFamilyModel = Array.from(
          new Set(
            (familyChildRows ?? [])
              .map((row: any) => row.person_id)
              .filter(
                (id: string | null) =>
                  Boolean(id) && id !== personId && isAllowedPerson(id),
              ),
          ),
        );

        const { data: childPeople, error: childPeopleError } =
          childIdsFromFamilyModel.length > 0
            ? await supabase
                .from("persons")
                .select(`
                  id,
                  full_name,
                  gender,
                  birth_year,
                  birth_month,
                  birth_day,
                  death_year,
                  death_month,
                  death_day,
                  avatar_url,
                  note,
                  created_at,
                  updated_at,
                  is_deceased,
                  is_in_law,
                  birth_order,
                  generation,
                  other_names
                `)
                .in("id", childIdsFromFamilyModel)
            : { data: [], error: null };

        if (childPeopleError) throw childPeopleError;

        const childById = new Map(
          (childPeople ?? []).map((child: any) => [child.id, child]),
        );

        const existingChildIds = new Set(
          formattedRels
            .filter((rel) => rel.direction === "child")
            .map((rel) => rel.targetPerson.id),
        );

        familyChildRows?.forEach((childRow: any) => {
          const child = childById.get(childRow.person_id);
          if (!child?.id) return;
          if (existingChildIds.has(child.id)) return;

          formattedRels.push({
            id: `family-child:${childRow.family_id}:${child.id}`,
            type: "biological_child",
            direction: "child",
            targetPerson: child,
            note: "Con",
          });

          existingChildIds.add(child.id);
        });
      }

      // Fetch in-laws (spouses of children)
      const childrenIds = formattedRels
        .filter((r) => r.direction === "child")
        .map((r) => r.targetPerson.id);

      if (childrenIds.length > 0) {
        const { data: childrenMarriages } = await supabase
         .from("relationships")
         .select(
           `*, person_a_data:persons!person_a(*), person_b_data:persons!person_b(*)`,
         )
         .eq("type", "marriage")
         .is("deleted_at", null)
         .or(
           `person_a.in.(${childrenIds.join(",")}),person_b.in.(${childrenIds.join(",")})`,
         );

        if (childrenMarriages) {
          childrenMarriages.forEach((m) => {
            const isAChild = childrenIds.includes(m.person_a);
            const childPerson = isAChild ? m.person_a_data : m.person_b_data;
            const spousePerson = isAChild ? m.person_b_data : m.person_a_data;

            if (spousePerson && childPerson && isAllowedPerson(spousePerson.id)) {
              const spouseGender = spousePerson.gender;
              let noteLabel = `Vợ/chồng của ${childPerson.full_name}`;
              if (spouseGender === "female")
                noteLabel = `Con dâu (vợ của ${childPerson.full_name})`;
              if (spouseGender === "male")
                noteLabel = `Con rể (chồng của ${childPerson.full_name})`;

              // Append existing marriage note if any
              if (m.note) noteLabel += ` - ${m.note}`;

              formattedRels.push({
                id: m.id + "_inlaw",
                type: "marriage",
                direction: "child_in_law",
                targetPerson: spousePerson,
                note: noteLabel,
                status: m.status,
                ended_at: m.ended_at,
                divorce_note: m.divorce_note,
              });
            }
          });
        }
      }

      if (onStatsLoaded) {
        const biologicalChildrenList = formattedRels.filter(
          (r) => r.direction === "child" && r.type === "biological_child",
        );
        const biologicalChildren = biologicalChildrenList.length;
        const maleBiologicalChildren = biologicalChildrenList.filter(
          (c) => c.targetPerson.gender === "male",
        ).length;
        const femaleBiologicalChildren = biologicalChildrenList.filter(
          (c) => c.targetPerson.gender === "female",
        ).length;

        const daughterInLaw = formattedRels.filter(
          (r) =>
            r.direction === "child_in_law" &&
            r.targetPerson.gender === "female",
        ).length;
        const sonInLaw = formattedRels.filter(
          (r) =>
            r.direction === "child_in_law" && r.targetPerson.gender === "male",
        ).length;

        // Fetch Grandchildren mapping
        let paternalGrandchildren = 0;
        let maternalGrandchildren = 0;
        if (childrenIds.length > 0) {
          const { data: grandchildrenData } = await supabase
            .from("relationships")
            .select("id, person_a")
            .in("type", ["biological_child", "adopted_child"])
            .in("person_a", childrenIds)
            .is("deleted_at", null);

          if (grandchildrenData) {
            const maleChildrenIds = formattedRels
              .filter(
                (r) =>
                  r.direction === "child" && r.targetPerson.gender === "male",
              )
              .map((r) => r.targetPerson.id);
            const femaleChildrenIds = formattedRels
              .filter(
                (r) =>
                  r.direction === "child" && r.targetPerson.gender === "female",
              )
              .map((r) => r.targetPerson.id);

            paternalGrandchildren = grandchildrenData.filter((g) =>
              maleChildrenIds.includes(g.person_a),
            ).length;
            maternalGrandchildren = grandchildrenData.filter((g) =>
              femaleChildrenIds.includes(g.person_a),
            ).length;
          }
        }

        onStatsLoaded({
          biologicalChildren,
          maleBiologicalChildren,
          femaleBiologicalChildren,
          paternalGrandchildren,
          maternalGrandchildren,
          sonInLaw,
          daughterInLaw,
        });
      }

      setRelationships(
        formattedRels.filter((rel) => isAllowedPerson(rel.targetPerson?.id)),
      );
    } catch (err) {
      console.error("Error fetching relationships:", err);
    } finally {
      setLoading(false);
    }
  }, [personId, supabase, onStatsLoaded, isAllowedPerson]);

  useEffect(() => {
    fetchRelationships();
  }, [fetchRelationships]);

  // Search for people to add
  useEffect(() => {
    const searchPeople = async () => {
      if (searchTerm.length < 2) {
        setSearchResults([]);
        return;
      }

      const { data, error } = await supabase.rpc("search_persons_unaccent", {
        search_text: searchTerm,
        exclude_person_id: personId,
        limit_count: 5,
      });

      if (error) {
        console.error("Error searching people:", error);
        setSearchResults([]);
        return;
      }

      if (data) {
        setSearchResults(
          data.filter((candidate: { id: string }) => isAllowedPerson(candidate.id)),
        );
      }
    };

    const timeoutId = setTimeout(searchPeople, 300);
    return () => clearTimeout(timeoutId);
  }, [searchTerm, personId, supabase, isAllowedPerson]);

  // Fetch recent members when opening Add form
  useEffect(() => {
    if (isAdding && recentMembers.length === 0) {
      const fetchRecent = async () => {
        const { data } = await supabase
          .from("persons_active")
          .select("*")
          .neq("id", personId)
          .order("created_at", { ascending: false })
          .limit(10);
        if (data) {
          setRecentMembers(data.filter((candidate) => isAllowedPerson(candidate.id)));
        }
      };
      fetchRecent();
    }
  }, [isAdding, personId, supabase, recentMembers.length, isAllowedPerson]);

  const handleAddRelationship = async () => {
    if (!canWriteCurrentPerson()) return;
    if (!selectedTargetId) return;
    if (!isAllowedPerson(selectedTargetId)) {
      setError("Bạn không có quyền tạo quan hệ với người ngoài nhánh được phép xem.");
      setTimeout(() => setError(null), 5000);
      return;
    }
    setProcessing(true);
    setError(null);

    try {
      let personA = personId;
      let personB = selectedTargetId;
      // Default: I am A, Target is B.

      // Setup payload based on logic
      // Marriage: Order doesn't strictly matter logically, but consistency is good.
      // Parent/Child:
      //    Relationship Type: biological_child
      //    Column A: Parent
      //    Column B: Child

      if (newRelDirection === "parent") {
        // Target is Parent (A), I am Child (B)
        personA = selectedTargetId;
        personB = personId;
      } else if (newRelDirection === "child") {
        // I am Parent (A), Target is Child (B)
        personA = personId;
        personB = selectedTargetId;
      }

      // Determine Type
      let type: RelationshipType = "biological_child";
      if (newRelDirection === "spouse") type = "marriage";
      else if (newRelType === "adopted_child") type = "adopted_child";

      const { data: insertedRelationship, error } = await supabase
        .from("relationships")
        .insert({
          person_a: personA,
          person_b: personB,
          type: type,
          note: newRelNote ? newRelNote : null,
        })
        .select("id")
        .single();

      if (error) throw error;

      if (newRelDirection === "spouse") {
        try {
          const familyId = await ensureFamilyModelMarriage({
            supabase,
            personId,
            targetPersonId: selectedTargetId,
            legacyRelationshipId: insertedRelationship?.id ?? null,
            note: newRelNote ? newRelNote : null,
          });

          await saveFamilyEvent({
            type: "marriage",
            personAId: personId,
            personBId: selectedTargetId,
            familyId,
            dateText: newMarriageDate,
            datePrecision: newMarriageDatePrecision,
            description: newRelNote || null,
          });
        } catch (familyModelError) {
          console.error(
            "Created legacy spouse relationship but failed to create Family Model marriage/event:",
            familyModelError,
          );
          throw familyModelError;
        }
      } else if (type === "biological_child" || type === "adopted_child") {
        try {
          await ensureFamilyModelChild({
            supabase,
            parentAId: personA,
            childId: personB,
            parentBId: null,
          });
        } catch (familyModelError) {
          console.error(
            "Created legacy child relationship but failed to create Family Model child:",
            familyModelError,
          );
          throw familyModelError;
        }
      }

      // Auto-update target person generation and is_in_law if currently missing
      try {
        const { data: targetPerson } = await supabase
          .from("persons")
          .select("generation, is_in_law")
          .eq("id", selectedTargetId)
          .single();

        if (
          targetPerson &&
          (targetPerson.generation == null || targetPerson.is_in_law == null)
        ) {
          const updates: { generation?: number; is_in_law?: boolean } = {};

          if (targetPerson.generation == null && person.generation != null) {
            if (newRelDirection === "child")
              updates.generation = person.generation + 1;
            else if (newRelDirection === "parent")
              updates.generation = person.generation - 1;
            else if (newRelDirection === "spouse")
              updates.generation = person.generation;
          }

          if (targetPerson.is_in_law == null) {
            if (newRelDirection === "child" || newRelDirection === "parent")
              updates.is_in_law = false;
            else if (newRelDirection === "spouse")
              updates.is_in_law = person.is_in_law === true ? false : true;
          }

          if (Object.keys(updates).length > 0) {
            await supabase
              .from("persons")
              .update(updates)
              .eq("id", selectedTargetId);
          }
        }
      } catch (err) {
        console.error("Failed to auto-update target person properties", err);
      }

      setIsAdding(false);
      setSearchTerm("");
      setSelectedTargetId(null);
      setNewRelNote("");
      setNewMarriageDate("");
      setNewMarriageDatePrecision("unknown");
      fetchRelationships();
      router.refresh();
    } catch (err: unknown) {
      const e = err as Error;
      setError("Không thể thêm mối quan hệ: " + e.message);
      setTimeout(() => setError(null), 5000);
    } finally {
      setProcessing(false);
    }
  };

  const ensureFamilyModelMarriage = async ({
    supabase,
    personId,
    targetPersonId,
  }: {
    supabase: any;
    personId: string;
    targetPersonId: string;
    legacyRelationshipId?: string | null;
    note?: string | null;
  }) => {
    const { data, error } = await supabase.rpc("ensure_family_model_marriage", {
      p_person_a: personId,
      p_person_b: targetPersonId,
    });

    if (error) {
      console.error("Failed to create Family Model marriage via RPC:", error);
      throw error;
    }

    return data as string;
  };

  const handleBulkAdd = async () => {
    if (!canWriteCurrentPerson()) return;
    if (selectedSpouseId && selectedSpouseId !== "unknown" && !isAllowedPerson(selectedSpouseId)) {
      denyWrite("Bạn không có quyền thêm con với vợ/chồng ngoài nhánh được phép xem.");
      return;
    }

    // Filter out rows without a name
    const validChildren = bulkChildren.filter((c) => c.name.trim() !== "");
    if (validChildren.length === 0) {
      setError("Vui lòng nhập ít nhất tên của 1 người con.");
      setTimeout(() => setError(null), 5000);
      return;
    }

    setProcessing(true);
    setError(null);
    let successCount = 0;

    try {
      // For each child row, insert a Person, then insert Relationship(s)
      for (let i = 0; i < validChildren.length; i++) {
        const child = validChildren[i];

        // 1. Insert Person
        const personPayload: {
          full_name: string;
          gender: "male" | "female" | "other";
          birth_year?: number;
          birth_order?: number;
          is_in_law?: boolean;
          generation?: number;
        } = {
          full_name: child.name.trim(),
          gender: child.gender,
          is_in_law: false,
        };

        if (person.generation != null) {
          personPayload.generation = person.generation + 1;
        }
        if (child.birthYear.trim() !== "") {
          const year = parseInt(child.birthYear);
          if (!isNaN(year)) personPayload.birth_year = year;
        }
        if (child.birthOrder.trim() !== "") {
          const order = parseInt(child.birthOrder);
          if (!isNaN(order)) personPayload.birth_order = order;
        }

        const { data: newPersonData, error: insertError } = await supabase
          .from("persons")
          .insert(personPayload)
          .select("id")
          .single();

        if (insertError || !newPersonData) {
          console.error("Error inserting child:", child.name, insertError);
          continue; // Skip setting relationships for this if person insert failed
        }

        const newChildId = newPersonData.id;

        // 2. Insert Relationship to Main Person (parent)
        await supabase.from("relationships").insert({
          person_a: personId,
          person_b: newChildId,
          type: "biological_child",
        });

        // 3. Insert Relationship to Second Parent (spouse), if selected
        if (selectedSpouseId && selectedSpouseId !== "unknown") {
          await supabase.from("relationships").insert({
            person_a: selectedSpouseId,
            person_b: newChildId,
            type: "biological_child",
          });
        }


        await ensureFamilyModelChild({
          supabase,
          parentAId: personId,
          parentBId:
            selectedSpouseId && selectedSpouseId !== "unknown"
              ? selectedSpouseId
              : null,
          childId: newChildId,
        });

        successCount++;
      }

      if (successCount === validChildren.length) {
        setIsAddingBulk(false);
        setBulkChildren([
          {
            name: "",
            gender: "male",
            birthYear: "",
            birthOrder: "1",
            isProcessing: false,
          },
        ]);
        setSelectedSpouseId("");

        fetchRelationships();
        router.refresh();
      } else {
        setError(
          `Đã xảy ra lỗi. Chỉ lưu thành công ${successCount}/${validChildren.length} người.`,
        );
        setTimeout(() => setError(null), 5000);
        fetchRelationships();
        router.refresh();
      }
    } catch (err: unknown) {
      const e = err as Error;
      setError("Không thể thêm danh sách con: " + e.message);
      setTimeout(() => setError(null), 5000);
    } finally {
      setProcessing(false);
    }
  };

  const handleQuickAddSpouse = async () => {
    if (!canWriteCurrentPerson()) return;
    if (!newSpouseName.trim()) {
      setError("Vui lòng nhập tên Vợ/Chồng.");
      setTimeout(() => setError(null), 5000);
      return;
    }

    setProcessing(true);
    setError(null);
    try {
      // Determine default gender based on current person defined in personGender prop
      // Default to opposite. If original is other, default to female (arbitrary choice, or let user pick, but standard says opposite)
      const newSpouseGender =
        personGender === "male"
          ? "female"
          : personGender === "female"
            ? "male"
            : "female";

      const personPayload: {
        full_name: string;
        gender: "male" | "female" | "other";
        birth_year?: number;
        is_in_law?: boolean;
        generation?: number;
      } = {
        full_name: newSpouseName.trim(),
        gender: newSpouseGender,
        is_in_law: person.is_in_law === true ? false : true,
      };

      if (person.generation != null) {
        personPayload.generation = person.generation;
      }

      if (newSpouseBirthYear.trim() !== "") {
        const year = parseInt(newSpouseBirthYear);
        if (!isNaN(year)) personPayload.birth_year = year;
      }

      // 1. Insert Person
      const { data: newPersonData, error: insertError } = await supabase
        .from("persons")
        .insert(personPayload)
        .select("id")
        .single();

      if (insertError || !newPersonData) throw insertError;

      const newSpouseId = newPersonData.id;

      // 2. Insert Marriage Relationship
      const { error: relError } = await supabase.from("relationships").insert({
        person_a: personId,
        person_b: newSpouseId,
        type: "marriage",
        note: newSpouseNote.trim() || null,
      });

      if (relError) throw relError;

      const familyId = await ensureFamilyModelMarriage({
        supabase,
        personId,
        targetPersonId: newSpouseId,
      });

      await saveFamilyEvent({
        type: "marriage",
        personAId: personId,
        personBId: newSpouseId,
        familyId,
        dateText: newSpouseMarriageDate,
        datePrecision: newSpouseMarriageDatePrecision,
        description: newSpouseNote || null,
      });

      setIsAddingSpouse(false);
      setNewSpouseName("");
      setNewSpouseBirthYear("");
      setNewSpouseNote("");
      fetchRelationships();
      router.refresh();
    } catch (err: unknown) {
      const e = err as Error;
      setError("Không thể thêm vợ/chồng: " + e.message);
      setTimeout(() => setError(null), 5000);
    } finally {
      setProcessing(false);
    }
  };

  const handleAddParent = async () => {
    if (!canWriteCurrentPerson()) return;
    if (!canAddParent) {
      setError("Người này đã có đủ 2 cha/mẹ.");
      setTimeout(() => setError(null), 5000);
      return;
    }
    if (!newParentName.trim()) {
      setError("Vui lòng nhập tên Cha/Mẹ.");
      setTimeout(() => setError(null), 5000);
      return;
    }

    setProcessing(true);
    setError(null);
    try {
      const personPayload: {
        full_name: string;
        gender: "male" | "female" | "other";
        birth_year?: number;
        is_in_law?: boolean;
        generation?: number;
      } = {
        full_name: newParentName.trim(),
        gender: newParentGender,
        is_in_law: false,
      };

      if (person.generation != null) {
        personPayload.generation = person.generation - 1;
      }

      if (newParentBirthYear.trim() !== "") {
        const year = parseInt(newParentBirthYear);
        if (!isNaN(year)) personPayload.birth_year = year;
      }

      // 1. Insert Person
      const { data: newPersonData, error: insertError } = await supabase
        .from("persons")
        .insert(personPayload)
        .select("id")
        .single();

      if (insertError || !newPersonData) throw insertError;

      const newParentId = newPersonData.id;

      // Nếu người này đã có 1 cha/mẹ, gộp chung vào cùng gia đình với
      // cha/mẹ đã có thay vì tạo family unit tách rời.
      const otherParentId =
        existingParentRelationships[0]?.targetPerson?.id ?? null;

      // 2. Insert Relationship (người mới là Cha/Mẹ -> personId là Con)
      const { error: relError } = await supabase.from("relationships").insert({
        person_a: newParentId,
        person_b: personId,
        type: newParentRelType,
        note: newParentNote.trim() || null,
      });

      if (relError) throw relError;

      await ensureFamilyModelChild({
        supabase,
        parentAId: newParentId,
        parentBId: otherParentId,
        childId: personId,
      });

      setIsAddingParent(false);
      setNewParentName("");
      setNewParentBirthYear("");
      setNewParentNote("");
      setNewParentRelType("biological_child");
      fetchRelationships();
      router.refresh();
    } catch (err: unknown) {
      const e = err as Error;
      setError("Không thể thêm cha/mẹ: " + e.message);
      setTimeout(() => setError(null), 5000);
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async (rel: EnrichedRelationship) => {
    if (!canWriteCurrentPerson()) return;
    if (!isAllowedPerson(rel.targetPerson.id)) {
      denyWrite("Bạn không có quyền xóa quan hệ với người ngoài nhánh được phép xem.");
      return;
    }
    if (!confirm("Bạn có chắc chắn muốn xóa mối quan hệ này?")) return;
    try {
      const { error } = await supabase
       .from("relationships")
       .update({
         deleted_at: new Date().toISOString(),
       })
       .eq("id", rel.id)
       .is("deleted_at", null);
      if (error) throw error;
      fetchRelationships();
      router.refresh();
    } catch (err: unknown) {
      const e = err as Error;
      setError("Không thể xóa: " + e.message);
      setTimeout(() => setError(null), 5000);
    }
  };

  const findSharedMarriageFamilyIds = async (
    personAId: string,
    personBId: string,
  ) => {
    const { data, error } = await supabase
      .from("family_parents")
      .select("family_id, person_id")
      .in("person_id", [personAId, personBId]);

    if (error) throw error;

    const peopleByFamilyId = new Map<string, Set<string>>();
    for (const row of data ?? []) {
      if (!row.family_id || !row.person_id) continue;
      if (!peopleByFamilyId.has(row.family_id)) {
        peopleByFamilyId.set(row.family_id, new Set());
      }
      peopleByFamilyId.get(row.family_id)!.add(row.person_id);
    }

    return Array.from(peopleByFamilyId.entries())
      .filter(([, people]) => people.has(personAId) && people.has(personBId))
      .map(([familyId]) => familyId);
  };

  const openDivorceModal = (rel: EnrichedRelationship) => {
    if (!canWriteCurrentPerson()) return;
    if (!isAllowedPerson(rel.targetPerson.id)) {
      denyWrite("Bạn không có quyền ly hôn quan hệ với người ngoài nhánh được phép xem.");
      return;
    }
    if (rel.type !== "marriage" || rel.direction !== "spouse") return;

    if (rel.status === "divorced") {
      setError("Quan hệ này đã được đánh dấu ly hôn rồi.");
      setTimeout(() => setError(null), 5000);
      return;
    }

    setDivorceRel(rel);
    setDivorceDate("");
    setDivorceDatePrecision("unknown");
    setDivorceNote(rel.divorce_note ?? "");
  };

  const closeDivorceModal = () => {
    if (processing) return;
    setDivorceRel(null);
    setDivorceDate("");
    setDivorceDatePrecision("unknown");
    setDivorceNote("");
  };

  const handleConfirmDivorce = async () => {
    const rel = divorceRel;
    if (!rel) return;
    if (!canWriteCurrentPerson()) return;
    if (!isAllowedPerson(rel.targetPerson.id)) {
      denyWrite("Bạn không có quyền ly hôn quan hệ với người ngoài nhánh được phép xem.");
      return;
    }
    if (rel.type !== "marriage" || rel.direction !== "spouse") return;

    setProcessing(true);
    setError(null);

    try {
      const now = new Date();

      const { error: relError } = await supabase
        .from("relationships")
        .update({
          status: "divorced",
          ended_at: now.toISOString(),
          divorce_note: divorceNote.trim() || null,
        })
        .eq("id", rel.id)
        .eq("type", "marriage")
        .is("deleted_at", null);

      if (relError) throw relError;

      const familyUpdatePayload = {
        status: "divorced",
        end_year: now.getFullYear(),
        updated_at: now.toISOString(),
      };

      const { error: legacyFamilyError } = await supabase
        .from("families")
        .update(familyUpdatePayload)
        .eq("legacy_relationship_id", rel.id)
        .is("deleted_at", null);

      if (legacyFamilyError) throw legacyFamilyError;

      let sharedFamilyIds = await findSharedMarriageFamilyIds(
        personId,
        rel.targetPerson.id,
      );

      if (sharedFamilyIds.length === 0) {
        const ensuredFamilyId = await ensureFamilyModelMarriage({
          supabase,
          personId,
          targetPersonId: rel.targetPerson.id,
        });

        if (ensuredFamilyId) {
          sharedFamilyIds = [ensuredFamilyId];
        }
      }

      if (sharedFamilyIds.length > 0) {
        const uniqueFamilyIds = Array.from(new Set(sharedFamilyIds));
        const { error: sharedFamilyError } = await supabase
          .from("families")
          .update(familyUpdatePayload)
          .in("id", uniqueFamilyIds)
          .is("deleted_at", null);

        if (sharedFamilyError) throw sharedFamilyError;

        await saveFamilyEvent({
          type: "divorce",
          personAId: personId,
          personBId: rel.targetPerson.id,
          familyId: uniqueFamilyIds[0],
          dateText: divorceDate,
          datePrecision: divorceDatePrecision,
          description: divorceNote || null,
        });
      }

      closeDivorceModal();
      fetchRelationships();
      router.refresh();
    } catch (err: unknown) {
      const e = err as Error;
      setError("Không thể đánh dấu ly hôn: " + e.message);
      setTimeout(() => setError(null), 5000);
    } finally {
      setProcessing(false);
    }
  };

  const handleRestoreMarriage = async (rel: EnrichedRelationship) => {
    if (!canWriteCurrentPerson()) return;
    if (!isAllowedPerson(rel.targetPerson.id)) {
      denyWrite("Bạn không có quyền khôi phục quan hệ với người ngoài nhánh được phép xem.");
      return;
    }
    if (rel.type !== "marriage" || rel.direction !== "spouse") return;

    if (rel.status !== "divorced") {
      setError("Quan hệ này chưa ở trạng thái ly hôn.");
      setTimeout(() => setError(null), 5000);
      return;
    }

    const ok = confirm(
      `Khôi phục hôn nhân giữa ${person.full_name} và ${rel.targetPerson.full_name}?\n\nThao tác này sẽ đổi quan hệ về trạng thái đang kết hôn và đường nối trên cây sẽ trở lại nét liền.`,
    );

    if (!ok) return;

    setProcessing(true);
    setError(null);

    try {
      const now = new Date();

      const relationshipUpdatePayload: Record<string, string | null> = {
        status: "active",
        ended_at: null,
      };

      if ("divorce_note" in rel) {
        relationshipUpdatePayload.divorce_note = null;
      }

      const { error: relError } = await supabase
        .from("relationships")
        .update(relationshipUpdatePayload)
        .eq("id", rel.id)
        .eq("type", "marriage")
        .is("deleted_at", null);

      if (relError) throw relError;

      const familyUpdatePayload = {
        status: "active",
        end_year: null,
        updated_at: now.toISOString(),
      };

      // 1) Đồng bộ Family Model theo legacy_relationship_id nếu có.
      const { error: legacyFamilyError } = await supabase
        .from("families")
        .update(familyUpdatePayload)
        .eq("legacy_relationship_id", rel.id)
        .is("deleted_at", null);

      if (legacyFamilyError) throw legacyFamilyError;

      // 2) Đồng bộ theo cặp parent trong family_parents.
      let sharedFamilyIds = await findSharedMarriageFamilyIds(
        personId,
        rel.targetPerson.id,
      );

      if (sharedFamilyIds.length === 0) {
        const ensuredFamilyId = await ensureFamilyModelMarriage({
          supabase,
          personId,
          targetPersonId: rel.targetPerson.id,
        });

        if (ensuredFamilyId) {
          sharedFamilyIds = [ensuredFamilyId];
        }
      }

      if (sharedFamilyIds.length > 0) {
        const { error: sharedFamilyError } = await supabase
          .from("families")
          .update(familyUpdatePayload)
          .in("id", Array.from(new Set(sharedFamilyIds)))
          .is("deleted_at", null);

        if (sharedFamilyError) throw sharedFamilyError;
      }

      fetchRelationships();
      router.refresh();
    } catch (err: unknown) {
      const e = err as Error;
      setError("Không thể khôi phục hôn nhân: " + e.message);
      setTimeout(() => setError(null), 5000);
    } finally {
      setProcessing(false);
    }
  };

  const getFamilyParentRole = (gender: string | null | undefined) => {
    if (gender === "male") return "husband";
    if (gender === "female") return "wife";
    return "partner";
  };

  const groupByType = (type: string) =>
    relationships
      .filter((r) => r.direction === type)
      .sort((a, b) => {
        const yearA = a.targetPerson.birth_year;
        const yearB = b.targetPerson.birth_year;
        if (yearA == null && yearB == null) return 0;
        if (yearA == null) return 1;
        if (yearB == null) return -1;
        return yearA - yearB;
      });

  // "Thêm Cha/Mẹ" chỉ hiển thị khi người này CHƯA có đủ 2 cha/mẹ (dù ruột
  // hay nuôi). Không cần phân biệt giới tính chính xác - chỉ cần đếm số
  // quan hệ cha/mẹ đã có.
  const existingParentRelationships = relationships.filter(
    (r) => r.direction === "parent",
  );
  const hasExistingFather = existingParentRelationships.some(
    (r) => r.targetPerson?.gender === "male",
  );
  const hasExistingMother = existingParentRelationships.some(
    (r) => r.targetPerson?.gender === "female",
  );
  const canAddParent = existingParentRelationships.length < 2;

  if (loading)
    return (
      <div className="text-stone-500 text-sm">
        Đang tải thông tin gia đình...
      </div>
    );

  return (
    <div className="space-y-6">
      {/* List Sections */}
      {["parent", "spouse", "child", "child_in_law"].map((group) => {
        const items = groupByType(group);
        let title = "";
        if (group === "parent") title = "Bố / Mẹ";
        if (group === "spouse") title = "Vợ / Chồng";
        if (group === "child") title = "Con cái";
        if (group === "child_in_law") title = "Con dâu / Con rể";

        if (items.length === 0 && !isAdmin) return null; // Hide empty sections for members? Or show empty state?

        return (
          <div
            key={group}
            className="border-b border-stone-100 pb-4 last:border-0"
          >
            <h4 className="font-bold text-stone-700 mb-3 flex justify-between items-center text-sm uppercase tracking-wide">
              {title}
            </h4>
            {items.length > 0 ? (
              <ul className="space-y-3">
                {items.map((rel) => (
                  <li
                    key={rel.id}
                    className="flex items-center justify-between group"
                  >
                    <button
                      onClick={() => handlePersonClick(rel.targetPerson.id)}
                      className="flex items-center gap-3 hover:bg-stone-100 p-2.5 -mx-2.5 rounded-xl transition-all duration-200 flex-1 text-left"
                    >
                      <div
                        className={`size-8 rounded-full flex items-center justify-center text-xs text-white overflow-hidden
                            ${getAvatarBg(rel.targetPerson.gender)}`}
                      >
                        {rel.targetPerson.avatar_url ? (
                          <Image
                            unoptimized
                            src={rel.targetPerson.avatar_url}
                            alt={rel.targetPerson.full_name}
                            className="h-full w-full object-cover"
                            width={32}
                            height={32}
                          />
                        ) : (
                          <DefaultAvatar
                            gender={rel.targetPerson.gender}
                            size={32}
                          />
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-stone-900 font-medium text-sm">
                          {rel.targetPerson.full_name}
                        </span>
                        {rel.note && (
                          <span className="text-xs text-amber-600 font-medium italic mt-0.5">
                            ({rel.note})
                          </span>
                        )}
                        {rel.status === "divorced" && (
                          <span className="text-xs text-red-600 font-semibold mt-0.5">
                            Đã ly hôn
                          </span>
                        )}
                        {rel.type === "adopted_child" && (
                          <span className="text-xs text-stone-400 italic mt-0.5">
                            (Con nuôi)
                          </span>
                        )}
                      </div>
                    </button>
                    {canEdit && rel.direction !== "child_in_law" && (
                      <div className="ml-2 flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        {rel.type === "marriage" && rel.direction === "spouse" && rel.status !== "divorced" && (
                          <button
                            onClick={() => openDivorceModal(rel)}
                            disabled={processing}
                            className="text-stone-300 hover:text-red-600 hover:bg-red-50 p-2 sm:p-2.5 rounded-lg transition-colors flex items-center justify-center disabled:opacity-50"
                            title="Đánh dấu ly hôn"
                            aria-label="Đánh dấu ly hôn"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M12 21C7 17 3 13.5 3 8.8A4.8 4.8 0 0 1 11.1 5.4L12 6.4l.9-1A4.8 4.8 0 0 1 21 8.8c0 1.9-.7 3.6-1.9 5.2" />
                              <path d="M12 21l3.2-3.1" />
                              <path d="M15 14l-3 4h4l-3 4" />
                            </svg>
                          </button>
                        )}

                        {rel.type === "marriage" && rel.direction === "spouse" && rel.status === "divorced" && (
                          <button
                            onClick={() => handleRestoreMarriage(rel)}
                            disabled={processing}
                            className="text-stone-300 hover:text-emerald-600 hover:bg-emerald-50 p-2 sm:p-2.5 rounded-lg transition-colors flex items-center justify-center disabled:opacity-50"
                            title="Khôi phục hôn nhân"
                            aria-label="Khôi phục hôn nhân"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M20 8A5 5 0 0 0 12 4.5A5 5 0 0 0 4 8c0 5 8 11 8 11s2.4-1.8 4.6-4.2" />
                              <path d="M16 19h6" />
                              <path d="M19 16v6" />
                            </svg>
                          </button>
                        )}

                        <button
                          onClick={() => handleDelete(rel)}
                          className="text-stone-300 hover:text-red-500 hover:bg-red-50 p-2 sm:p-2.5 rounded-lg transition-colors flex items-center justify-center"
                          title="Xóa mối quan hệ"
                          aria-label="Xóa mối quan hệ"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M3 6h18" />
                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                            <line x1="10" x2="10" y1="11" y2="17" />
                            <line x1="14" x2="14" y1="11" y2="17" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-stone-400 italic">
                Chưa có thông tin.
              </p>
            )}
          </div>
        );
      })}

      {/* Add Button (Admin) */}
      {canEdit && !isAdding && !isAddingBulk && !isAddingSpouse && !isAddingParent && (
        <div className="flex flex-col sm:flex-row gap-3 mt-4">
          <button
            onClick={() => setIsAdding(true)}
            className="flex-1 py-3 border-2 border-dashed border-stone-200 bg-stone-50/50 hover:bg-stone-50 rounded-xl sm:rounded-2xl text-stone-500 font-medium text-sm hover:border-amber-400 hover:text-amber-700 transition-all duration-200"
          >
            + Thêm Quan Hệ
          </button>

          <button
            onClick={() => setIsAddingBulk(true)}
            className="flex-1 py-3 border-2 border-dashed border-stone-200 bg-stone-50/50 hover:bg-stone-50 rounded-xl sm:rounded-2xl text-stone-500 font-medium text-sm hover:border-sky-400 hover:text-sky-700 transition-all duration-200"
          >
            + Thêm Con
          </button>

          <button
            onClick={() => setIsAddingSpouse(true)}
            className="flex-1 py-3 border-2 border-dashed border-stone-200 bg-stone-50/50 hover:bg-stone-50 rounded-xl sm:rounded-2xl text-stone-500 font-medium text-sm hover:border-rose-400 hover:text-rose-700 transition-all duration-200"
          >
            + Thêm Vợ/Chồng
          </button>

          {canAddParent && (
            <button
              onClick={() => {
                setNewParentGender(
                  hasExistingFather ? "female" : hasExistingMother ? "male" : "male",
                );
                setIsAddingParent(true);
              }}
              className="flex-1 py-3 border-2 border-dashed border-stone-200 bg-stone-50/50 hover:bg-stone-50 rounded-xl sm:rounded-2xl text-stone-500 font-medium text-sm hover:border-emerald-400 hover:text-emerald-700 transition-all duration-200"
            >
              + Thêm Cha/Mẹ
            </button>
          )}
        </div>
      )}

      {error && !isAdding && !isAddingBulk && !isAddingSpouse && !isAddingParent && (
        <div className="mt-4 text-sm text-red-600 bg-red-50 p-3 rounded-xl border border-red-100 flex items-center justify-between gap-2 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <svg
              className="w-5 h-5 shrink-0 text-red-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-600 transition-colors p-1"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      )}

      {/* Add Form (Admin) */}
      {canEdit && isAdding && (
        <div className="mt-4 bg-stone-50/50 p-4 sm:p-5 rounded-xl border border-stone-200 shadow-sm">
          <h4 className="font-bold text-stone-800 mb-3 text-sm">
            Thêm Quan Hệ Mới
          </h4>

          <div className="space-y-3">
            <div>
              <label
                htmlFor="rel-note"
                className="block text-xs font-medium text-stone-600 mb-1"
              >
                Ghi chú mối quan hệ (tuỳ chọn)
              </label>
              <input
                id="rel-note"
                name="rel-note"
                type="text"
                placeholder="VD: Vợ cả, Vợ hai, Chồng trước..."
                value={newRelNote}
                onChange={(e) => setNewRelNote(e.target.value)}
                className="bg-white text-stone-900 placeholder-stone-400 block w-full text-sm rounded-lg border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 p-2 sm:p-2.5 border mb-3 transition-colors"
              />
            </div>

            {newRelDirection === "spouse" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="rel-marriage-date"
                    className="block text-xs font-medium text-stone-600 mb-1"
                  >
                    Ngày kết hôn
                  </label>
                  <input
                    id="rel-marriage-date"
                    type="text"
                    inputMode="numeric"
                    placeholder="dd-mm-yyyy, ví dụ 21-07-2015"
                    value={newMarriageDate}
                    onChange={(e) => setNewMarriageDate(e.target.value)}
                    className="bg-white text-stone-900 placeholder-stone-400 block w-full text-sm rounded-lg border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 p-2 sm:p-2.5 border transition-colors"
                  />
                </div>
                <div>
                  <label
                    htmlFor="rel-marriage-precision"
                    className="block text-xs font-medium text-stone-600 mb-1"
                  >
                    Độ chính xác
                  </label>
                  <select
                    id="rel-marriage-precision"
                    value={newMarriageDatePrecision}
                    onChange={(e) => setNewMarriageDatePrecision(e.target.value as any)}
                    className="bg-white text-stone-900 block w-full text-sm rounded-lg border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 p-2 sm:p-2.5 border transition-colors"
                  >
                    <option value="unknown">Không rõ</option>
                    <option value="day">Chính xác ngày</option>
                    <option value="month">Chỉ tháng/năm</option>
                    <option value="year">Chỉ năm</option>
                  </select>
                </div>
              </div>
            )}

            <div>
              <label
                htmlFor="rel-direction"
                className="block text-xs font-medium text-stone-600 mb-1"
              >
                Loại quan hệ
              </label>
              <select
                id="rel-direction"
                name="rel-direction"
                value={newRelDirection}
                onChange={(e) =>
                  setNewRelDirection(
                    e.target.value as "parent" | "child" | "spouse",
                  )
                }
                className="bg-white text-stone-900 block w-full max-w-full text-sm rounded-lg border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 p-2 sm:p-2.5 border transition-colors"
              >
                <option value="parent">Người này là Con của...</option>
                <option value="spouse">Người này là Vợ/Chồng của...</option>
                <option value="child">Người này là Bố/Mẹ của...</option>
              </select>
            </div>

            {/* Child Type Sub-selection */}
            {(newRelDirection === "child" || newRelDirection === "parent") && (
              <div>
                <label
                  htmlFor="rel-type"
                  className="block text-xs font-medium text-stone-600 mb-1"
                >
                  Chi tiết
                </label>
                <select
                  id="rel-type"
                  name="rel-type"
                  value={newRelType}
                  onChange={(e) =>
                    setNewRelType(e.target.value as RelationshipType)
                  }
                  className="bg-white text-stone-900 block w-full max-w-full text-sm rounded-lg border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 p-2 sm:p-2.5 border transition-colors"
                >
                  <option value="biological_child">Con ruột</option>
                  <option value="adopted_child">Con nuôi</option>
                </select>
              </div>
            )}

            <div>
              <label
                htmlFor="rel-search"
                className="block text-xs font-medium text-stone-600 mb-1"
              >
                Tìm người thân
              </label>
              <input
                id="rel-search"
                name="rel-search"
                type="text"
                placeholder="Nhập tên để tìm..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-white text-stone-900 placeholder-stone-400 block w-full text-sm rounded-lg border-stone-300 shadow-sm focus:border-amber-500 focus:ring-amber-500 p-2 sm:p-2.5 border transition-colors"
              />
              {/* Search Results Dropdown */}
              {(searchResults.length > 0 ||
                (searchTerm.length === 0 &&
                  !selectedTargetId &&
                  recentMembers.length > 0)) && (
                  <div className="mt-2 bg-white border border-stone-200 rounded-md shadow-lg max-h-[250px] overflow-y-auto">
                    <div className="px-3 py-1.5 bg-stone-100 text-[10px] font-bold text-stone-500 uppercase tracking-wide border-b border-stone-200 sticky top-0 z-10">
                      {searchResults.length > 0
                        ? "Kết quả tìm kiếm"
                        : "Thành viên vừa thêm gần đây"}
                    </div>
                    {(searchResults.length > 0
                      ? searchResults
                      : recentMembers
                    ).map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          setSelectedTargetId(p.id);
                          setSearchTerm(p.full_name);
                          setSearchResults([]);
                        }}
                        className="px-3 py-2 hover:bg-amber-50 text-sm flex items-center justify-between border-b border-stone-100 last:border-0"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`flex items-center justify-center text-[8px] font-bold size-3 rounded-full text-white shrink-0
                               ${p.gender === "male"
                                ? "bg-sky-500"
                                : p.gender === "female"
                                  ? "bg-rose-500"
                                  : "bg-stone-400"
                              }`}
                          >
                            {p.gender === "male"
                              ? "♂"
                              : p.gender === "female"
                                ? "♀"
                                : "?"}
                          </span>
                          <span className="font-medium text-stone-800">
                            {p.full_name}
                          </span>
                        </div>
                        <span className="text-[10px] text-stone-400">
                          {formatDisplayDate(
                            p.birth_year,
                            p.birth_month,
                            p.birth_day,
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              {selectedTargetId && (
                <p className="text-xs text-green-600 mt-1">
                  Đã chọn: {searchTerm}
                </p>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleAddRelationship}
                disabled={!selectedTargetId || processing}
                className="flex-1 bg-amber-700 text-white py-2 sm:py-2.5 rounded-md sm:rounded-lg text-sm font-medium hover:bg-amber-800 disabled:opacity-50 transition-colors"
              >
                {processing ? "Đang lưu..." : "Lưu"}
              </button>
              <button
                onClick={() => {
                  setIsAdding(false);
                  setSelectedTargetId(null);
                  setSearchTerm("");
                  setNewRelNote("");
                  setNewMarriageDate("");
                  setNewMarriageDatePrecision("unknown");
                }}
                className="px-4 py-2 sm:py-2.5 bg-white border border-stone-300 text-stone-700 rounded-md sm:rounded-lg text-sm hover:bg-stone-50 transition-colors"
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Add Children Form (Admin) */}
      {canEdit && isAddingBulk && (
        <div className="mt-4 bg-sky-50/50 p-4 sm:p-5 rounded-xl border border-sky-200 shadow-sm">
          <h4 className="font-bold text-sky-800 mb-3 text-sm">
            Thêm Nhanh Nhiều Con
          </h4>

          <div className="space-y-4">
            <div>
              <label
                htmlFor="bulk-spouse"
                className="block text-xs font-medium text-stone-600 mb-1"
              >
                Chọn người mẹ/cha còn lại
              </label>
              <select
                id="bulk-spouse"
                name="bulk-spouse"
                value={selectedSpouseId}
                onChange={(e) => setSelectedSpouseId(e.target.value)}
                className="bg-white text-stone-900 block w-full max-w-full text-sm rounded-lg border-stone-300 shadow-sm focus:border-sky-500 focus:ring-sky-500 p-2 sm:p-2.5 border transition-colors"
              >
                <option value="unknown">
                  Không rõ (hoặc Vợ/Chồng khác chưa thêm)
                </option>
                {groupByType("spouse").map((rel) => (
                  <option key={rel.id} value={rel.targetPerson.id}>
                    {rel.targetPerson.full_name}{" "}
                    {rel.note ? `(${rel.note})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-medium text-stone-600 mb-1">
                Danh sách các con
              </label>
              {bulkChildren.map((child, index) => (
                <div
                  key={index}
                  className="bg-white rounded-xl border border-stone-200/80 p-3 sm:p-4 shadow-xs"
                >
                  {/* Header: number + remove */}
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-xs font-bold text-sky-600 bg-sky-50 px-2 py-0.5 rounded-md">
                      Con thứ {index + 1}
                    </span>
                    <button
                      onClick={() => {
                        const newBulk = bulkChildren.filter(
                          (_, i) => i !== index,
                        );
                        if (newBulk.length === 0) {
                          newBulk.push({
                            name: "",
                            gender: "male",
                            birthYear: "",
                            birthOrder: "1",
                            isProcessing: false,
                          });
                        }
                        setBulkChildren(newBulk);
                      }}
                      className="text-stone-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors text-xs"
                      title="Xoá"
                    >
                      ✕
                    </button>
                  </div>
                  {/* Fields */}
                  <div className="flex flex-wrap sm:flex-nowrap gap-2">
                    <input
                      id={`child-birth-order-${index}`}
                      name={`child-birth-order-${index}`}
                      type="number"
                      placeholder="STT"
                      min="1"
                      value={child.birthOrder}
                      onChange={(e) => {
                        const newBulk = [...bulkChildren];
                        newBulk[index].birthOrder = e.target.value;
                        setBulkChildren(newBulk);
                      }}
                      className="w-14 shrink-0 text-center bg-stone-50 text-stone-900 placeholder-stone-400 text-sm rounded-lg border-stone-300 shadow-sm focus:border-sky-500 focus:ring-sky-500 px-1 py-2 border transition-colors"
                    />
                    <input
                      id={`child-name-${index}`}
                      name={`child-name-${index}`}
                      type="text"
                      placeholder="Họ và tên *"
                      value={child.name}
                      onChange={(e) => {
                        const newBulk = [...bulkChildren];
                        newBulk[index].name = e.target.value;
                        setBulkChildren(newBulk);
                      }}
                      className="w-[calc(100%-4rem)] sm:w-auto sm:flex-1 min-w-0 bg-stone-50 text-stone-900 placeholder-stone-400 text-sm rounded-lg border-stone-300 shadow-sm focus:border-sky-500 focus:ring-sky-500 px-3 py-2 border transition-colors"
                    />
                    <select
                      id={`child-gender-${index}`}
                      name={`child-gender-${index}`}
                      value={child.gender}
                      onChange={(e) => {
                        const newBulk = [...bulkChildren];
                        newBulk[index].gender = e.target.value as
                          | "male"
                          | "female"
                          | "other";
                        setBulkChildren(newBulk);
                      }}
                      className="w-[calc(50%-0.25rem)] sm:w-24 shrink-0 bg-stone-50 text-stone-900 text-sm rounded-lg border-stone-300 shadow-sm focus:border-sky-500 focus:ring-sky-500 px-2 py-2 border transition-colors"
                    >
                      <option value="male">Nam</option>
                      <option value="female">Nữ</option>
                      <option value="other">Khác</option>
                    </select>
                    <input
                      id={`child-birth-year-${index}`}
                      name={`child-birth-year-${index}`}
                      type="number"
                      placeholder="Năm sinh"
                      value={child.birthYear}
                      onChange={(e) => {
                        const newBulk = [...bulkChildren];
                        newBulk[index].birthYear = e.target.value;
                        setBulkChildren(newBulk);
                      }}
                      className="w-[calc(50%-0.25rem)] sm:w-24 shrink-0 bg-stone-50 text-stone-900 placeholder-stone-400 text-sm rounded-lg border-stone-300 shadow-sm focus:border-sky-500 focus:ring-sky-500 px-2 py-2 border transition-colors"
                    />
                  </div>
                </div>
              ))}

              <button
                onClick={() => {
                  const nextOrder = String(bulkChildren.length + 1);
                  setBulkChildren([
                    ...bulkChildren,
                    {
                      name: "",
                      gender: "male",
                      birthYear: "",
                      birthOrder: nextOrder,
                      isProcessing: false,
                    },
                  ]);
                }}
                className="w-full py-2.5 border-2 border-dashed border-sky-200 bg-sky-50/50 hover:bg-sky-50 rounded-xl text-sky-600 text-xs font-semibold hover:border-sky-300 transition-all"
              >
                + Thêm dòng
              </button>
            </div>

            <div className="flex gap-2 pt-4 border-t border-stone-200">
              <button
                onClick={handleBulkAdd}
                disabled={
                  processing || bulkChildren.every((c) => c.name.trim() === "")
                }
                className="flex-1 bg-sky-600 text-white py-2 sm:py-2.5 rounded-md sm:rounded-lg text-sm font-medium hover:bg-sky-700 disabled:opacity-50 transition-colors"
              >
                {processing ? "Đang lưu..." : "Lưu Tất Cả"}
              </button>
              <button
                onClick={() => {
                  setIsAddingBulk(false);
                  setBulkChildren([
                    {
                      name: "",
                      gender: "male",
                      birthYear: "",
                      birthOrder: "1",
                      isProcessing: false,
                    },
                  ]);
                  setSelectedSpouseId("");
                }}
                className="px-4 py-2 sm:py-2.5 bg-white border border-stone-300 text-stone-700 rounded-md sm:rounded-lg text-sm hover:bg-stone-50 transition-colors"
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Add Spouse Form (Admin) */}
      {canEdit && isAddingSpouse && (
        <div className="mt-4 bg-rose-50/50 p-4 sm:p-5 rounded-xl border border-rose-200 shadow-sm">
          <h4 className="font-bold text-rose-800 mb-3 text-sm">
            Thêm Nhanh Vợ/Chồng
          </h4>

          <div className="space-y-3">
            <div>
              <label
                htmlFor="spouse-name"
                className="block text-xs font-medium text-stone-600 mb-1"
              >
                Họ và Tên <span className="text-red-500">*</span>
              </label>
              <input
                id="spouse-name"
                name="spouse-name"
                type="text"
                placeholder="Nhập họ và tên..."
                value={newSpouseName}
                onChange={(e) => setNewSpouseName(e.target.value)}
                className="bg-white text-stone-900 placeholder-stone-400 block w-full text-sm rounded-lg border-stone-300 shadow-sm focus:border-rose-500 focus:ring-rose-500 p-2 sm:p-2.5 border transition-colors"
              />
            </div>

            <div>
              <label
                htmlFor="spouse-birth-year"
                className="block text-xs font-medium text-stone-600 mb-1"
              >
                Năm sinh (Tuỳ chọn)
              </label>
              <input
                id="spouse-birth-year"
                name="spouse-birth-year"
                type="number"
                placeholder="VD: 1980"
                value={newSpouseBirthYear}
                onChange={(e) => setNewSpouseBirthYear(e.target.value)}
                className="bg-white text-stone-900 placeholder-stone-400 block w-full text-sm rounded-lg border-stone-300 shadow-sm focus:border-rose-500 focus:ring-rose-500 p-2 sm:p-2.5 border transition-colors"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="spouse-marriage-date"
                  className="block text-xs font-medium text-stone-600 mb-1"
                >
                  Ngày kết hôn
                </label>
                <input
                  id="spouse-marriage-date"
                  type="text"
                  inputMode="numeric"
                  placeholder="dd-mm-yyyy"
                  value={newSpouseMarriageDate}
                  onChange={(e) => setNewSpouseMarriageDate(e.target.value)}
                  className="bg-white text-stone-900 placeholder-stone-400 block w-full text-sm rounded-lg border-stone-300 shadow-sm focus:border-rose-500 focus:ring-rose-500 p-2 sm:p-2.5 border transition-colors"
                />
              </div>
              <div>
                <label
                  htmlFor="spouse-marriage-precision"
                  className="block text-xs font-medium text-stone-600 mb-1"
                >
                  Độ chính xác
                </label>
                <select
                  id="spouse-marriage-precision"
                  value={newSpouseMarriageDatePrecision}
                  onChange={(e) => setNewSpouseMarriageDatePrecision(e.target.value as any)}
                  className="bg-white text-stone-900 block w-full text-sm rounded-lg border-stone-300 shadow-sm focus:border-rose-500 focus:ring-rose-500 p-2 sm:p-2.5 border transition-colors"
                >
                  <option value="unknown">Không rõ</option>
                  <option value="day">Chính xác ngày</option>
                  <option value="month">Chỉ tháng/năm</option>
                  <option value="year">Chỉ năm</option>
                </select>
              </div>
            </div>

            <div>
              <label
                htmlFor="spouse-note"
                className="block text-xs font-medium text-stone-600 mb-1"
              >
                Ghi chú mối quan hệ (Ví dụ: Vợ cả, Chồng thứ...)
              </label>
              <input
                id="spouse-note"
                name="spouse-note"
                type="text"
                placeholder="Tuỳ chọn..."
                value={newSpouseNote}
                onChange={(e) => setNewSpouseNote(e.target.value)}
                className="bg-white text-stone-900 placeholder-stone-400 block w-full text-sm rounded-lg border-stone-300 shadow-sm focus:border-rose-500 focus:ring-rose-500 p-2 sm:p-2.5 border transition-colors"
              />
            </div>

            <p className="text-xs text-stone-500 italic mt-1">
              * Giới tính sẽ tự động gán là{" "}
              {personGender === "male"
                ? "Nữ"
                : personGender === "female"
                  ? "Nam"
                  : "Nữ"}{" "}
              (dựa theo giới tính người hiện tại).
            </p>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleQuickAddSpouse}
                disabled={!newSpouseName.trim() || processing}
                className="flex-1 bg-rose-600 text-white py-2 sm:py-2.5 rounded-md sm:rounded-lg text-sm font-medium hover:bg-rose-700 disabled:opacity-50 transition-colors"
              >
                {processing ? "Đang lưu..." : "Lưu"}
              </button>
              <button
                onClick={() => {
                  setIsAddingSpouse(false);
                  setNewSpouseName("");
                  setNewSpouseBirthYear("");
                  setNewSpouseNote("");
                  setNewSpouseMarriageDate("");
                  setNewSpouseMarriageDatePrecision("unknown");
                }}
                className="px-4 py-2 sm:py-2.5 bg-white border border-stone-300 text-stone-700 rounded-md sm:rounded-lg text-sm hover:bg-stone-50 transition-colors"
              >
                Hủy
              </button>
            </div>
            {error && (
              <div className="mt-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-100 flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                <svg
                  className="w-4 h-4 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                {error}
              </div>
            )}
          </div>
        </div>
      )}

      {canEdit && isAddingParent && (
        <div className="mt-4 bg-emerald-50/50 p-4 sm:p-5 rounded-xl border border-emerald-200 shadow-sm">
          <h4 className="font-bold text-emerald-800 mb-3 text-sm">
            Thêm Cha/Mẹ
          </h4>

          <div className="space-y-3">
            <div>
              <label
                htmlFor="parent-name"
                className="block text-xs font-medium text-stone-600 mb-1"
              >
                Họ và Tên <span className="text-red-500">*</span>
              </label>
              <input
                id="parent-name"
                name="parent-name"
                type="text"
                placeholder="Nhập họ và tên..."
                value={newParentName}
                onChange={(e) => setNewParentName(e.target.value)}
                className="bg-white text-stone-900 placeholder-stone-400 block w-full text-sm rounded-lg border-stone-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 p-2 sm:p-2.5 border transition-colors"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="parent-gender"
                  className="block text-xs font-medium text-stone-600 mb-1"
                >
                  Giới tính
                </label>
                <select
                  id="parent-gender"
                  value={newParentGender}
                  onChange={(e) =>
                    setNewParentGender(e.target.value as "male" | "female")
                  }
                  className="bg-white text-stone-900 block w-full text-sm rounded-lg border-stone-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 p-2 sm:p-2.5 border transition-colors"
                >
                  <option value="male">Nam (Cha)</option>
                  <option value="female">Nữ (Mẹ)</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="parent-birth-year"
                  className="block text-xs font-medium text-stone-600 mb-1"
                >
                  Năm sinh (Tuỳ chọn)
                </label>
                <input
                  id="parent-birth-year"
                  name="parent-birth-year"
                  type="number"
                  placeholder="VD: 1950"
                  value={newParentBirthYear}
                  onChange={(e) => setNewParentBirthYear(e.target.value)}
                  className="bg-white text-stone-900 placeholder-stone-400 block w-full text-sm rounded-lg border-stone-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 p-2 sm:p-2.5 border transition-colors"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="parent-rel-type"
                className="block text-xs font-medium text-stone-600 mb-1"
              >
                Quan hệ
              </label>
              <select
                id="parent-rel-type"
                value={newParentRelType}
                onChange={(e) =>
                  setNewParentRelType(
                    e.target.value as "biological_child" | "adopted_child",
                  )
                }
                className="bg-white text-stone-900 block w-full text-sm rounded-lg border-stone-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 p-2 sm:p-2.5 border transition-colors"
              >
                <option value="biological_child">Cha/Mẹ ruột</option>
                <option value="adopted_child">Cha/Mẹ nuôi</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="parent-note"
                className="block text-xs font-medium text-stone-600 mb-1"
              >
                Ghi chú (Tuỳ chọn)
              </label>
              <input
                id="parent-note"
                name="parent-note"
                type="text"
                placeholder="Tuỳ chọn..."
                value={newParentNote}
                onChange={(e) => setNewParentNote(e.target.value)}
                className="bg-white text-stone-900 placeholder-stone-400 block w-full text-sm rounded-lg border-stone-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 p-2 sm:p-2.5 border transition-colors"
              />
            </div>

            <p className="text-xs text-stone-500 italic mt-1">
              * Đây là thêm NGƯỜI MỚI làm cha/mẹ của {person.full_name}, không
              phải chọn người đã có sẵn trong gia phả.
            </p>

            <div className="flex gap-2 pt-2">
              <button
                onClick={handleAddParent}
                disabled={!newParentName.trim() || processing}
                className="flex-1 bg-emerald-600 text-white py-2 sm:py-2.5 rounded-md sm:rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                {processing ? "Đang lưu..." : "Lưu"}
              </button>
              <button
                onClick={() => {
                  setIsAddingParent(false);
                  setNewParentName("");
                  setNewParentBirthYear("");
                  setNewParentNote("");
                  setNewParentRelType("biological_child");
                }}
                className="px-4 py-2 sm:py-2.5 bg-white border border-stone-300 text-stone-700 rounded-md sm:rounded-lg text-sm hover:bg-stone-50 transition-colors"
              >
                Hủy
              </button>
            </div>
            {error && (
              <div className="mt-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-100 flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                <svg
                  className="w-4 h-4 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                {error}
              </div>
            )}
          </div>
        </div>
      )}

      {divorceRel && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-stone-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-5 shadow-2xl">
            <h4 className="text-base font-bold text-stone-900">
              Xác nhận ly hôn
            </h4>
            <p className="mt-1 text-sm text-stone-600">
              {person.full_name} và {divorceRel.targetPerson.full_name}
            </p>

            <div className="mt-4 space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="divorce-date"
                    className="mb-1 block text-xs font-medium text-stone-600"
                  >
                    Ngày ly hôn
                  </label>
                  <input
                    id="divorce-date"
                    type="text"
                    inputMode="numeric"
                    placeholder="dd-mm-yyyy"
                    value={divorceDate}
                    onChange={(e) => setDivorceDate(e.target.value)}
                    className="block w-full rounded-lg border border-stone-300 bg-white p-2 text-sm text-stone-900 placeholder-stone-400 shadow-sm focus:border-red-500 focus:ring-red-500"
                  />
                </div>
                <div>
                  <label
                    htmlFor="divorce-date-precision"
                    className="mb-1 block text-xs font-medium text-stone-600"
                  >
                    Độ chính xác
                  </label>
                  <select
                    id="divorce-date-precision"
                    value={divorceDatePrecision}
                    onChange={(e) => setDivorceDatePrecision(e.target.value as any)}
                    className="block w-full rounded-lg border border-stone-300 bg-white p-2 text-sm text-stone-900 shadow-sm focus:border-red-500 focus:ring-red-500"
                  >
                    <option value="unknown">Không rõ</option>
                    <option value="day">Chính xác ngày</option>
                    <option value="month">Chỉ tháng/năm</option>
                    <option value="year">Chỉ năm</option>
                  </select>
                </div>
              </div>

              <div>
                <label
                  htmlFor="divorce-note"
                  className="mb-1 block text-xs font-medium text-stone-600"
                >
                  Ghi chú ly hôn
                </label>
                <textarea
                  id="divorce-note"
                  rows={3}
                  value={divorceNote}
                  onChange={(e) => setDivorceNote(e.target.value)}
                  placeholder="Tuỳ chọn..."
                  className="block w-full rounded-lg border border-stone-300 bg-white p-2 text-sm text-stone-900 placeholder-stone-400 shadow-sm focus:border-red-500 focus:ring-red-500"
                />
              </div>

              <p className="text-xs leading-relaxed text-stone-500">
                Nếu nhập ngày, hệ thống sẽ tạo sự kiện ly hôn trong Event Model và GEDCOM export sẽ có DIV.
              </p>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={closeDivorceModal}
                disabled={processing}
                className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmDivorce}
                disabled={processing}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {processing ? "Đang lưu..." : "Xác nhận ly hôn"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

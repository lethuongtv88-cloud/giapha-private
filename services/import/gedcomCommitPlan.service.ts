export type CommitPlanSeverity = "error" | "warning" | "info";

export interface CommitPlanIssue {
  severity: CommitPlanSeverity;
  title: string;
  description: string;
  recordId?: string;
  recordType?: string;
  externalId?: string | null;
}

export interface StagingRecordForCommitPlan {
  id: string;
  record_type: string;
  external_id: string | null;
  parent_external_id: string | null;
  action: string;
  confidence: string;
  status: string;
  normalized_payload: Record<string, any>;
  warnings?: string[] | null;
  errors?: string[] | null;
  sort_order?: number | null;
}

export interface GedcomCommitPlan {
  ok: boolean;
  sessionId: string;
  approvedRecords: number;
  counts: {
    persons: number;
    personNames: number;
    families: number;
    familyParents: number;
    familyChildren: number;
    events: number;
    personEvents: number;
    skipped: number;
    unsupported: number;
  };
  issues: CommitPlanIssue[];
  externalIds: {
    persons: string[];
    families: string[];
    events: string[];
  };
}

export function buildGedcomCommitPlan(input: {
  sessionId: string;
  records: StagingRecordForCommitPlan[];
}): GedcomCommitPlan {
  const approved = input.records
    .filter((record) => record.status === "approved")
    .filter((record) => record.action === "create")
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  const issues: CommitPlanIssue[] = [];

  const personExternalIds = new Set<string>();
  const familyExternalIds = new Set<string>();
  const eventExternalIds = new Set<string>();

  const counts = {
    persons: 0,
    personNames: 0,
    families: 0,
    familyParents: 0,
    familyChildren: 0,
    events: 0,
    personEvents: 0,
    skipped: 0,
    unsupported: 0,
  };

  const pendingPersonMatches = input.records.filter((record) => {
    return (
      record.record_type === "person" &&
      record.action === "match" &&
      record.status === "pending"
    );
  });

  if (pendingPersonMatches.length > 0) {
    issues.push({
      severity: "error",
      title: "Còn possible matches chưa duyệt",
      description: `Session còn ${pendingPersonMatches.length} person records action=match status=pending. Hãy mở Match Review để skip hoặc chuyển thành create trước khi commit.`,
      recordType: "person",
    });
  }

  for (const record of approved) {
    const externalId = record.external_id;

    if (record.errors && record.errors.length > 0) {
      issues.push({
        severity: "error",
        title: "Approved record vẫn còn errors",
        description: `Record ${record.id} đã approved nhưng errors không rỗng.`,
        recordId: record.id,
        recordType: record.record_type,
        externalId,
      });
    }

    if (!externalId && record.record_type !== "person_event") {
      issues.push({
        severity: "warning",
        title: "Record không có external_id",
        description: `Record ${record.id} type=${record.record_type} không có external_id.`,
        recordId: record.id,
        recordType: record.record_type,
        externalId,
      });
    }

    switch (record.record_type) {
      case "person": {
        counts.persons += 1;
        if (externalId) personExternalIds.add(externalId);

        const fullName = record.normalized_payload.full_name;
        if (!fullName || fullName === "Chưa rõ tên") {
          issues.push({
            severity: "warning",
            title: "Person chưa có tên rõ",
            description: "Person approved nhưng full_name trống hoặc chưa rõ.",
            recordId: record.id,
            recordType: record.record_type,
            externalId,
          });
        }

        break;
      }

      case "name": {
        counts.personNames += 1;

        const personExternalId = record.normalized_payload.person_external_id;
        if (!personExternalId) {
          issues.push({
            severity: "error",
            title: "Name thiếu person_external_id",
            description: "Không thể commit person_name nếu không biết thuộc person nào.",
            recordId: record.id,
            recordType: record.record_type,
            externalId,
          });
        }

        break;
      }

      case "family": {
        counts.families += 1;
        if (externalId) familyExternalIds.add(externalId);
        break;
      }

      case "family_parent": {
        counts.familyParents += 1;

        const familyExternalId = record.normalized_payload.family_external_id;
        const personExternalId = record.normalized_payload.person_external_id;

        if (!familyExternalId || !personExternalId) {
          issues.push({
            severity: "error",
            title: "Family parent thiếu mapping",
            description: "family_parent cần family_external_id và person_external_id.",
            recordId: record.id,
            recordType: record.record_type,
            externalId,
          });
        }

        break;
      }

      case "family_child": {
        counts.familyChildren += 1;

        const familyExternalId = record.normalized_payload.family_external_id;
        const personExternalId = record.normalized_payload.person_external_id;

        if (!familyExternalId || !personExternalId) {
          issues.push({
            severity: "error",
            title: "Family child thiếu mapping",
            description: "family_child cần family_external_id và person_external_id.",
            recordId: record.id,
            recordType: record.record_type,
            externalId,
          });
        }

        break;
      }

      case "event": {
        counts.events += 1;
        if (externalId) eventExternalIds.add(externalId);

        const type = record.normalized_payload.type;
        if (!type) {
          issues.push({
            severity: "error",
            title: "Event thiếu type",
            description: "Không thể commit event nếu thiếu type.",
            recordId: record.id,
            recordType: record.record_type,
            externalId,
          });
        }

        break;
      }

      case "person_event": {
        counts.personEvents += 1;

        const personExternalId = record.normalized_payload.person_external_id;
        const eventExternalId = record.normalized_payload.event_external_id;

        if (!personExternalId || !eventExternalId) {
          issues.push({
            severity: "error",
            title: "Person event thiếu mapping",
            description: "person_event cần person_external_id và event_external_id.",
            recordId: record.id,
            recordType: record.record_type,
            externalId,
          });
        }

        break;
      }

      case "warning":
      case "unknown":
      case "note":
      case "source":
      case "media": {
        counts.unsupported += 1;

        issues.push({
          severity: "info",
          title: "Record type chưa commit ở bước này",
          description: `record_type=${record.record_type} hiện chỉ preview, chưa commit vào schema thật.`,
          recordId: record.id,
          recordType: record.record_type,
          externalId,
        });

        break;
      }

      default: {
        counts.unsupported += 1;

        issues.push({
          severity: "warning",
          title: "Record type không hỗ trợ",
          description: `record_type=${record.record_type} chưa có commit handler.`,
          recordId: record.id,
          recordType: record.record_type,
          externalId,
        });
      }
    }
  }

  for (const record of approved) {
    if (record.record_type === "name") {
      const personExternalId = record.normalized_payload.person_external_id;
      if (personExternalId && !personExternalIds.has(personExternalId)) {
        issues.push({
          severity: "error",
          title: "Name trỏ tới person chưa được approve",
          description: `Name trỏ tới person_external_id=${personExternalId}, nhưng person đó không nằm trong approved person records.`,
          recordId: record.id,
          recordType: record.record_type,
          externalId: record.external_id,
        });
      }
    }

    if (record.record_type === "family_parent" || record.record_type === "family_child") {
      const familyExternalId = record.normalized_payload.family_external_id;
      const personExternalId = record.normalized_payload.person_external_id;

      if (familyExternalId && !familyExternalIds.has(familyExternalId)) {
        issues.push({
          severity: "error",
          title: "Family edge trỏ tới family chưa được approve",
          description: `Record trỏ tới family_external_id=${familyExternalId}, nhưng family đó chưa được approve.`,
          recordId: record.id,
          recordType: record.record_type,
          externalId: record.external_id,
        });
      }

      if (personExternalId && !personExternalIds.has(personExternalId)) {
        issues.push({
          severity: "error",
          title: "Family edge trỏ tới person chưa được approve",
          description: `Record trỏ tới person_external_id=${personExternalId}, nhưng person đó chưa được approve.`,
          recordId: record.id,
          recordType: record.record_type,
          externalId: record.external_id,
        });
      }
    }

    if (record.record_type === "person_event") {
      const personExternalId = record.normalized_payload.person_external_id;
      const eventExternalId = record.normalized_payload.event_external_id;

      if (personExternalId && !personExternalIds.has(personExternalId)) {
        issues.push({
          severity: "error",
          title: "Person event trỏ tới person chưa được approve",
          description: `person_external_id=${personExternalId} chưa có trong approved person records.`,
          recordId: record.id,
          recordType: record.record_type,
          externalId: record.external_id,
        });
      }

      if (eventExternalId && !eventExternalIds.has(eventExternalId)) {
        issues.push({
          severity: "error",
          title: "Person event trỏ tới event chưa được approve",
          description: `event_external_id=${eventExternalId} chưa có trong approved event records.`,
          recordId: record.id,
          recordType: record.record_type,
          externalId: record.external_id,
        });
      }
    }
  }

  const errors = issues.filter((issue) => issue.severity === "error").length;

  return {
    ok: errors === 0,
    sessionId: input.sessionId,
    approvedRecords: approved.length,
    counts,
    issues,
    externalIds: {
      persons: Array.from(personExternalIds),
      families: Array.from(familyExternalIds),
      events: Array.from(eventExternalIds),
    },
  };
}

import type {
  DualAncestryGraph,
  DualAncestryPersonNode,
  DualTreeSubgraph,
} from "@/utils/tree/buildDualAncestryGraph";
import { AlertTriangle, Baby, Heart, Mars, User, Users, Venus } from "lucide-react";

interface MaternalPaternalTreeProps {
  graph: DualAncestryGraph;
}

function getPersonName(node: DualAncestryPersonNode): string {
  return node.person.full_name || node.person.id;
}

function getGenderIcon(node: DualAncestryPersonNode) {
  if (node.person.gender === "male") return <Mars className="size-3.5 text-blue-500" />;
  if (node.person.gender === "female") return <Venus className="size-3.5 text-pink-500" />;
  return <User className="size-3.5 text-stone-400" />;
}

function getNodeStyle(node: DualAncestryPersonNode): string {
  if (node.side === "root") {
    return "border-amber-300 bg-amber-50 shadow-amber-100";
  }

  if (node.side === "paternal") {
    return "border-blue-200 bg-blue-50/70 shadow-blue-50";
  }

  if (node.side === "maternal") {
    return "border-pink-200 bg-pink-50/70 shadow-pink-50";
  }

  if (node.side === "descendant") {
    return "border-emerald-200 bg-emerald-50/70 shadow-emerald-50";
  }

  if (node.side === "spouse") {
    return "border-rose-200 bg-rose-50/70 shadow-rose-50";
  }

  if (node.side === "shared") {
    return "border-purple-200 bg-purple-50/70 shadow-purple-50";
  }

  return "border-stone-200 bg-white shadow-stone-50";
}

function PersonCard({ node }: { node: DualAncestryPersonNode }) {
  return (
    <div
      className={`rounded-xl border p-3 shadow-sm min-w-44 ${getNodeStyle(node)}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="font-semibold text-sm text-stone-900 line-clamp-2">
          {getPersonName(node)}
        </div>
        {getGenderIcon(node)}
      </div>

      <div className="mt-1 flex items-center justify-between text-[11px] text-stone-500">
        <span>Đời ±{node.depth}</span>
        {node.person.birth_year ? <span>{node.person.birth_year}</span> : null}
      </div>

      {node.note ? (
        <div className="mt-1 text-[11px] text-stone-400">{node.note}</div>
      ) : null}
    </div>
  );
}

function SubgraphColumn({
  graph,
  emptyText,
  accent,
}: {
  graph: DualTreeSubgraph;
  emptyText: string;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white/80 p-4 shadow-sm">
      <h3 className="mb-4 flex items-center justify-between text-sm font-bold text-stone-800">
        <span>{graph.title}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs ${accent}`}>
          {graph.nodes.length}
        </span>
      </h3>

      {graph.nodes.length > 0 ? (
        <div className="space-y-3">
          {graph.nodes.map((node) => (
            <PersonCard key={`${node.side}-${node.person.id}-${node.depth}`} node={node} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-stone-200 bg-stone-50 p-4 text-sm text-stone-400">
          {emptyText}
        </div>
      )}
    </div>
  );
}

export default function MaternalPaternalTree({ graph }: MaternalPaternalTreeProps) {
  if (!graph.root) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        Không thể dựng cây hai nhánh vì chưa có người gốc hợp lệ.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {graph.warnings.length > 0 ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <div className="mb-2 flex items-center gap-2 font-semibold">
            <AlertTriangle className="size-4" />
            Cảnh báo dữ liệu
          </div>
          <ul className="list-inside list-disc space-y-1">
            {graph.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr]">
        <SubgraphColumn
          graph={graph.paternal}
          emptyText="Chưa có dữ liệu nhánh cha / họ nội."
          accent="bg-blue-100 text-blue-700"
        />

        <div className="flex flex-col items-center justify-center gap-3">
          <div className="rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-bold text-amber-700 shadow-sm">
            Người gốc
          </div>
          <PersonCard node={graph.root} />
          <div className="hidden h-16 w-px bg-stone-200 lg:block" />
        </div>

        <SubgraphColumn
          graph={graph.maternal}
          emptyText="Chưa có dữ liệu nhánh mẹ / họ ngoại."
          accent="bg-pink-100 text-pink-700"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <SubgraphColumn
          graph={graph.descendants}
          emptyText="Chưa có dữ liệu con cháu của người gốc."
          accent="bg-emerald-100 text-emerald-700"
        />

        <SubgraphColumn
          graph={graph.spouses}
          emptyText="Không có hoặc đang ẩn vợ/chồng/dâu/rễ liên quan."
          accent="bg-rose-100 text-rose-700"
        />

        <SubgraphColumn
          graph={graph.shared}
          emptyText="Không có người xuất hiện đồng thời ở hai nhánh."
          accent="bg-purple-100 text-purple-700"
        />
      </div>

      <div className="grid gap-3 text-xs text-stone-500 sm:grid-cols-3">
        <div className="rounded-xl border border-blue-100 bg-blue-50 p-3">
          <div className="mb-1 flex items-center gap-1 font-semibold text-blue-700">
            <Users className="size-3.5" />
            Họ nội
          </div>
          Nhánh đi qua cha của người gốc.
        </div>

        <div className="rounded-xl border border-pink-100 bg-pink-50 p-3">
          <div className="mb-1 flex items-center gap-1 font-semibold text-pink-700">
            <Heart className="size-3.5" />
            Họ ngoại
          </div>
          Nhánh đi qua mẹ của người gốc.
        </div>

        <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
          <div className="mb-1 flex items-center gap-1 font-semibold text-emerald-700">
            <Baby className="size-3.5" />
            Con cháu
          </div>
          Các đời sau của người gốc.
        </div>
      </div>
    </div>
  );
}

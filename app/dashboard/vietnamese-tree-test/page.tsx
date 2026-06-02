import { getSupabase } from '@/utils/supabase/queries';
import {
  buildVietnameseFamilyLayout,
  type VietnameseTreeFamily,
} from '@/utils/tree/vietnameseTreeLayout';

export default async function VietnameseTreeTestPage() {
  const supabase = await getSupabase();

  const { data: family } = await supabase
    .from('families')
    .select('id')
    .is('deleted_at', null)
    .limit(1)
    .single();

  if (!family?.id) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold">Vietnamese Tree Layout Test</h1>
        <p>Không tìm thấy family.</p>
      </div>
    );
  }

  const [{ data: parents }, { data: children }] = await Promise.all([
    supabase
      .from('family_parents')
      .select('role, persons:person_id(id, full_name, gender, birth_year, birth_order, generation, is_in_law)')
      .eq('family_id', family.id),
    supabase
      .from('family_children')
      .select('persons:person_id(id, full_name, gender, birth_year, birth_order, generation, is_in_law)')
      .eq('family_id', family.id),
  ]);

  const familyData: VietnameseTreeFamily = {
    familyId: family.id,
    parents: (parents ?? [])
      .map((row: any) => ({
        role: row.role,
        person: normalizePerson(row.persons),
      }))
      .filter((row: any) => row.person),
    children: (children ?? [])
      .map((row: any) => normalizePerson(row.persons))
      .filter(Boolean),
  };

  const layout = buildVietnameseFamilyLayout(familyData);

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Vietnamese Tree Layout Test</h1>
        <p className="text-sm text-stone-500">
          Family ID: {family.id}
        </p>
      </div>

      <div className="overflow-auto rounded-xl border bg-white p-4">
        <svg
          width={layout.width + 80}
          height={layout.height + 80}
          className="bg-stone-50"
        >
          <g transform="translate(40, 40)">
            {layout.lines.map((line) => (
              <line
                key={line.id}
                x1={line.x1}
                y1={line.y1}
                x2={line.x2}
                y2={line.y2}
                stroke="#a8a29e"
                strokeWidth={2}
              />
            ))}

            {layout.nodes.map((node) => (
              <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
                <rect
                  width={180}
                  height={72}
                  rx={14}
                  fill="white"
                  stroke={node.role === 'parent' ? '#d97706' : '#78716c'}
                />
                <text
                  x={90}
                  y={32}
                  textAnchor="middle"
                  fontSize={13}
                  fontWeight={600}
                  fill="#292524"
                >
                  {node.person.full_name}
                </text>
                <text
                  x={90}
                  y={52}
                  textAnchor="middle"
                  fontSize={11}
                  fill="#78716c"
                >
                  {node.role === 'parent' ? 'Cha/Mẹ' : 'Con'}
                  {node.person.birth_year ? ` · ${node.person.birth_year}` : ''}
                </text>
              </g>
            ))}
          </g>
        </svg>
      </div>
    </div>
  );
}

function normalizePerson(value: any) {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

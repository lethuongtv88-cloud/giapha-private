import { describe, expect, it } from 'vitest';
import { buildVietnameseFamilyLayout } from '../../utils/tree/vietnameseTreeLayout';

describe('buildVietnameseFamilyLayout', () => {
  it('places parents horizontally and children below family center', () => {
    const layout = buildVietnameseFamilyLayout({
      familyId: 'f1',
      parents: [
        {
          role: 'husband',
          person: { id: 'father', full_name: 'Nguyễn Văn Cha', gender: 'male' },
        },
        {
          role: 'wife',
          person: { id: 'mother', full_name: 'Trần Thị Mẹ', gender: 'female' },
        },
      ],
      children: [
        { id: 'c1', full_name: 'Nguyễn Con Một', birth_order: 1, birth_year: 1980 },
        { id: 'c2', full_name: 'Nguyễn Con Hai', birth_order: 2, birth_year: 1982 },
      ],
    });

    const parents = layout.nodes.filter((node) => node.role === 'parent');
    const children = layout.nodes.filter((node) => node.role === 'child');

    expect(parents).toHaveLength(2);
    expect(children).toHaveLength(2);

    expect(parents[0].y).toBe(parents[1].y);
    expect(children[0].y).toBeGreaterThan(parents[0].y);

    expect(layout.lines.some((line) => line.type === 'spouse')).toBe(true);
    expect(layout.lines.filter((line) => line.type === 'child')).toHaveLength(2);
  });

  it('sorts children by birth_order then birth_year', () => {
    const layout = buildVietnameseFamilyLayout({
      familyId: 'f1',
      parents: [
        {
          role: 'husband',
          person: { id: 'father', full_name: 'Nguyễn Văn Cha' },
        },
      ],
      children: [
        { id: 'c2', full_name: 'Con Hai', birth_order: 2, birth_year: 1982 },
        { id: 'c1', full_name: 'Con Một', birth_order: 1, birth_year: 1980 },
      ],
    });

    const children = layout.nodes.filter((node) => node.role === 'child');

    expect(children[0].person.id).toBe('c1');
    expect(children[1].person.id).toBe('c2');
  });
});

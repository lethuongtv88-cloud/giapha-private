import { describe, it, expect } from 'vitest';
import { parseGedcom } from '@/utils/gedcom';

describe('GEDCOM parser hotfix', () => {
  it('imports FAM child with both parents', () => {
    const ged = [
      '0 HEAD',
      '1 CHAR UTF-8',
      '0 @I1@ INDI',
      '1 NAME Văn An /Nguyễn/',
      '1 SEX M',
      '0 @I2@ INDI',
      '1 NAME Thị Bình /Trần/',
      '1 SEX F',
      '0 @I3@ INDI',
      '1 NAME Văn Con /Nguyễn/',
      '1 SEX M',
      '0 @F1@ FAM',
      '1 HUSB @I1@',
      '1 WIFE @I2@',
      '1 CHIL @I3@',
      '0 TRLR',
    ].join('\r\n');

    const out = parseGedcom(ged);
    expect(out.relationships.filter((r: any) => r.type === 'biological_child')).toHaveLength(2);
  });
});

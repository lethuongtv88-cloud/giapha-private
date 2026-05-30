import { describe, it, expect } from 'vitest';
import { exportToGedcom, exportToGedcomWithWarnings } from '@/utils/gedcom';

describe('GEDCOM exporter v2.3.3 final', () => {
  it('adds UTF-8 BOM and header', () => {
    const out = exportToGedcom({ persons: [], relationships: [] });
    expect(out.charCodeAt(0)).toBe(0xFEFF);
    expect(out).toContain('1 CHAR UTF-8');
    expect(out).toContain('1 LANG Vietnamese');
    expect(out).toContain('\r\n');
  });

  it('exports Vietnamese name correctly', () => {
    const out = exportToGedcom({
      persons: [{ id: 'p1', full_name: 'Nguyễn Văn An', gender: 'male' }],
      relationships: [],
    });

    expect(out).toContain('1 NAME Văn An /Nguyễn/');
    expect(out).toContain('2 SURN Nguyễn');
    expect(out).toContain('2 GIVN Văn An');
    expect(out).not.toContain('Nguyễn Văn /An/');
  });

  it('escapes @ inside text values', () => {
    const out = exportToGedcom({
      persons: [{ id: 'p1', full_name: 'Nguyễn @ An', gender: 'male' }],
      relationships: [],
    });

    expect(out).toContain('@@');
  });

  it('wraps long Vietnamese notes under 255 bytes', () => {
    const note = 'Ông Nguyễn Văn An sinh tại làng Đình Bảng, Từ Sơn, Bắc Ninh. '.repeat(12);
    const out = exportToGedcom({
      persons: [{ id: 'p1', full_name: 'Nguyễn Văn An', gender: 'male', note }],
      relationships: [],
    });

    for (const line of out.split('\r\n').filter(Boolean)) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(255);
    }
  });

  it('returns warnings for ambiguous legacy family export', () => {
    const result = exportToGedcomWithWarnings({
      persons: [
        { id: 'a', full_name: 'Nguyễn Văn A', gender: 'male' },
        { id: 'b', full_name: 'Trần Thị B', gender: 'female' },
        { id: 'd', full_name: 'Lê Thị D', gender: 'female' },
        { id: 'c', full_name: 'Nguyễn Văn C', gender: 'male' },
      ],
      relationships: [
        { type: 'marriage', person_a: 'a', person_b: 'b' },
        { type: 'marriage', person_a: 'a', person_b: 'd' },
        { type: 'biological_child', person_a: 'a', person_b: 'c' },
      ],
    });

    expect(result.content).toContain('0 HEAD');
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

const CRLF = '\r\n';
const BOM = '\uFEFF';
const MAX_BYTES = 248;
const encoder = new TextEncoder();

export class GedcomWriter {
  private lines: string[] = [];

  addRaw(line: string) {
    this.lines.push(line);
  }

  add(level: number, tag: string, value?: string | null) {
    if (value == null || value === '') {
      this.lines.push(`${level} ${tag}`);
      return;
    }
    this.addWrapped(level, tag, value);
  }

  addWrapped(level: number, tag: string, value: string) {
    const paragraphs = String(value).split(/\r?\n/);
    paragraphs.forEach((paragraph, idx) => {
      const clean = escapeGedcomTextValue(paragraph.trimEnd());
      const firstTag = idx === 0 ? tag : 'CONT';
      const firstLevel = idx === 0 ? level : level + 1;
      emitWrappedLine(this.lines, firstLevel, firstTag, clean);
    });
  }

  toString() {
    return BOM + this.lines.join(CRLF) + CRLF;
  }
}

function emitWrappedLine(lines: string[], level: number, tag: string, value: string) {
  let remaining = value;
  let currentTag = tag;
  let currentLevel = level;

  if (remaining.length === 0) {
    lines.push(`${level} ${tag}`);
    return;
  }

  while (remaining.length > 0) {
    const prefix = `${currentLevel} ${currentTag} `;
    const chunk = takeUtf8Chunk(remaining, MAX_BYTES - byteLen(prefix));
    lines.push(prefix + chunk);
    remaining = remaining.slice(chunk.length);
    currentTag = 'CONC';
    currentLevel = level + 1;
  }
}

function takeUtf8Chunk(text: string, maxBytes: number) {
  let out = '';
  for (const ch of text) {
    if (byteLen(out + ch) > maxBytes) break;
    out += ch;
  }
  return out;
}

function byteLen(s: string) {
  return encoder.encode(s).length;
}

/**
 * Chỉ dùng cho value text.
 * Tuyệt đối KHÔNG dùng cho dòng XREF như: 0 @I1@ INDI.
 */
export function escapeGedcomTextValue(value: string) {
  return value.replace(/@/g, '@@');
}

export type ParsedSegment = {
  text: string;
  colorCode: number;
  attrCode: number;
  fontCode: number;
  widthCode: number;
};

export function parseTxt(raw: string): ParsedSegment[] {
  let i = 0;
  let color = 0;
  let attr = 0;
  let font = 0;
  let width = 1;
  let buffer = '';
  const segments: ParsedSegment[] = [];

  const flush = () => {
    if (!buffer) return;
    segments.push({
      text: buffer,
      colorCode: color,
      attrCode: attr,
      fontCode: font,
      widthCode: width,
    });
    buffer = '';
  };

  while (i < raw.length) {
    if (raw[i] === '$' && i + 3 < raw.length) {
      const type = raw[i + 1];
      const code = raw.slice(i + 2, i + 4);
      const num = Number(code);
      flush();
      if (type === 'c') color = num;
      if (type === 'a') attr = num;
      if (type === 'f') font = num;
      if (type === 'w') width = num;
      i += 4;
    } else {
      buffer += raw[i];
      i++;
    }
  }
  flush();
  return segments;
}

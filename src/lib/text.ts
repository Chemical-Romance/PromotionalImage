const CJK = /[\u2e80-\u9fff\uf900-\ufaff\uff00-\uffef\u3000-\u303f]/;

function tokenize(text: string): string[] {
  const tokens: string[] = [];
  let buffer = '';
  for (const ch of text) {
    if (ch === ' ') {
      if (buffer) {
        tokens.push(buffer);
        buffer = '';
      }
      tokens.push(' ');
    } else if (CJK.test(ch)) {
      if (buffer) {
        tokens.push(buffer);
        buffer = '';
      }
      tokens.push(ch);
    } else {
      buffer += ch;
    }
  }
  if (buffer) tokens.push(buffer);
  return tokens;
}

/** Word wrap that understands CJK (break anywhere) and latin words. */
export function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const lines: string[] = [];
  const paragraphs = text.split(/\r?\n/);

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) {
      if (paragraphs.length > 1) lines.push('');
      continue;
    }
    const tokens = tokenize(trimmed);
    let line = '';
    for (const token of tokens) {
      if (token === ' ' && !line) continue;
      const candidate = line + token;
      if (!line.trim() || ctx.measureText(candidate).width <= maxWidth) {
        line = candidate;
      } else {
        lines.push(line.trimEnd());
        line = token.trimStart();
      }
    }
    if (line.trim()) lines.push(line.trimEnd());
  }

  return lines;
}

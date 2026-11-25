export const needsReadingPanel = (text: string): boolean => text.length > 420 || /```|^\s*(?:[-*+]\s|\d+[.)]\s)/m.test(text);
export const readingTime = (text: string): number => Math.max(2200, text.length * 45);
export function splitBeats(text: string): string[] {
  const sentences = text.trim().match(/[^.!?\n]+(?:[.!?]+(?=\s|$)|$)|[^\n]+/g) ?? [];
  return sentences.flatMap(sentence => {
    const result: string[] = []; let part = '';
    for (const word of sentence.trim().split(/\s+/)) {
      if ((part + ' ' + word).length > 180 && part) { result.push(part); part = ''; }
      part += (part ? ' ' : '') + word;
    }
    if (part) result.push(part); return result;
  });
}
/** A tiny AST: renderers must create text nodes, never interpret model HTML. */
export type Inline = { kind: 'text' | 'strong' | 'code'; text: string };
export type MarkdownBlock = { kind: 'p' | 'pre' | 'ul' | 'ol'; lines: Inline[][] };
export function inlineMarkdown(text: string): Inline[] {
  return text.split(/(\*\*[^*\n]+\*\*|`[^`\n]+`)/g).filter(Boolean).map(value =>
    value.startsWith('**') && value.endsWith('**') ? { kind: 'strong', text: value.slice(2, -2) } :
    value.startsWith('`') && value.endsWith('`') ? { kind: 'code', text: value.slice(1, -1) } : { kind: 'text', text: value });
}
export function parseMarkdown(text: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = []; let code: string[] | undefined;
  for (const line of text.split('\n')) {
    if (/^\s*```/.test(line)) {
      if (code) { blocks.push({ kind: 'pre', lines: [[{ kind: 'text', text: code.join('\n') }]] }); code = undefined; }
      else code = []; continue;
    }
    if (code) { code.push(line); continue; }
    if (!line.trim()) continue;
    const list = /^\s*(?:([-*+])|\d+[.)])\s+(.*)$/.exec(line);
    const kind = list ? (list[1] ? 'ul' : 'ol') : 'p';
    const previous = blocks.at(-1);
    if (list && previous?.kind === kind) previous.lines.push(inlineMarkdown(list[2]));
    else blocks.push({ kind, lines: [inlineMarkdown(list?.[2] ?? line)] });
  }
  if (code) blocks.push({ kind: 'pre', lines: [[{ kind: 'text', text: code.join('\n') }]] });
  return blocks;
}

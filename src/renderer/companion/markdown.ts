import { parseMarkdown } from '../../core/conversation/presentation';
/** Model strings enter textContent/createTextNode only. No HTML, links or image loads. */
export function renderMarkdown(target: HTMLElement, text: string, doc: Document = document): void {
  target.replaceChildren();
  for (const block of parseMarkdown(text)) {
    const element = doc.createElement(block.kind);
    for (const line of block.lines) {
      const parent = block.kind === 'ul' || block.kind === 'ol' ? doc.createElement('li') : element;
      for (const inline of line) {
        if (inline.kind === 'text') parent.appendChild(doc.createTextNode(inline.text));
        else { const node = doc.createElement(inline.kind); node.textContent = inline.text; parent.appendChild(node); }
      }
      if (parent !== element) element.appendChild(parent);
    }
    target.appendChild(element);
  }
}

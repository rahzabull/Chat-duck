/** A real button keeps Enter/Space and focus semantics on every surface. */
export function closeButton(close: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button'; button.textContent = '×'; button.className = 'close-button';
  button.setAttribute('aria-label', 'Close'); button.onclick = close;
  return button;
}

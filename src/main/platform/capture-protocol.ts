export const CAPTURE_MAX_WIDTH = 1280;
export const CAPTURE_MAX_HEIGHT = 800;
export const CAPTURE_MAX_LINE = 400 * 1024;
export const CAPTURE_SKIP_REASONS = ['invalid', 'busy', 'foreground', 'minimized', 'self', 'private', 'fullscreen', 'unavailable', 'size', 'render', 'oversized'] as const;

/** Decimal strings only: no PowerShell expressions, signs, whitespace or overflow. */
export function captureCommand(hwnd: string, maxW: number, maxH: number): string | undefined {
  if (!/^[1-9][0-9]{0,18}$/.test(hwnd) || /[^0-9]/.test(hwnd) || BigInt(hwnd) > 9223372036854775807n
    || !Number.isInteger(maxW) || maxW < 1 || maxW > CAPTURE_MAX_WIDTH
    || !Number.isInteger(maxH) || maxH < 1 || maxH > CAPTURE_MAX_HEIGHT) return;
  return `capture ${hwnd} ${maxW} ${maxH}\n`;
}

export function captureReply(line: string): string | undefined {
  if (line.length > CAPTURE_MAX_LINE || !line.startsWith('capture|ok|')) return;
  const jpeg = line.slice(11);
  if (!jpeg || jpeg.length % 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(jpeg)) return;
  const bytes = Buffer.from(jpeg, 'base64');
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes.at(-2) !== 0xff || bytes.at(-1) !== 0xd9) return;
  return jpeg;
}

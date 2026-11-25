export interface Rect { x: number; y: number; width: number; height: number }
export type ReturnLayout = ReturnType<typeof conversationLayout>['layout'];
/** Union the original duck with a temporary response surface; feet never move. */
export function conversationLayout(base: Rect, area: Rect, panel: boolean) {
  const width = Math.min(panel ? 420 : 300, area.width);
  // Keep the full three-line input above the hat (art starts near 0.47h).
  const inputBottom = base.y + base.height * .43;
  const desiredHeight = panel ? 360 : 120;
  const topSpace = inputBottom - area.y - 88;
  const beside = topSpace < Math.min(desiredHeight, 120);
  const height = Math.min(desiredHeight, beside ? area.height - 88 : Math.max(60, topSpace));
  const contentY = beside ? Math.max(area.y, Math.min(base.y, area.y + area.height - height - 88)) : inputBottom - height - 88;
  const preferredX = beside ? (base.x - width - 8 >= area.x ? base.x - width - 8 : base.x + base.width + 8) : base.x + base.width / 2 - width / 2;
  const contentX = Math.max(area.x, Math.min(preferredX, area.x + area.width - width));
  const x = Math.floor(Math.min(base.x, contentX)); const y = Math.floor(Math.min(base.y, contentY));
  const right = Math.ceil(Math.max(base.x + base.width, contentX + width));
  const bottom = Math.ceil(Math.max(base.y + base.height, contentY + height + 88));
  return { bounds: { x, y, width: right - x, height: bottom - y }, layout: {
    x: base.x - x, y: base.y - y, width: base.width, height: base.height,
    contentX: contentX - x, contentBottom: bottom - (contentY + height), contentWidth: width, contentHeight: height,
  } };
}

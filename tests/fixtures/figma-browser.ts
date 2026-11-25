import { FigmaDuck } from '../../src/animation/figma';
import { poseAssets } from '../../assets/characters/ducky/assets.generated';
import manifest from '../../assets/characters/ducky/parts.json';
import { ACTIVITY_POSES } from '../../src/animation/figma/poses';
import { CONVERSATION_STATES } from '../../src/animation/adapter';

function host(): HTMLElement {
  const el = document.createElement('div'); el.style.cssText = 'position:relative;width:320px;height:300px;pointer-events:none'; document.body.append(el); return el;
}
export function runChecks(): { assertions: number; poses: number; paths: number } {
  let assertions = 0;
  function assert(value: unknown, message: string): void { assertions++; if (!value) throw new Error(message); }
  const parser = new DOMParser(); let paths = 0;
  for (const [label, data] of Object.entries(manifest)) {
    const doc = parser.parseFromString(poseAssets[label], 'image/svg+xml');
    assert(!doc.querySelector('parsererror'), `${label}: XML parses`);
    assert(!doc.querySelector('rect, text, clipPath, [clip-path], [id]'), `${label}: no sheet furniture`);
    assert(label.startsWith('fallen') || (doc.querySelector('[data-part="head"]') && doc.querySelector('[data-part="body"]')), `${label}: head/body`);
    assert(doc.querySelectorAll('path').length === data.pathCount, `${label}: path count`);
    paths += data.pathCount;
    for (const p of doc.querySelectorAll('path')) assert(p.hasAttribute('data-part'), `${label}: every path classified`);
    const el = host(); const duck = new FigmaDuck(el);
    // Browser geometry also proves every SVG path parses and retains finite geometry.
    const art = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); art.innerHTML = poseAssets[label]; el.append(art);
    const bbox = art.getBBox(); assert(Number.isFinite(bbox.width) && bbox.width > 50 && bbox.height > 50, `${label}: browser bbox`);
    duck.dispose(); el.remove();
  }
  assert(paths === 312, 'Keep all 312 character layers, including white toothpicks and blue sleep bubbles');
  assert(JSON.stringify(manifest.idle.parts) === JSON.stringify({ tail: 1, 'foot-left': 1, 'foot-right': 1, body: 1, head: 1, 'wing-left': 2, 'wing-right': 2, tuft: 1, 'eye-left': 1, 'eye-right': 1, beak: 1, nostril: 2 }), 'Exact idle parts including paired wing fills/strokes');
  assert(manifest.thinking_b.parts.extra === 2 && manifest.deep_sleep_a.parts.extra === 1, 'Toothpick/detail and sleep bubble preserved');
  const originalNow = Date.now, originalTimeout = window.setTimeout, originalClear = window.clearTimeout;
  let now = 100000, serial = 0;
  const timers = new Map<number, { at: number; fn: () => void }>();
  Date.now = () => now;
  window.setTimeout = ((fn: () => void, delay = 0) => { const id = ++serial; timers.set(id, { at: now + delay, fn }); return id; }) as typeof window.setTimeout;
  window.clearTimeout = id => { timers.delete(Number(id)); };
  const advance = (ms: number) => {
    const end = now + ms; let count = 0;
    while (true) {
      const next = [...timers.entries()].sort((a, b) => a[1].at - b[1].at)[0];
      if (!next || next[1].at > end) break;
      assert(count++ < 1000, 'No runaway timer loop'); now = next[1].at; timers.delete(next[0]); next[1].fn();
    }
    now = end;
  };
  const el = host(); const duck = new FigmaDuck(el); const completions: string[] = [];
  const unsubscribe = duck.onAnimationComplete(a => completions.push(a));
  const pose = () => el.querySelector<SVGSVGElement>('.figma-duck')!.dataset.pose;
  const activity = () => el.querySelector<SVGSVGElement>('.figma-duck')!.dataset.activity;
  try {
    assert(pose() === 'idle', 'Default idle');
    assert(timers.size === 2, 'Idle only has breath and blink timers');
    assert(el.getAnimations({ subtree: true }).length === 0, 'Idle has no running CSS animations');
    const head = el.querySelector('[data-part="head"][data-duck-hit]')!.getBoundingClientRect();
    const feet = el.querySelector('[data-part="foot-left"][data-duck-hit]')!.getBoundingClientRect();
    assert(head.top - el.getBoundingClientRect().top > 140 && feet.bottom - el.getBoundingClientRect().top <= 301, 'Placeholder-sized art, feet at bottom');
    assert(!duck.hitTest(4, 4), 'Transparent pixels click through');
    assert(duck.hitTest(head.x + head.width / 2, head.y + head.height / 2), 'Painted head hit');
    duck.setEyeTarget(900, 130); const eye = el.querySelector<SVGGElement>('.eye-track')!;
    const gaze = new DOMMatrix(getComputedStyle(eye).transform); assert(Math.hypot(gaze.e, gaze.f) <= 3.01 && gaze.e > 0, 'Clamped gaze');
    duck.setDirection('left'); const mirrored = new DOMMatrix(getComputedStyle(eye).transform); assert(mirrored.e < 0, 'Mirrored gaze remains toward pointer');
    duck.setDirection('right');
    duck.play('blink'); assert(el.querySelector('.blinking'), 'Explicit blink'); advance(120); assert(!el.querySelector('.blinking') && completions.includes('blink'), 'Blink ends and completes');
    duck.setEmotion('bored'); assert(pose() === 'bored' && !el.querySelector('.eye-blink'), 'Line eyes do not blink');
    duck.setEmotion('neutral');
    for (const state of CONVERSATION_STATES) { duck.setConversationState(state); assert(!!poseAssets[pose()!], `${state}: available pose`); }
    duck.setConversationState('confused');
    const cranial = [...el.querySelectorAll<SVGGElement>('.cranial')].map(g => g.getCTM()!);
    assert(cranial.every(m => Math.abs(m.e - cranial[0].e) < .05 && Math.abs(m.f - cranial[0].f) < .05), 'Head, tuft and face share a tilt pivot without separating: ' + cranial.map(m => `${m.e.toFixed(2)},${m.f.toFixed(2)}`).join(';'));
    duck.setConversationState(null); duck.play('walking');
    el.getAnimations({ subtree: true }).forEach(a => { a.pause(); a.currentTime = 0; });
    const leftFoot = el.querySelector<SVGGElement>('g[data-part="foot-left"]')!, rightFoot = el.querySelector<SVGGElement>('g[data-part="foot-right"]')!;
    assert(getComputedStyle(leftFoot).transform !== getComputedStyle(rightFoot).transform, 'Walking feet alternate');
    duck.play('idle');
    duck.setConversationState('thinking'); assert(pose() === 'thinking_a', 'Thinking start'); advance(3000); assert(pose() === 'thinking_b', 'Thinking alternate');
    duck.setTalking(true); assert(!el.querySelector('.talking'), 'Thinking suppresses mouth');
    duck.setConversationState(null); assert(el.querySelector('.talking'), 'Independent mouth resumes'); duck.setTalking(false);
    duck.setSleeping(true); duck.play('sleeping'); assert(pose() === 'sleepy', 'Sleep starts shallow'); advance(60000); assert(pose() === 'deep_sleep_a', 'Deep sleep at 60 seconds'); advance(8000); assert(pose() === 'deep_sleep_b', 'Deep sleep alternation');
    duck.setSleeping(false); duck.play('idle');
    duck.setMotionPosition(0, 0); duck.setDragging(true); duck.play('picked_up');
    duck.setMotionPosition(-20, 1); assert(pose() === 'dragged_left', 'Left drag');
    duck.setMotionPosition(20, 2); assert(pose() === 'dragged_right', 'Right drag');
    duck.setMotionPosition(20, 40); assert(pose() === 'dragged_up_down', 'Vertical drag');
    advance(3000); assert(pose() === 'dragged_disgusted', 'Long drag disgust');
    duck.setDragging(false); duck.play('falling'); duck.setMotionPosition(20, 900); duck.play('landing_big');
    assert(pose() === 'fallen_a', 'Big landing starts fallen, never standing first'); advance(430); duck.play('idle'); assert(pose() === 'fallen_a', 'Survives main physical recovery');
    advance(300); assert(pose() === 'fallen_b', 'Fallen second pose'); advance(900); assert(pose() === 'idle' && completions.includes('landing_big'), 'Gets up after 1.6 seconds');
    duck.play('falling'); duck.setMotionPosition(20, 1100); duck.play('landing'); assert(pose() === 'idle', 'Ordinary landing never falls over, whatever the adapter measured'); advance(430);
    duck.setDragging(true); duck.setDragging(false); duck.setDragging(true); assert(pose() === 'dragged_disgusted', 'Repeated pickup disgust'); duck.setDragging(false);
    duck.play('falling'); duck.setMotionPosition(20, 185); duck.play('landing'); assert(pose() === 'idle', 'Small drop stays upright'); advance(430);
    for (const id of Object.keys(ACTIVITY_POSES).filter(id => id !== 'blink')) { duck.play(id); assert(!!poseAssets[pose()!], `${id}: available fallback`); }
    duck.play('focus'); assert(el.querySelector<SVGGElement>('[data-prop="laptop"]')!.style.display === 'inline', 'Focus laptop overlay');
    duck.setConversationState('listening'); assert(el.querySelector<SVGGElement>('[data-prop="laptop"]')!.style.display === 'none', 'Conversation hides focus overlay');
    duck.setConversationState(null); assert(activity() === 'focus', 'Conversation exit restores focus');
    poseAssets['extra:coffee'] = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 300"><path fill="#FFC954" d="M20 20H180V290H20Z"/></svg>';
    duck.play('coffee'); assert(pose() === 'extra:coffee', 'Static extra map overrides fallback without adapter changes');
    assert(el.querySelector('[data-duck-hit]') && el.querySelector<SVGGElement>('[data-prop="coffee"]')!.style.display === 'none', 'Plain extra has painted hits and hides fallback prop');
    delete poseAssets['extra:coffee'];
    duck.play('celebrate'); duck.setReducedMotion(true); assert(el.getAnimations({ subtree: true }).length === 0, 'Reduced motion disables CSS loops');
    duck.setPaused(true); assert(timers.size === 0 && pose() === 'idle', 'Pause cancels all timers and holds idle'); advance(100000);
    duck.setPaused(false); duck.setReducedMotion(false); duck.play('angry'); const completed = completions.length;
    duck.setVisible(false); assert(timers.size === 0, 'Hidden has no timers'); advance(10000); assert(completions.length === completed, 'Hidden reaction cannot complete');
    duck.setVisible(true); assert(timers.size === 2, 'Show restores only idle timers');
    duck.play('happy'); duck.play('idle'); advance(1000); assert(completions.length === completed, 'Replacement cancels completion');
    duck.play('alarm'); duck.setSleeping(true); advance(3000); assert(completions.length === completed, 'Sleep cancels obsolete reaction completion');
    duck.setSleeping(false); duck.play('idle');
    unsubscribe(); duck.dispose(); assert(timers.size === 0 && !el.children.length, 'Dispose cleans timers and DOM');
  } finally { duck.dispose(); el.remove(); Date.now = originalNow; window.setTimeout = originalTimeout; window.clearTimeout = originalClear; }
  return { assertions, poses: Object.keys(manifest).length, paths };
}

export function showGallery(): void {
  document.body.style.cssText = 'margin:0;background:#ece8df;display:grid;grid-template-columns:repeat(4,300px);font:14px system-ui';
  for (const activity of ['idle', 'focus', 'alarm', 'celebrate', 'gaming', 'coffee', 'strike', 'bread_snack', 'sunglasses', 'visitor', 'shrug', 'confused', 'walking', 'stretch', 'yawn', 'laughing']) {
    const panel = document.createElement('section'); const label = document.createElement('div'); label.textContent = activity; panel.append(label); document.body.append(panel);
    const el = host(); el.style.width = '300px'; panel.append(el); const duck = new FigmaDuck(el); duck.setReducedMotion(true); duck.play(activity);
  }
}

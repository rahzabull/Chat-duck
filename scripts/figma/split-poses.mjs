import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Deliberately a parser for this absolute-coordinate Figma export, not general SVG.
// Fail loudly on a new command/transform rather than silently misassigning artwork.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const source = resolve(root, 'assets/characters/figma-ref');
const target = resolve(root, 'assets/characters/ducky');
const spec = JSON.parse(readFileSync(resolve(source, 'poses.json'), 'utf8'));
const svg = readFileSync(resolve(source, 'all-ducky-exp.svg'), 'utf8');
const attrs = text => Object.fromEntries([...text.matchAll(/([\w:-]+)="([^"]*)"/g)].map(m => [m[1], m[2]]));
const round = n => Number(n.toFixed(3));

function bounds(d) {
  const tokens = d.match(/[a-zA-Z]|[-+]?(?:\d*\.\d+|\d+\.?\d*)(?:[eE][-+]?\d+)?/g) ?? [];
  const points = []; let i = 0, command = '', x = 0, y = 0, sx = 0, sy = 0;
  const point = (a, b) => { points.push([a, b]); x = a; y = b; };
  while (i < tokens.length) {
    if (/^[a-zA-Z]$/.test(tokens[i])) command = tokens[i++];
    if (command === 'Z' || command === 'z') { point(sx, sy); command = ''; continue; }
    if (!['M', 'L', 'H', 'V', 'C', 'Q'].includes(command)) throw new Error(`Unsupported path command: ${command}`);
    const number = () => { const n = Number(tokens[i++]); if (!Number.isFinite(n)) throw new Error('Invalid path'); return n; };
    if (command === 'M' || command === 'L') { point(number(), number()); if (command === 'M') { sx = x; sy = y; command = 'L'; } }
    else if (command === 'H') point(number(), y);
    else if (command === 'V') point(x, number());
    else {
      const start = [x, y], a = [number(), number()], b = [number(), number()];
      const end = command === 'C' ? [number(), number()] : b;
      // Numeric curve samples give a tight approximate bbox (including stroke below).
      for (let k = 1; k <= 32; k++) {
        const t = k / 32, u = 1 - t;
        point(...[0, 1].map(j => command === 'C'
          ? u ** 3 * start[j] + 3 * u ** 2 * t * a[j] + 3 * u * t ** 2 * b[j] + t ** 3 * end[j]
          : u ** 2 * start[j] + 2 * u * t * a[j] + t ** 2 * end[j]));
      }
    }
  }
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
  const x0 = Math.min(...xs), y0 = Math.min(...ys), x1 = Math.max(...xs), y1 = Math.max(...ys);
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
}

const poses = spec.poses.map(p => ({ ...p, rect: Object.fromEntries(['x', 'y', 'w', 'h'].map(k => [k, p[k] * spec.exportScale])), paths: [] }));
let dropped = 0;
for (const match of svg.matchAll(/<path\b[^>]*\/?\s*>/g)) {
  const a = attrs(match[0]);
  const b = bounds(a.d);
  // Spatial assignment drops label outlines; white toothpicks and blue sleep bubbles are art.
  const candidates = poses.filter(p => b.cx >= p.rect.x - 8 && b.cx <= p.rect.x + p.rect.w + 8 && b.cy >= p.rect.y - 8 && b.cy <= p.rect.y + p.rect.h + 8);
  if (candidates.length !== 1) { dropped++; continue; }
  if (a.transform) throw new Error('Unexpected path transform');
  candidates[0].paths.push({ a, b, part: 'extra' });
}

function classify(pose) {
  const paths = pose.paths;
  const yellow = paths.filter(p => p.a.fill === '#FFC954');
  const byArea = [...yellow].sort((a, b) => b.b.w * b.b.h - a.b.w * a.b.h);
  byArea[0].part = 'head'; byArea[1].part = 'body';
  const head = byArea[0], body = byArea[1];
  const orange = paths.filter(p => p.a.fill === '#F7673B');
  // The broad beak is the orange shape nearest the head centre, even in rotated fallen poses.
  const beak = [...orange].sort((a, b) => Math.hypot(a.b.cx - head.b.cx, a.b.cy - head.b.cy) - Math.hypot(b.b.cx - head.b.cx, b.b.cy - head.b.cy))[0];
  beak.part = 'beak';
  orange.filter(p => p !== beak).sort((a, b) => a.b.cx - b.b.cx).forEach((p, i) => { p.part = i === 0 ? 'foot-left' : 'foot-right'; });
  // Tail is the yellow layer before the feet/body. Tuft follows both wing pairs.
  const bodyIndex = paths.indexOf(body);
  for (const p of yellow) {
    if (p.part !== 'extra') continue;
    if (paths.indexOf(p) < bodyIndex) p.part = 'tail';
    // The long supporting contour in fallen art has no unambiguous idle counterpart.
    else if (pose.label.startsWith('fallen') && p.b.w > 80 && p.b.h < 20) p.part = 'extra';
    else if (pose.label.startsWith('fallen') ? p.b.w > 40 && p.b.h > 40 : p.b.cy < head.b.cy) p.part = 'tuft';
  }
  const wings = yellow.filter(p => p.part === 'extra' && !(pose.label.startsWith('fallen') && p.b.w > 80 && p.b.h < 20)).sort((a, b) => a.b.cx - b.b.cx);
  wings.forEach((p, i) => { p.part = i === 0 ? 'wing-left' : 'wing-right'; });
  // Figma emitted U-shaped wings as identical fill + open stroke paths. Keep the pair together.
  for (const p of paths.filter(p => !p.a.fill)) {
    const wing = wings.find(w => Math.abs(w.b.x - p.b.x) < .05 && Math.abs(w.b.y - p.b.y) < .05 && Math.abs(w.b.w - p.b.w) < .05 && Math.abs(w.b.h - p.b.h) < .05);
    if (wing) p.part = wing.part;
    else if (p.b.w < 7 && p.b.h < 7 && Math.hypot(p.b.cx - beak.b.cx, p.b.cy - beak.b.cy) < 45) p.part = 'nostril';
    else if (p.b.w > 15 && p.b.w < 45 && p.b.h < 10) p.part = ['bored', 'dragged_disgusted', 'interested', 'happy'].includes(pose.label) ? 'brow' : 'eye-arc';
    else if (p.b.w > 15 && p.b.w < 45 && p.b.h < 30) p.part = 'eye-arc';
    else if (pose.label.startsWith('fallen') && p.b.w < 10 && p.b.h > 10 && p.b.h < 40) p.part = 'eye-arc';
  }
  const eyes = paths.filter(p => p.a.fill === '#232323' && p.b.w > 16 && p.b.w < 25 && p.b.h > 16 && p.b.h < 25).sort((a, b) => a.b.cx - b.b.cx);
  eyes.forEach((p, i) => { p.part = (eyes.length === 1 ? p.b.cx < head.b.cx : i === 0) ? 'eye-left' : 'eye-right'; });
}

mkdirSync(resolve(target, 'poses'), { recursive: true });
mkdirSync(resolve(target, 'extra'), { recursive: true });
const manifest = {};
const hitParts = new Set(['body', 'head', 'wing-left', 'wing-right', 'foot-left', 'foot-right', 'tuft', 'beak']);
for (const pose of poses) {
  classify(pose);
  const paths = pose.paths;
  const pad = 6;
  const edge = p => Number(p.a['stroke-width'] ?? 0) / 2;
  const minX = Math.min(...paths.map(p => p.b.x - edge(p))), minY = Math.min(...paths.map(p => p.b.y - edge(p)));
  const maxX = Math.max(...paths.map(p => p.b.x + p.b.w + edge(p))), maxY = Math.max(...paths.map(p => p.b.y + p.b.h + edge(p)));
  const w = round(maxX - minX + pad * 2), h = round(maxY - minY + pad * 2);
  const counts = {};
  const layers = [];
  for (const p of paths) {
    counts[p.part] = (counts[p.part] ?? 0) + 1;
    const attributes = Object.entries(p.a).filter(([key]) => !['id', 'style'].includes(key)).map(([k, v]) => `${k}="${v}"`).join(' ');
    const path = `<path data-part="${p.part}"${hitParts.has(p.part) ? ' data-duck-hit=""' : ''} ${attributes}/>`;
    const previous = layers.at(-1);
    if (previous?.part === p.part) previous.paths.push(path);
    else layers.push({ part: p.part, paths: [path] });
  }
  const content = layers.map(l => `<g data-part="${l.part}"${l.part.startsWith('eye-') && l.part !== 'eye-arc' ? ' class="eye-track"' : ''}>${l.part.startsWith('eye-') && l.part !== 'eye-arc' ? '<g class="eye-blink">' : ''}${l.paths.join('')}${l.part.startsWith('eye-') && l.part !== 'eye-arc' ? '</g>' : ''}</g>`).join('\n');
  writeFileSync(resolve(target, `poses/${pose.label}.svg`), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" fill="none" data-pose="${pose.label}">\n<g transform="translate(${round(pad - minX)} ${round(pad - minY)})">\n${content}\n</g>\n</svg>\n`);
  manifest[pose.label] = { viewBox: [0, 0, w, h], parts: counts, pathCount: paths.length, blink: !!counts['eye-left'] && !!counts['eye-right'] };
}
writeFileSync(resolve(target, 'parts.json'), JSON.stringify(manifest, null, 2) + '\n');
const extra = readdirSync(resolve(target, 'extra')).filter(f => /^[a-z][a-z0-9_-]*\.svg$/.test(f)).sort();
const imports = [...poses.map(p => [`poses/${p.label}.svg`, p.label]), ...extra.map(f => [`extra/${f}`, `extra:${f.slice(0, -4)}`])];
writeFileSync(resolve(target, 'assets.generated.ts'), '// Generated by scripts/figma/split-poses.mjs. Trusted, local build-time artwork only.\n' + imports.map(([file], i) => `import asset${i} from './${file}?raw';`).join('\n') + '\nexport const poseAssets: Record<string, string> = {\n' + imports.map(([, name], i) => `  '${name}': asset${i},`).join('\n') + '\n};\n');
writeFileSync(resolve(target, 'preview.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><title>Rahul's Ducky — pose sheet</title><style>body{margin:24px;background:#ece8df;color:#232323;font:16px system-ui}main{display:grid;grid-template-columns:repeat(5,minmax(150px,1fr));gap:16px}figure{margin:0;padding:16px;background:#fffdf7;border-radius:12px;text-align:center}img{width:100%;height:240px;object-fit:contain}figcaption{margin-top:12px}</style><h1>Rahul's Ducky · 20 poses</h1><main>${poses.map(p => `<figure><img src="poses/${p.label}.svg" alt="${p.label}"><figcaption>${p.label}</figcaption></figure>`).join('')}</main></html>\n`);
console.log(`Wrote ${poses.length} poses (${poses.reduce((n, p) => n + p.paths.length, 0)} paths), ${extra.length} extra imports; dropped ${dropped} label/outside paths.`);
if (process.argv.includes('--inspect')) for (const p of poses) console.log(p.label, p.paths.map(x => `${x.part}:${x.a.fill ?? '-'}:${round(x.b.w)}x${round(x.b.h)}`).join(' '));

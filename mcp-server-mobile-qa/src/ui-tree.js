/**
 * UI Tree utilities (framework-agnostic, Flutter-aware) untuk page source UiAutomator2.
 * - parseNodes   : XML -> node datar dengan atribut + box
 * - effLabel     : label efektif (label sendiri atau label node anak; pola Flutter *_button + *_button_label)
 * - screenType   : login | tracking_consent | other
 * - interactive  : daftar elemen interaktif ter-dedupe (utamakan clickable=true untuk id+bounds sama)
 */
export function parseNodes(xml = '') {
  const nodes = [];
  const tagRe = /<([\w.$]+)((?:\s+[\w:-]+="[^"]*")*)\s*\/?>/g; let m;
  while ((m = tagRe.exec(xml))) {
    if (m[1] === 'hierarchy') continue;
    const a = { tag: m[1] }; const attrRe = /([\w:-]+)="([^"]*)"/g; let k;
    while ((k = attrRe.exec(m[2]))) a[k[1]] = k[2];
    const b = (a.bounds || '').match(/\[(-?\d+),(-?\d+)\]\[(-?\d+),(-?\d+)\]/);
    if (b) a.box = { x1: +b[1], y1: +b[2], x2: +b[3], y2: +b[4] };
    a.label = decode(a.text || a['content-desc'] || a.hint || '').replace(/\s+/g, ' ').trim();
    a.cls = (a.class || a.tag).split('.').pop();
    nodes.push(a);
  }
  return nodes;
}
export const TAB_RE = /\btab\s+\d+\s+(dari|of)\s+\d+\b/i;
const decode = s => s.replace(/&#10;/g, ' ').replace(/&#13;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&apos;/g, "'");
export const isEdit = n => /EditText/.test(n.class || n.tag);
export const isInteractive = n => n.clickable === 'true' || n['long-clickable'] === 'true' || n.checkable === 'true' || isEdit(n);
export const inside = (a, b) => a.box && b.box && a !== b && a.box.x1 >= b.box.x1 && a.box.y1 >= b.box.y1 && a.box.x2 <= b.box.x2 && a.box.y2 <= b.box.y2;
export const center = n => ({ x: Math.round((n.box.x1 + n.box.x2) / 2), y: Math.round((n.box.y1 + n.box.y2) / 2) });

export function effLabel(n, nodes) {
  // Flutter TabBar: content-desc "Tab x dari y" hanya semantik posisi; nama tab ada di node anak.
  if (n.label && TAB_RE.test(n.label)) { const k = nodes.find(c => c.label && !TAB_RE.test(c.label) && inside(c, n)); if (k) return { label: k.label, source: 'child' }; }
  if (n.label) return { label: n.label, source: 'self' };
  const kids = nodes.filter(c => c.label && inside(c, n));
  if (!kids.length) return { label: '', source: 'none' };
  // 1) anak ber-id turunan id induk (pola Flutter *_button -> *_button_label)
  const own = n['resource-id'] && kids.find(c => (c['resource-id'] || '').startsWith(n['resource-id']));
  if (own) return { label: own.label, source: 'child' };
  // 2) satu-satunya label anak
  const uniq = [...new Set(kids.map(k => k.label))];
  if (uniq.length === 1) return { label: uniq[0], source: 'child' };
  // 3) container berisi banyak item berlabel (sheet/menu/list): JANGAN adopsi label anak pertama -> gabungkan
  return { label: uniq.join(' '), source: 'children' };
}
export function screenType(nodes) {
  if (nodes.some(n => isEdit(n) && n.password === 'true')) return 'login';
  if (nodes.some(n => /_att_/.test(n['resource-id'] || ''))) return 'tracking_consent';
  return 'other';
}
export function screenSize(nodes) {
  const b = nodes.filter(n => n.box);
  return { W: Math.max(0, ...b.map(n => n.box.x2)), H: Math.max(0, ...b.map(n => n.box.y2)) };
}
export function screenTitle(nodes) {
  const { H } = screenSize(nodes);
  const t = nodes.filter(n => n.label && n.box && n.box.y2 < H * 0.13 && !TAB_RE.test(n.label) && !/^(kembali|back)$/i.test(n.label)).sort((a, b) => a.box.y1 - b.box.y1 || a.box.x1 - b.box.x1)[0];
  return t ? t.label : '';
}
/** Elemen interaktif ter-dedupe + label efektif + ref stabil (e1, e2, ...) untuk layar ini. */
export function interactiveElements(nodes) {
  const sorted = nodes.filter(isInteractive).sort((a, b) => (b.clickable === 'true') - (a.clickable === 'true'));
  const seen = new Set(); const out = [];
  for (const n of sorted) {
    const k = `${n['resource-id'] || ''}|${n.bounds}`; if (seen.has(k)) continue; seen.add(k);
    const e = effLabel(n, nodes);
    out.push({ node: n, label: e.label, labelSource: e.source, allLabels: [n.label, ...nodes.filter(c => c.label && inside(c, n)).map(c => c.label)].filter(Boolean) });
  }
  out.sort((a, b) => (a.node.box?.y1 ?? 0) - (b.node.box?.y1 ?? 0) || (a.node.box?.x1 ?? 0) - (b.node.box?.x1 ?? 0));
  const { W, H } = screenSize(nodes);
  for (const e of out) {
    const b = e.node.box; if (!b || !W) continue;
    // container layar penuh (label gabungan panjang) -> bukan target label/fuzzy
    e.container = (b.x2 - b.x1) * (b.y2 - b.y1) > W * H * 0.5;
    if (!e.label) e.position = `${b.y2 < H * 0.13 ? 'app-bar' : b.y1 > H * 0.85 ? 'bawah' : 'tengah'}-${(b.x1 + b.x2) / 2 < W / 3 ? 'kiri' : (b.x1 + b.x2) / 2 > (2 * W) / 3 ? 'kanan' : 'tengah'}`;
  }
  const kept = out.filter(e => !e.container || e.node['resource-id']);
  kept.forEach((e, i) => { e.ref = `e${i + 1}`; });
  return kept;
}
export function summarize(nodes, max = 60) {
  const els = interactiveElements(nodes);
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  return {
    screenType: screenType(nodes),
    title: screenTitle(nodes),
    interactive: els.length,
    resourceIdPct: pct(els.filter(e => e.node['resource-id']).length, els.length),
    labeledPct: pct(els.filter(e => e.label).length, els.length),
    webview: nodes.some(n => /WebView/.test(n.class || n.tag)),
    toasts: nodes.filter(n => /Toast/.test(n.class || n.tag)).map(n => n.label),
    elements: els.slice(0, max).map(e => ({
      ref: e.ref, id: e.node['resource-id'] || undefined, label: e.label || undefined, labelSource: e.labelSource === 'self' ? undefined : e.labelSource,
      type: isEdit(e.node) ? (e.node.password === 'true' ? 'password' : 'input') : e.node.checkable === 'true' ? `checkable(${e.node.checked})` : e.node.cls,
      position: e.position, enabled: e.node.enabled === 'false' ? false : undefined, bounds: e.node.bounds,
    })),
    texts: [...new Set(nodes.filter(n => n.label && !isInteractive(n)).map(n => n.label))].slice(0, 60),
  };
}

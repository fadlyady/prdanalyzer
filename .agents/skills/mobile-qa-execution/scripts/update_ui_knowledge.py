#!/usr/bin/env python3
"""
UI Knowledge Base per aplikasi (mobile-qa-execution).

Struktur (1 folder = 1 package, tidak pernah dicampur), di dalam profil aplikasi aktif (lokal, tidak di-commit):
  profiles/<QA_ACTIVE_PROFILE>/knowledge/mobile/<package>/ui-knowledge.json   <- SSOT mesin
  profiles/<QA_ACTIVE_PROFILE>/knowledge/mobile/<package>/ui-knowledge.md     <- tampilan manusia (di-generate)
  profiles/<QA_ACTIVE_PROFILE>/knowledge/mobile/_system/<package>/...          <- UI komponen OS (picker Files, kamera, dialog izin)
  Tanpa QA_ACTIVE_PROFILE -> lokasi lama doc-analyzer/strukturmenu/mobile-apps/knowledge/ (kompatibilitas).

Sumber:
  --run   <folder run_*>   : run_meta.json (package & build) + *_inspect.json
  --probe <folder probe_*> : probe_report.json (package & build) + locator_map.json
  --all                    : semua run & probe, urut waktu
  --seed  <file.json>      : knowledge kurasi manual (cara mencapai, jebakan, known issues)
  --render <package>       : generate ulang .md
  --rebuild                : bangun ulang dari semua seed.json + seluruh run/probe

Pengaman salah-app:
  - Package diambil dari metadata run/probe, BUKAN dari nama folder.
  - --package <pkg> -> sumber dengan package lain DITOLAK.
  - Elemen ber-resource-id package lain ("com.x:id/...") / foreground != app -> disimpan ke _system/<package-itu>.
  - Elemen tidak pernah dihapus; tidak terlihat 2x berturut-turut di layar yang sama -> status "stale".
"""
import argparse, json, os, re, glob
from datetime import datetime

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..'))
def _active_profile():
    alias = os.environ.get('QA_ACTIVE_PROFILE', '').strip()
    envf = os.path.join(ROOT, '.env')
    if not alias and os.path.exists(envf):
        for line in open(envf, encoding='utf-8'):
            if line.strip().startswith('QA_ACTIVE_PROFILE='):
                alias = line.split('=', 1)[1].strip().strip('"\'')
    return alias if re.match(r'^[A-Za-z0-9_-]+$', alias or '') else None

ALIAS = _active_profile()
KB = (os.path.join(ROOT, 'profiles', ALIAS, 'knowledge', 'mobile') if ALIAS
      else os.path.join(ROOT, 'doc-analyzer', 'strukturmenu', 'mobile-apps', 'knowledge'))
NOW = datetime.now().strftime('%Y-%m-%d %H:%M')
DYN_ID = re.compile(r'_(\d+)$')
TIME_LIKE = re.compile(r'^(\d{1,2}[.:]\d{2}|hari ini|kemarin|\d{1,2}/\d{1,2}/\d{4}.*)$', re.I)

def kb_dir(pkg, system=False):
    return os.path.join(KB, '_system', pkg) if system else os.path.join(KB, pkg)

def load(pkg, system=False):
    p = os.path.join(kb_dir(pkg, system), 'ui-knowledge.json')
    if os.path.exists(p):
        d = json.load(open(p, encoding='utf-8'))
        if d: return d
    return {'app': {'package': pkg, 'kind': 'system-component' if system else 'app'}, 'updatedAt': NOW,
            'sources': [], 'screens': {}, 'gotchas': [], 'knownIssues': []}

def save(kb, system=False):
    d = kb_dir(kb['app']['package'], system); os.makedirs(d, exist_ok=True)
    kb['updatedAt'] = NOW
    json.dump(kb, open(os.path.join(d, 'ui-knowledge.json'), 'w', encoding='utf-8'), indent=2, ensure_ascii=False)
    open(os.path.join(d, 'ui-knowledge.md'), 'w', encoding='utf-8').write(render_md(kb))

def element_key(e):
    """Kunci stabil elemen. None = elemen dinamis (isi data) yang tidak disimpan."""
    eid = e.get('id') or ''
    if eid:
        return 'id:' + DYN_ID.sub('_<n>', eid)
    lbl = (e.get('label') or '').strip()
    if lbl:
        if len(lbl) > 40 or TIME_LIKE.match(lbl) or lbl.isdigit():
            return None
        return 'label:' + lbl
    return ('pos:' + e['position']) if e.get('position') else None

def owner_of(e, app_pkg, fg):
    m = re.match(r'^([a-zA-Z0-9_.]+):id/', e.get('id') or '')
    return m.group(1) if m else (fg or app_pkg)

def screen_signature(els):
    return {k for k in (element_key(e) for e in els) if k and k.startswith('id:')}

def slug(t):
    return re.sub(r'[^a-z0-9]+', '_', (t or 'screen').lower()).strip('_')[:40] or 'screen'

def match_screen(kb, sig, title):
    best, score = None, 0.0
    for k, s in kb['screens'].items():
        anchors = set(s.get('anchors') or [])
        if anchors:
            hit = len(anchors & sig) / max(1, min(len(anchors), len(sig)))  # layar yang belum termuat penuh tetap dikenali
            if hit > score: best, score = k, hit
    if best and score >= 0.5:
        return best
    if title:
        for k, s in kb['screens'].items():
            if s.get('title') == title and not s.get('anchors'):
                return k
    return None

def merge_screen(kb, name_hint, summary, build, source):
    els = summary.get('elements') or []
    sig = screen_signature(els)
    key = match_screen(kb, sig, summary.get('title'))
    if not key:
        key = base = slug(summary.get('title') or name_hint); i = 2
        while key in kb['screens']:
            key = f'{base}_{i}'; i += 1
        kb['screens'][key] = {'title': summary.get('title') or '', 'screenType': summary.get('screenType'), 'curated': False,
                              'howToReach': [], 'notes': ['Layar baru dari ingest otomatis — perlu kurasi (judul, cara mencapai).'],
                              'anchors': sorted(sig)[:8], 'elements': {}}
    s = kb['screens'][key]
    if not s.get('anchors') and sig:
        s['anchors'] = sorted(sig)[:8]
    seen = set()
    for e in els:
        k = element_key(e)
        if not k: continue
        seen.add(k)
        cur = s['elements'].get(k, {'firstSeen': NOW, 'seenCount': 0})
        curated = cur.get('status') == 'curated'
        cur.update({'id': DYN_ID.sub('_<n>', e.get('id') or '') or None,
                    'label': cur.get('label') if curated and cur.get('label') else (e.get('label') if len(e.get('label') or '') <= 60 else None),
                    'type': e.get('type'), 'position': e.get('position'), 'bounds': e.get('bounds'),
                    'lastSeen': NOW, 'lastBuild': build, 'missCount': 0, 'source': source})
        if not curated: cur['status'] = 'active'
        cur['seenCount'] = cur.get('seenCount', 0) + 1
        cur['confidence'] = 'HIGH' if cur['id'] else ('MEDIUM' if cur.get('label') else 'LOW (tanpa label/ID — tap via posisi)')
        s['elements'][k] = cur
    if els:
        for k, cur in s['elements'].items():
            if k not in seen and cur.get('status') != 'curated':
                cur['missCount'] = cur.get('missCount', 0) + 1
                if cur['missCount'] >= 2: cur['status'] = 'stale (tidak terlihat 2x, perlu dicek)'
    s['lastVerified'] = {'at': NOW, 'build': build, 'source': source}
    return key

def ingest_run(run_dir, only_pkg=None):
    mp = os.path.join(run_dir, 'run_meta.json')
    if not os.path.exists(mp):
        print(f'[SKIP] {os.path.basename(run_dir)}: run_meta.json tidak ada'); return
    meta = json.load(open(mp)); app = meta.get('app') or {}; pkg = app.get('package')
    if not pkg: print(f'[SKIP] {run_dir}: package tidak diketahui'); return
    if only_pkg and pkg != only_pkg: print(f'[TOLAK] {os.path.basename(run_dir)}: package {pkg} != {only_pkg}'); return
    build = f"{app.get('versionName')} ({app.get('versionCode')})"
    dev = meta.get('device') or {}; os_build = f"{dev.get('brand')} {dev.get('model')} Android {dev.get('release')}"
    files = sorted(glob.glob(os.path.join(run_dir, '*_inspect.json')))
    if not files: print(f'[INFO] {os.path.basename(run_dir)}: tidak ada inspect'); return
    kbs = {}
    for f in files:
        summ = json.load(open(f, encoding='utf-8')); fg = summ.get('foreground')
        owners = {owner_of(e, pkg, fg) for e in summ.get('elements', []) if ':id/' in (e.get('id') or '')}
        owner = fg or (next(iter(owners)) if len(owners) == 1 else pkg)
        system = owner != pkg
        kb = kbs.setdefault(owner, load(owner, system))
        if not system: kb['app'].update({'framework': app.get('framework') or kb['app'].get('framework'), 'platform': 'android'})
        else: summ = {**summ, 'elements': [e for e in summ.get('elements', []) if owner_of(e, pkg, fg) == owner]}
        name = os.path.basename(f).replace('_inspect.json', '')
        key = merge_screen(kb, name.split('_', 4)[-1], summ, os_build if system else build, os.path.relpath(f, ROOT))
        print(f'  {os.path.basename(f)} -> {"_system/" if system else ""}{owner} :: {key}')
    for owner, kb in kbs.items():
        src = {'type': 'run', 'path': os.path.relpath(run_dir, ROOT), 'build': build, 'at': NOW}
        if src['path'] not in [x['path'] for x in kb['sources']]: kb['sources'].append(src)
        save(kb, owner != pkg)

def ingest_probe(probe_dir, only_pkg=None):
    rp = os.path.join(probe_dir, 'probe_report.json'); lm = os.path.join(probe_dir, 'locator_map.json')
    if not (os.path.exists(rp) and os.path.exists(lm)): print(f'[SKIP] {os.path.basename(probe_dir)}: tanpa locator_map'); return
    rep = json.load(open(rp)); g = rep.get('gates') or {}
    pkg = (rep.get('config') or {}).get('pkg') or (g.get('apk') or {}).get('package')
    if not pkg or (only_pkg and pkg != only_pkg): print(f'[TOLAK/SKIP] {os.path.basename(probe_dir)}: package {pkg}'); return
    inst = g.get('installed') or {}; build = f"{inst.get('versionName')} ({inst.get('versionCode')})"
    kb = load(pkg)
    for name, scr in json.load(open(lm)).items():
        els = [{'id': l.get('id'), 'label': l.get('label'), 'type': l.get('class'), 'bounds': l.get('bounds')} for l in scr.get('locators', [])]
        if any(':id/' in (e['id'] or '') for e in els): continue
        merge_screen(kb, name, {'title': '', 'screenType': scr.get('screenType'), 'elements': els}, build, os.path.relpath(probe_dir, ROOT) + '#' + name)
    src = {'type': 'probe', 'path': os.path.relpath(probe_dir, ROOT), 'build': build, 'at': NOW}
    if src['path'] not in [x['path'] for x in kb['sources']]: kb['sources'].append(src)
    save(kb); print(f'[OK] probe {os.path.basename(probe_dir)} -> {pkg}')

def apply_seed(seed_path, only_pkg=None):
    seed = json.load(open(seed_path, encoding='utf-8'))
    pkg = seed['app']['package']; system = seed['app'].get('kind') == 'system-component'
    if only_pkg and pkg != only_pkg: print(f'[TOLAK] seed {pkg} != {only_pkg}'); return
    kb = load(pkg, system); kb['app'].update(seed['app'])
    for k, s in seed.get('screens', {}).items():
        cur = kb['screens'].setdefault(k, {'elements': {}})
        for f in ('title', 'screenType', 'howToReach', 'notes', 'anchors'):
            if f in s: cur[f] = s[f]
        cur['curated'] = True
        for alias in s.get('absorb') or []:  # gabungkan layar auto (hasil ingest) ke layar kurasi
            src = kb['screens'].pop(alias, None)
            if src:
                for ek, ev in src.get('elements', {}).items(): cur['elements'].setdefault(ek, ev)
                cur['absorbed'] = sorted(set((cur.get('absorbed') or []) + [alias]))
                if src.get('lastVerified'): cur['lastVerified'] = src['lastVerified']
        for ek, ev in (s.get('elements') or {}).items():
            e = cur['elements'].setdefault(ek, {})
            e.update({**ev, 'status': 'curated', 'curatedAt': NOW})
            e.setdefault('confidence', 'HIGH' if e.get('id') else ('MEDIUM' if e.get('label') else 'LOW (tanpa label/ID — tap via posisi)'))
    for f in ('gotchas', 'knownIssues'):
        have = {g['text'] for g in kb.get(f, [])}
        kb[f] = kb.get(f, []) + [g for g in seed.get(f, []) if g['text'] not in have]
    save(kb, system); print(f'[OK] seed -> {"_system/" if system else ""}{pkg}')

def render_md(kb):
    a = kb['app']; L = [f"# UI Knowledge — `{a['package']}`", '']
    L += [f"> Jenis: {a.get('kind', 'app')} • Nama: {a.get('name', '-')} • Framework: {a.get('framework', '-')} • Diperbarui: {kb['updatedAt']}",
          '> Di-generate dari `ui-knowledge.json` oleh `update_ui_knowledge.py`. Kurasi lewat file seed, bukan file ini.', '']
    if a.get('variants'):
        L += ['**Varian lain yang BUKAN knowledge ini:** ' + ', '.join(f'{k} = `{v}`' for k, v in a['variants'].items()), '']
    if kb.get('gotchas'):
        L += ['## Jebakan yang Diketahui (baca sebelum menyusun plan)', '']
        L += [f"- **[{g.get('screen', 'umum')}]** {g['text']}" for g in kb['gotchas']] + ['']
    if kb.get('knownIssues'):
        L += ['## Known Issues', '', '| Temuan | Severity | Sejak | Status |', '|---|---|---|---|']
        L += [f"| {i['text']} | {i.get('severity', '-')} | {i.get('since', '-')} | {i.get('status', 'open')} |" for i in kb['knownIssues']] + ['']
    L += ['## Layar', '']
    for k, s in kb['screens'].items():
        L += [f"### `{k}` — {s.get('title') or '(tanpa judul)'}{'' if s.get('curated') else '  _(auto, perlu kurasi)_'}", '']
        if s.get('howToReach'): L += ['**Cara mencapai:** ' + ' → '.join(s['howToReach']), '']
        if s.get('lastVerified'): L += [f"Terakhir terverifikasi: {s['lastVerified']['at']} • {s['lastVerified']['build']}", '']
        L += [f'- {n}' for n in s.get('notes') or []] + ([''] if s.get('notes') else [])
        allrows = s.get('elements', {}).items()
        rows = sorted([(k, e) for k, e in allrows if e.get('id') or e.get('status') == 'curated' or k.startswith('pos:') or (e.get('type') or 'View') != 'View'],
                      key=lambda kv: (kv[1].get('status') != 'curated', not kv[1].get('id'), kv[0]))
        hidden = len(allrows) - len(rows)
        if rows:
            L += ['| Kunci | resource-id | Label | Tipe / posisi | Confidence | Status |', '|---|---|---|---|---|---|']
            L += [f"| `{ek}` | {('`' + e['id'] + '`') if e.get('id') else '-'} | {e.get('label') or '-'} | {e.get('type') or '-'}{(' / ' + e['position']) if e.get('position') else ''} | {e.get('confidence', '-')} | {e.get('status', '-')} |" for ek, e in rows]
            L.append('')
        if hidden: L += [f'_{hidden} teks konten tanpa ID (isi pesan/data, label statis) disembunyikan — lihat `ui-knowledge.json`._', '']
    L += ['## Sumber (15 terakhir)', ''] + [f"- {x['type']}: `{x['path']}` ({x.get('build', '-')}, {x['at']})" for x in kb['sources'][-15:]]
    return '\n'.join(L) + '\n'

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    for o in ('--run', '--probe', '--seed', '--render', '--package'): ap.add_argument(o)
    ap.add_argument('--all', action='store_true')
    ap.add_argument('--rebuild', action='store_true', help='Bangun ulang semua knowledge dari seed.json + seluruh run/probe')
    a = ap.parse_args()
    if a.rebuild:
        seeds = sorted(glob.glob(os.path.join(KB, '*', 'seed.json')) + glob.glob(os.path.join(KB, '_system', '*', 'seed.json')))
        for js in glob.glob(os.path.join(KB, '*', 'ui-knowledge.json')) + glob.glob(os.path.join(KB, '_system', '*', 'ui-knowledge.json')):
            json.dump({}, open(js, 'w'))
        for sd in seeds: apply_seed(sd, a.package)
        a.all = True
    if a.seed: apply_seed(a.seed, a.package)
    if a.all:
        base = os.path.join(ROOT, 'mobile-execution')
        items = [(os.path.getmtime(p), 'probe', p) for p in glob.glob(os.path.join(base, 'probe-result', 'probe_*'))]
        items += [(os.path.getmtime(p), 'run', p) for p in glob.glob(os.path.join(base, 'automate-result', 'run_*')) if os.path.isdir(p)]
        for _, t, p in sorted(items): (ingest_probe if t == 'probe' else ingest_run)(p, a.package)
    if a.rebuild:
        for sd in sorted(glob.glob(os.path.join(KB, '*', 'seed.json')) + glob.glob(os.path.join(KB, '_system', '*', 'seed.json'))): apply_seed(sd, a.package)
    if a.run: ingest_run(os.path.abspath(a.run), a.package)
    if a.probe: ingest_probe(os.path.abspath(a.probe), a.package)
    if a.render:
        system = os.path.exists(os.path.join(kb_dir(a.render, True), 'ui-knowledge.json'))
        kb = load(a.render, system); save(kb, system)
    if not any([a.seed, a.all, a.run, a.probe, a.render]): ap.print_help()

if __name__ == '__main__':
    main()

"""Kalkulator Test Design Readiness (M1/M2) + verdict eksekusi opsional (M6).

Prinsip (standar analysis.md §4, status-verdict-evidence.md §3):
- Tidak ada angka default: risiko, AC, dan cakupan hanya dihitung dari data yang benar-benar ada. Data kurang ->
  INSUFFICIENT DATA, bukan 100%.
- Tabel risk register dibaca lewat HEADER (Risk ID, Impact, Likelihood, Risk Level, Weight, Pillar, Covered by (AC)),
  bukan tebakan substring. Level dihitung ulang dengan matriks D5 dan ketidaksesuaian dilaporkan.
- Cakupan = risiko/AC yang dirujuk test case (02-testcases.md: field Covers atau ID di blok TC, atau lewat AC yang
  memitigasi risiko). Tanpa file test case, cakupan = N/A dan yang dinilai hanya gate analisa.
- Verdict eksekusi (GO/CONDITIONAL GO/NO-GO) hanya bila hasil run diberikan, dihitung modul tunggal scripts/lib/verdict.py.

CLI: python3 calc_engine.py <01-analysis.md> [--tc <02-testcases.md>] [--results <report_data.json|run_results.json>]
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..', '..', 'scripts', 'lib')))
try:
    from verdict import compute_verdict, verdict_summary
except Exception:  # noqa: BLE001
    compute_verdict = None

WEIGHTS = {'critical': 4, 'high': 3, 'medium': 2, 'low': 1}
LEVELS = ['low', 'medium', 'high', 'critical']
MATRIX = {  # Impact x Likelihood -> level (D5)
    ('high', 'low'): 'medium', ('high', 'medium'): 'high', ('high', 'high'): 'critical',
    ('medium', 'low'): 'low', ('medium', 'medium'): 'medium', ('medium', 'high'): 'high',
    ('low', 'low'): 'low', ('low', 'medium'): 'low', ('low', 'high'): 'medium',
}
STRICT_PILLARS = ('financial', 'finansial', 'compliance', 'kepatuhan', 'security', 'keamanan', 'otorisasi', 'authorization')
COLORS = {'READY': '#28A745', 'READY WITH GAPS': '#FFC107', 'NOT READY': '#DC3545', 'INSUFFICIENT DATA': '#6C757D',
          'GO': '#28A745', 'CONDITIONAL GO': '#FFC107', 'NO-GO': '#DC3545'}
ID_TOKEN = r'[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*'


def _clean(c):
    c = re.sub(r'[*_`]', '', c or '')
    c = re.sub(r'[\U0001F300-\U0001FAFF☀-➿]', '', c)
    return c.strip()


def _level(v):
    v = _clean(v).lower()
    for lv in ('critical', 'high', 'medium', 'low'):
        if v == lv or v.startswith(lv + ' ') or v.startswith(lv + '('):
            return lv
    return {'kritis': 'critical', 'tinggi': 'high', 'sedang': 'medium', 'rendah': 'low'}.get(v)


def _tables(md):
    """Kembalikan list (heading_terakhir, header_cells, rows) untuk setiap tabel markdown."""
    out, heading, cur = [], '', None
    for line in md.splitlines():
        s = line.strip()
        if s.startswith('#'):
            heading = s
        if s.startswith('|') and s.endswith('|') and len(s) > 1:
            cells = [c.strip() for c in s[1:-1].split('|')]
            if cur is None:
                cur = (heading, cells, [])
            elif all(re.fullmatch(r':?-{2,}:?', c) for c in cells if c):
                continue
            else:
                cur[2].append(cells)
        else:
            if cur is not None:
                out.append(cur)
            cur = None
    if cur is not None:
        out.append(cur)
    return out


def _col(header, *names):
    h = [_clean(x).lower() for x in header]
    for n in names:
        for i, x in enumerate(h):
            if x == n or x.startswith(n):
                return i
    return None


def parse_risks(md):
    risks, warnings = [], []
    for _heading, header, rows in _tables(md):
        i_id = _col(header, 'risk id', 'id risiko', 'risiko id')
        if i_id is None:
            continue
        i_imp, i_lik = _col(header, 'impact', 'dampak'), _col(header, 'likelihood', 'kemungkinan')
        i_lvl, i_w = _col(header, 'risk level', 'level risiko', 'level'), _col(header, 'weight', 'bobot')
        i_pil = _col(header, 'pillar', 'pilar')
        i_cov = _col(header, 'covered by', 'dicakup', 'ac terkait')
        i_mit = _col(header, 'mitigation', 'mitigasi')
        for r in rows:
            def g(i):
                return r[i] if i is not None and i < len(r) else ''
            rid = _clean(g(i_id))
            if not rid or not re.search(r'\d', rid):
                continue
            imp, lik, stated = _level(g(i_imp)), _level(g(i_lik)), _level(g(i_lvl))
            pillar = _clean(g(i_pil)).lower()
            strict = any(p in pillar for p in STRICT_PILLARS)
            calc = MATRIX.get((imp, lik))
            if calc and imp == 'high' and strict and LEVELS.index(calc) < LEVELS.index('high'):
                calc = 'high'
            level = stated or calc
            if not level:
                warnings.append(f'{rid}: level risiko tidak terbaca (Risk Level / Impact×Likelihood kosong) — tidak dihitung.')
                continue
            if stated and calc and stated != calc:
                warnings.append(f'{rid}: Risk Level tertulis {stated.title()} tetapi matriks D5 ({imp.title()}×{lik.title()}'
                                f'{", pilar ketat" if strict else ""}) = {calc.title()}. Dipakai: {stated.title()} — mohon diselaraskan.')
            w_stated = re.search(r'\d+', _clean(g(i_w)) or '')
            if w_stated and int(w_stated.group()) != WEIGHTS[level]:
                warnings.append(f'{rid}: Weight tertulis {w_stated.group()} ≠ bobot standar {WEIGHTS[level]} untuk {level.title()}.')
            acs = sorted(set(re.findall(r'\bAC-\d+[A-Za-z]?\b', g(i_cov))))
            risks.append({'id': rid, 'level': level, 'weight': WEIGHTS[level], 'impact': imp, 'likelihood': lik,
                          'pillar': pillar, 'acs': acs, 'mitigation': _clean(g(i_mit))[:200]})
    seen, uniq = set(), []
    for k in risks:
        if k['id'] not in seen:
            seen.add(k['id'])
            uniq.append(k)
    return uniq, warnings


def parse_acs(md):
    """AC dari tabel ber-header AC-ID (+ kolom Risiko untuk relasi AC->risiko). Fallback: ID AC-xx unik di dokumen."""
    acs, ac_risk = [], {}
    for _heading, header, rows in _tables(md):
        i_ac = _col(header, 'ac-id', 'ac id', 'id ac', 'ac')
        if i_ac is None or not re.match(r'ac', _clean(header[i_ac]).lower()):
            continue
        i_rk = _col(header, 'risiko', 'risk')
        i_pr = _col(header, 'prioritas', 'priority')
        for r in rows:
            m = re.search(r'\bAC-\d+[A-Za-z]?\b', r[i_ac] if i_ac < len(r) else '')
            if not m:
                continue
            ac = m.group()
            if ac not in [a['id'] for a in acs]:
                acs.append({'id': ac, 'priority': _clean(r[i_pr]) if i_pr is not None and i_pr < len(r) else ''})
            if i_rk is not None and i_rk < len(r):
                for rk in re.findall(ID_TOKEN, r[i_rk]):
                    if re.search(r'RSK|RISK', rk):
                        ac_risk.setdefault(ac, set()).add(rk)
    source = 'tabel AC'
    if not acs:
        found = sorted(set(re.findall(r'\bAC-\d+[A-Za-z]?\b', md)), key=lambda x: int(re.search(r'\d+', x).group()))
        acs = [{'id': a, 'priority': ''} for a in found]
        source = 'ID AC di dokumen' if acs else 'tidak ada'
    return acs, ac_risk, source


def parse_tc_refs(tc_md):
    """Blok TC (heading ### <ID>: judul) -> set ID yang dirujuk (Covers + seluruh isi blok)."""
    tcs, state = {}, {'id': None, 'buf': []}
    id_re = re.compile(r'^#{2,4}\s*([A-Za-z][A-Za-z0-9]*(?:[-_][A-Za-z0-9]+)*[-_]\d+[A-Za-z0-9_-]*)\s*[:\-–]\s*(.+?)\s*$')

    def close():
        if state['id']:
            tcs[state['id']] = set(re.findall(r'\b' + ID_TOKEN + r'\b', '\n'.join(state['buf'])))
    for line in tc_md.splitlines():
        m = id_re.match(line.strip())
        if m:
            close()
            state['id'], state['buf'] = m.group(1), [line]
        elif state['id'] is not None:
            if re.match(r'^#{1,3}\s', line):
                close()
                state['id'], state['buf'] = None, []
            else:
                state['buf'].append(line)
    close()
    return tcs


def _results_items(path):
    with open(path, encoding='utf-8') as f:
        d = json.load(f)
    if isinstance(d, dict) and d.get('roles'):
        return [sc for scs in d['roles'].values() for sc in scs]
    if isinstance(d, dict) and d.get('testcases'):
        return d['testcases']
    return d if isinstance(d, list) else []


def _mitigation_tc_tokens(text):
    """ID TC yang disebut di kolom Mitigation, termasuk bentuk pendek "POS-003" dan "CON-001/002"."""
    toks = set()
    for m in re.finditer(r'\b([A-Z][A-Z0-9]*(?:-[A-Z][A-Z0-9]*)*)-(\d{2,4})((?:\s*/\s*\d{2,4})*)', text or ''):
        pre, first, rest = m.group(1), m.group(2), m.group(3)
        if re.fullmatch(r'(AC|US|Q|RSK|D|P)', pre) or pre.endswith('RSK'):
            continue
        toks.add(f'{pre}-{first}')
        for n in re.findall(r'\d{2,4}', rest or ''):
            toks.add(f'{pre}-{n.zfill(len(first))}')
    return toks


def compute_metrics(md, md_path=None, tc_path=None, results_path=None):
    warnings = []
    risks, w = parse_risks(md)
    warnings += w
    acs, ac_risk, ac_source = parse_acs(md)
    for k in risks:  # relasi AC->risiko dari tabel AC melengkapi kolom Covered by
        k['acs'] = sorted(set(k['acs']) | {a for a, rs in ac_risk.items() if k['id'] in rs})

    if not tc_path and md_path:
        cand = os.path.join(os.path.dirname(os.path.abspath(md_path)), '02-testcases.md')
        tc_path = cand if os.path.isfile(cand) and os.path.abspath(cand) != os.path.abspath(md_path) else None
    tcs = None
    if tc_path and os.path.isfile(tc_path):
        with open(tc_path, encoding='utf-8') as f:
            tcs = parse_tc_refs(f.read())

    gate = {'critical_high_without_ac': [k['id'] for k in risks if k['level'] in ('critical', 'high') and not k['acs']]}
    m = {'total_risks': len(risks), 'risks': risks, 'total_acs': len(acs), 'ac_source': ac_source,
         'tc_file': os.path.relpath(tc_path) if tcs is not None else None, 'total_tcs': len(tcs) if tcs is not None else 0,
         'analysis_gate': gate, 'warnings': warnings}
    m['risks_breakdown'] = {lv: {'total': sum(1 for k in risks if k['level'] == lv), 'covered': None}
                            for lv in ('critical', 'high', 'medium', 'low')}

    # --- cakupan (hanya bila ada test case) ---
    if tcs is not None and risks:
        for k in risks:
            direct = {t for t, refs in tcs.items() if k['id'] in refs or any(a in refs for a in k['acs'])}
            via_mit = {t for t in tcs if any(t.upper().endswith('-' + tok) or t.upper() == tok for tok in _mitigation_tc_tokens(k['mitigation']))}
            k['tc_ids'] = sorted(direct | via_mit)
            k['link'] = 'TC/AC' if direct else ('mitigasi' if via_mit else None)
            k['covered'] = bool(k['tc_ids'])
        cov = [k for k in risks if k['covered']]
        ch = [k for k in risks if k['level'] in ('critical', 'high')]
        m.update(covered_risks=len(cov), basic_risk_coverage=round(len(cov) / len(risks) * 100, 1),
                 total_weight=sum(k['weight'] for k in risks), covered_weight=sum(k['weight'] for k in cov))
        m['weighted_risk_coverage'] = round(m['covered_weight'] / m['total_weight'] * 100, 1)
        m['crit_high_coverage'] = round(sum(1 for k in ch if k['covered']) / len(ch) * 100, 1) if ch else None
        m['uncovered_risks'] = [f"{k['id']} ({k['level'].title()})" for k in risks if not k['covered']]
        for lv in m['risks_breakdown']:
            m['risks_breakdown'][lv]['covered'] = sum(1 for k in risks if k['level'] == lv and k['covered'])
    else:
        m.update(covered_risks=None, basic_risk_coverage=None, total_weight=sum(k['weight'] for k in risks),
                 covered_weight=None, weighted_risk_coverage=None, crit_high_coverage=None, uncovered_risks=[])
    if tcs is not None and acs:
        covered_acs = [a['id'] for a in acs if any(a['id'] in refs for refs in tcs.values())]
        m['req_coverage'] = round(len(covered_acs) / len(acs) * 100, 1)
        m['uncovered_acs'] = [a['id'] for a in acs if a['id'] not in covered_acs]
    else:
        m['req_coverage'], m['uncovered_acs'] = None, []

    # --- readiness test design ---
    reasons = []
    if not risks:
        reasons.append('Risk register tidak ditemukan / tidak terbaca (butuh tabel ber-header "Risk ID").')
    if gate['critical_high_without_ac']:
        reasons.append(f"Gate analisa: risiko Critical/High tanpa AC: {', '.join(gate['critical_high_without_ac'])}.")
    if tcs is None:
        readiness = 'INSUFFICIENT DATA'
        desc = 'Belum ada test case (02-testcases.md) — cakupan risiko & requirement belum bisa dihitung. ' + ' '.join(reasons)
    elif not risks:
        readiness, desc = 'INSUFFICIENT DATA', ' '.join(reasons)
    else:
        ch_ok = m['crit_high_coverage'] in (None, 100.0)
        req = m['req_coverage']
        wrc = m['weighted_risk_coverage']
        if not ch_ok or (req is not None and req < 80) or wrc < 85:
            readiness = 'NOT READY'
            bits = []
            if not ch_ok:
                bits.append(f"risiko Critical/High belum tercakup TC ({m['crit_high_coverage']}%: "
                            + ', '.join(k['id'] for k in risks if k['level'] in ('critical', 'high') and not k['covered']) + ')')
            if req is not None and req < 80:
                bits.append(f'requirement coverage {req}% < 80%')
            if wrc < 85:
                bits.append(f'weighted risk coverage {wrc}% < 85%')
            desc = 'Belum siap dieksekusi: ' + '; '.join(bits) + '.'
        else:
            gaps = []
            if req is None:
                gaps.append('AC tidak terbaca (requirement coverage N/A)')
            elif req < 100:
                gaps.append(f"requirement {req}% (belum dirujuk TC: {', '.join(m['uncovered_acs'][:10])})")
            if wrc < 90:
                gaps.append(f'weighted risk coverage {wrc}%')
            if gate['critical_high_without_ac']:
                gaps.append('gate analisa belum lengkap')
            if gaps:
                readiness, desc = 'READY WITH GAPS', 'Critical/High tercakup; masih ada celah: ' + '; '.join(gaps) + '.'
            else:
                readiness, desc = 'READY', 'Semua risiko Critical/High dan requirement tercakup test case; weighted risk coverage ≥ 90%.'
    if reasons and tcs is not None and risks:
        desc += ' ' + ' '.join(reasons)
    m['readiness'], m['readiness_desc'] = readiness, desc.strip()

    # --- verdict eksekusi (opsional) ---
    m['execution'] = None
    if results_path and compute_verdict:
        items = _results_items(results_path)
        rk = [{'id': k['id'], 'level': k['level'].title(), 'tc_ids': k.get('tc_ids', [])} for k in risks]
        v = compute_verdict(items, rk if tcs is not None else None)
        m['execution'] = {'verdict': v['verdict'], 'summary': verdict_summary(v), 'source': os.path.relpath(results_path)}

    # kompatibilitas pemanggil lama (md_to_docx/md_to_pdf)
    shown = m['execution']['verdict'] if m['execution'] else readiness
    m['verdict'] = shown
    m['verdict_desc'] = m['execution']['summary'] if m['execution'] else m['readiness_desc']
    m['verdict_color'] = COLORS.get(shown, '#6C757D')
    m['scorecard_rows'] = scorecard_rows(m)
    return m


def _pct(v, extra=''):
    return 'N/A' if v is None else f'{v}%{extra}'


def scorecard_rows(m):
    na = 'N/A — belum ada TC' if m['tc_file'] is None else 'N/A'

    def st(v, t):
        return na if v is None else ('Met' if v >= t else 'Not Met')
    b = m['risks_breakdown']
    no_ac = m['analysis_gate']['critical_high_without_ac']
    rows = [
        ['Risk register terbaca',
         f"{m['total_risks']} risiko (C{b['critical']['total']}/H{b['high']['total']}/M{b['medium']['total']}/L{b['low']['total']})",
         '≥ 1 risiko', 'Met' if m['total_risks'] else 'Not Met'],
        ['Gate analisa: Critical/High punya AC', 'semua' if not no_ac else ', '.join(no_ac), '100%',
         'Met' if not no_ac and m['total_risks'] else 'Not Met'],
        ['Requirements Coverage (AC dirujuk TC)', _pct(m['req_coverage'], f" ({m['total_acs']} AC, sumber: {m['ac_source']})"),
         '100% (min 80%)', st(m['req_coverage'], 100)],
        ['Critical & High Risk Coverage', _pct(m['crit_high_coverage']), '100%', st(m['crit_high_coverage'], 100)],
        ['Basic Risk Coverage',
         _pct(m['basic_risk_coverage'], f" ({m['covered_risks']}/{m['total_risks']})" if m['covered_risks'] is not None else ''),
         '≥ 80%', st(m['basic_risk_coverage'], 80)],
        ['Weighted Risk Coverage (bobot 4/3/2/1)',
         _pct(m['weighted_risk_coverage'], f" ({m['covered_weight']}/{m['total_weight']} poin)" if m['covered_weight'] is not None else ''),
         '≥ 90% (min 85%)', st(m['weighted_risk_coverage'], 85)],
        ['Test Design Readiness', f"[{m['readiness']}]", 'READY', m['readiness']],
    ]
    if m.get('execution'):
        rows.append(['Verdict Eksekusi (dari hasil run)', f"[{m['execution']['verdict']}]", 'GO', m['execution']['verdict']])
    return rows


def parse_markdown_metrics(md_content, md_path=None, tc_path=None, results_path=None):
    """Nama lama dipertahankan untuk pemanggil yang ada."""
    return compute_metrics(md_content, md_path, tc_path, results_path)


if __name__ == '__main__':
    args = sys.argv[1:]
    if not args or args[0] in ('-h', '--help'):
        print(__doc__)
        sys.exit(0)

    def opt(k):
        return args[args.index(k) + 1] if k in args and args.index(k) + 1 < len(args) else None
    path = args[0]
    with open(path, encoding='utf-8') as f:
        out = compute_metrics(f.read(), path, opt('--tc'), opt('--results'))
    print(json.dumps(out, indent=2, ensure_ascii=False))

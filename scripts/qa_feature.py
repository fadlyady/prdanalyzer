#!/usr/bin/env python3
"""
qa_feature — titik masuk M0 Intake: tahu profil aktif & folder kerja fitur (Pondasi D4).

  python3 scripts/qa_feature.py where                 # profil aktif, lokasi profil, rahasia, work
  python3 scripts/qa_feature.py list                  # fitur yang terdaftar di profil aktif
  python3 scripts/qa_feature.py init <nama-fitur>     # buat work/<ALIAS>/<fitur>/ + 00-scope.md + runs/index.json
Opsi: --alias <ALIAS> untuk profil selain QA_ACTIVE_PROFILE.
Nama fitur dinormalisasi menjadi slug (huruf kecil, tanda hubung) dan tidak boleh memuat nama aplikasi.
"""
import json, os, re, subprocess, sys
from datetime import date

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))

def active_alias(argv):
    if '--alias' in argv:
        return argv[argv.index('--alias') + 1]
    alias = os.environ.get('QA_ACTIVE_PROFILE', '')
    envf = os.path.join(ROOT, '.env')
    if not alias and os.path.exists(envf):
        for line in open(envf, encoding='utf-8'):
            if line.strip().startswith('QA_ACTIVE_PROFILE='):
                alias = line.split('=', 1)[1].strip().strip('"\'')
    return alias or None

def slug(name):
    return re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')

def runner_name():
    try:
        return subprocess.run(['git', 'config', 'user.name'], capture_output=True, text=True, cwd=ROOT).stdout.strip() or 'QA'
    except Exception:
        return 'QA'

def main(argv):
    cmd = argv[0] if argv else 'where'
    alias = active_alias(argv)
    if not alias:
        print('Profil aktif belum diset. Isi QA_ACTIVE_PROFILE=<ALIAS> di .env (lihat profiles/README.md).'); return 1
    prof, sec, work = (os.path.join(ROOT, 'profiles', alias), os.path.join(ROOT, '.secrets', f'{alias}.env'), os.path.join(ROOT, 'work', alias))
    if cmd == 'where':
        print(json.dumps({'alias': alias, 'profile': os.path.relpath(prof, ROOT), 'profile_exists': os.path.isdir(prof),
                          'secrets_file_exists': os.path.isfile(sec), 'work': os.path.relpath(work, ROOT)}, indent=2)); return 0
    if cmd == 'list':
        feats = sorted(d for d in os.listdir(work) if os.path.isdir(os.path.join(work, d)) and not d.startswith(('_', '.'))) if os.path.isdir(work) else []  # _audit dll. bukan fitur
        for f in feats:
            print(f'{f}\t' + ' '.join(x for x in ('00-scope.md', '01-analysis.md', '02-testcases.md', '03-plan.md') if os.path.exists(os.path.join(work, f, x))))
        return 0
    if cmd == 'init':
        if len(argv) < 2 or argv[1].startswith('--'):
            print('Usage: qa_feature.py init <nama-fitur>'); return 1
        f = slug(argv[1]); d = os.path.join(work, f)
        for sub in ('runs', 'reports', 'plans'):
            os.makedirs(os.path.join(d, sub), exist_ok=True)
        scope = os.path.join(d, '00-scope.md')
        if not os.path.exists(scope):
            tpl = open(os.path.join(ROOT, 'templates', 'work-feature', '00-scope.md'), encoding='utf-8').read()
            tpl = tpl.replace('{{feature}}', f).replace('{{alias}}', alias).replace('{{date}}', date.today().isoformat()).replace('{{runner}}', runner_name())
            open(scope, 'w', encoding='utf-8').write(tpl)
        idx = os.path.join(d, 'runs', 'index.json')
        if not os.path.exists(idx):
            json.dump({'alias': alias, 'feature': f, 'runs': []}, open(idx, 'w'), indent=2)
        print(f'Fitur siap: {os.path.relpath(d, ROOT)} (run & laporan baru otomatis masuk ke sini)'); return 0
    print(__doc__); return 1

if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))

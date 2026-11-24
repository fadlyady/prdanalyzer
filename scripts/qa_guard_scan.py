#!/usr/bin/env python3
"""
QA Guard Scan — penjaga commit agnostik (P8 Pondasi Workflow).

Menolak commit yang memuat:
  1. Nilai rahasia: setiap nilai di .env, .secrets/*.env, mcp-server-database-qa/.env.docker
  2. Istilah terlarang lokal: .secrets/denylist.txt (identitas aplikasi/organisasi/data uji)
  3. Pola rahasia umum: private key, token cloud, JWT, password berisi nilai
  4. Email dengan domain di luar allowlist contoh
  5. Path terlarang: rahasia, profil aplikasi, artefak kerja, evidence, build

Daftar istilah & nilai sengaja TIDAK ditulis di file ini agar skrip tetap agnostik.

Usage:
  python3 scripts/qa_guard_scan.py --staged        # dipakai pre-commit hook
  python3 scripts/qa_guard_scan.py --all           # semua file yang di-track
  python3 scripts/qa_guard_scan.py <path> [...]    # file tertentu
Exit code 1 bila ada temuan.
"""
import os, re, subprocess, sys

ROOT = subprocess.run(['git', 'rev-parse', '--show-toplevel'], capture_output=True, text=True).stdout.strip() or os.getcwd()

FORBIDDEN_PATHS = [
    r'(^|/)\.env$', r'(^|/)\.env\.(?!example$|docker\.example$)[^/]+$', r'(^|/)\.secrets/', r'(^|/)\.backup/',
    r'^profiles/(?!_template/)[^/]+/', r'^work/(?!\.gitkeep$)',
    r'(^|/)automate-result/(?!\.gitkeep$)', r'(^|/)probe-result/(?!\.gitkeep$)', r'(^|/)build-apk/(?!\.gitkeep$)',
    r'(^|/)result-testcase/(?!\.gitkeep$)', r'(^|/)adhoc-document/(?!\.gitkeep$)', r'(^|/)otherTasks/(?!\.gitkeep$)',
    r'(^|/)strukturmenu/.*\.(png|jpe?g|json|md|xml)$', r'(^|/)Testcase-support/.*\.(xlsx|docx|pdf)$',
    r'\.(apk|aab|ipa|mp4|mov|har)$', r'_logcat\.txt$', r'(^|/)mutation_ledger\.jsonl$',
]
ALLOWED_EMAIL_DOMAINS = {'example.com', 'example.org', 'example.net', 'contoh.com', 'domain.com', 'test.com', 'mail.com', 'anthropic.com', 'users.noreply.github.com'}
GENERIC = [
    ('private-key', re.compile(r'-----BEGIN [A-Z ]*PRIVATE KEY-----')),
    ('aws-key', re.compile(r'\bAKIA[0-9A-Z]{16}\b')),
    ('github-token', re.compile(r'\bgh[pousr]_[A-Za-z0-9]{30,}\b')),
    ('jwt', re.compile(r'\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b')),
    ('env-secret', re.compile(r'^\s*[A-Z0-9_]*(PASS|PASSWORD|SECRET|TOKEN|API_KEY|PRIVATE_KEY)[A-Z0-9_]*\s*=\s*["\']?(?!["\']|\s*$|your[-_]|xxx|\*{3}|<|\$\{)[^\s"\']{6,}')),
    ('literal-secret', re.compile(r'(?i)\b(password|passwd|pwd|secret|token|api_?key)\b\s*[:=]\s*["\'](?!your[-_]|xxx|\*{3}|<|\$\{|example)[^"\'\s]{6,}["\']')),
]
EMAIL = re.compile(r'\b[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+\.)+[A-Za-z]{2,}\b')
NON_SECRET_KEYS = {'QA_ACTIVE_PROFILE', 'QA_DATA_TAG_PREFIX', 'QA_DEFAULT_MOBILE_ROLE', 'QA_MUTATION_MODE', 'QA_REQUIRE_DATA_TAG',
                   'QA_TAG_CONTEXT_WINDOW', 'QA_FINANCIAL_SANDBOX', 'QA_ALLOW_ANCHORED_COORDINATE_MUTATION', 'E2E_ENV', 'MOBILE_QUIET_NOTIFICATIONS'}
PLACEHOLDER = re.compile(r'(?i)^(x+|\*+|your[-_].*|example.*|changeme|placeholder|true|false|safe|full|full_external|off|staging|delete,update|\d{1,5}|https?://(staging\.)?example\.com.*)$')

def read_env_values():
    vals = set()
    files = [os.path.join(ROOT, '.env'), os.path.join(ROOT, 'mcp-server-database-qa', '.env.docker')]
    sd = os.path.join(ROOT, '.secrets')
    if os.path.isdir(sd):
        files += [os.path.join(sd, f) for f in os.listdir(sd) if f.endswith('.env')]
    for f in files:
        if not os.path.isfile(f):
            continue
        for line in open(f, encoding='utf-8', errors='ignore'):
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            k, v = line.split('=', 1)
            k, v = k.strip(), v.strip().strip('"\'')
            if k in NON_SECRET_KEYS or k.endswith('_PORT'):
                continue
            if len(v) >= 6 and not PLACEHOLDER.match(v):
                vals.add(v)
    return vals

def read_denylist():
    p = os.path.join(ROOT, '.secrets', 'denylist.txt')
    if not os.path.isfile(p):
        return []
    return [l.strip().lower() for l in open(p, encoding='utf-8') if l.strip() and not l.startswith('#')]

def mask(s):
    s = str(s)
    return (s[:2] + '***' + s[-1:]) if len(s) > 4 else '***'

def file_list(args):
    if '--staged' in args:
        out = subprocess.run(['git', 'diff', '--cached', '--name-only', '--diff-filter=ACMR'], capture_output=True, text=True, cwd=ROOT).stdout
        return [l for l in out.splitlines() if l]
    if '--all' in args:
        out = subprocess.run(['git', 'ls-files'], capture_output=True, text=True, cwd=ROOT).stdout
        return [l for l in out.splitlines() if l]
    return [a for a in args if not a.startswith('--')]

def content_of(path, staged):
    if staged:
        r = subprocess.run(['git', 'show', f':{path}'], capture_output=True, cwd=ROOT)
        data = r.stdout
    else:
        try:
            data = open(os.path.join(ROOT, path), 'rb').read()
        except OSError:
            return None
    if b'\0' in data[:8000]:
        return None  # binary: diperiksa lewat path saja
    return data.decode('utf-8', errors='ignore')

def main(args):
    staged = '--staged' in args
    files = file_list(args)
    secrets, deny = read_env_values(), read_denylist()
    findings = []
    for f in files:
        rel = f.replace('\\', '/')
        for pat in FORBIDDEN_PATHS:
            if re.search(pat, rel):
                findings.append((rel, 0, 'forbidden-path', pat))
                break
        text = content_of(rel, staged)
        if text is None:
            continue
        low = text.lower()
        for i, line in enumerate(text.splitlines(), 1):
            l = line.lower()
            for v in secrets:
                if v in line:
                    findings.append((rel, i, 'secret-value', mask(v)))
            for t in deny:
                if t in l:
                    findings.append((rel, i, 'denylist-term', mask(t)))
            for name, rx in GENERIC:
                if rx.search(line):
                    findings.append((rel, i, name, mask(rx.search(line).group(0))))
            for m in (EMAIL.finditer(line) if not rel.endswith(('package-lock.json', 'yarn.lock', 'go.sum')) else []):
                dom = m.group(0).split('@', 1)[1].lower()
                if dom not in ALLOWED_EMAIL_DOMAINS:
                    findings.append((rel, i, 'email', mask(m.group(0))))
    if findings:
        print(f'[QA GUARD] DITOLAK: {len(findings)} temuan pada {len({x[0] for x in findings})} file.')
        for f, i, kind, val in findings[:200]:
            print(f'  {f}:{i}  {kind}  {val}')
        print('Perbaiki (ganti dengan alias/placeholder, pindahkan ke profil/work lokal) lalu ulangi.')
        return 1
    print(f'[QA GUARD] OK: {len(files)} file diperiksa, tidak ada rahasia/data aplikasi.')
    return 0

if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))

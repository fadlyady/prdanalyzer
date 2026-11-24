// Selftest modul verdict: JS & Python harus menghasilkan verdict identik untuk vektor yang sama.
import { createRequire } from 'module';
import { execFileSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { computeVerdict } = require('./verdict.cjs');
const cases = require('./verdict_cases.json');
const py = JSON.parse(execFileSync('python3', ['-c', `
import json,sys; sys.path.insert(0, ${JSON.stringify(here)})
from verdict import compute_verdict
cs = json.load(open(${JSON.stringify(path.join(here, 'verdict_cases.json'))}))
print(json.dumps([compute_verdict(c['results'], c.get('risks'))['verdict'] for c in cs]))`]).toString());
let pass = 0, fail = 0;
cases.forEach((c, i) => {
  const js = computeVerdict({ results: c.results, risks: c.risks }).verdict;
  const ok = js === c.expect && py[i] === c.expect;
  ok ? pass++ : fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${c.name} -> js=${js} py=${py[i]} (expect ${c.expect})`);
});
console.log(`\n${pass} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);

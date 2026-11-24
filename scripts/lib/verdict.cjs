'use strict';
/**
 * Modul verdict tunggal (JS) — implementasi .agents/shared/standards/status-verdict-evidence.md §1 & §3.
 * Kembaran Python: scripts/lib/verdict.py. Keduanya diuji dengan vektor yang sama: scripts/lib/verdict_cases.json.
 *
 * computeVerdict({ results, risks?, reviewed? })
 *   results: [{ id, status, priority?: 'P1'..'P4', failure_category?: product|script|environment|data }]
 *   risks:   [{ id, level: Critical|High|Medium|Low, tc_ids: [...] }]  (opsional; dari analisa)
 * -> { verdict: 'NO-GO'|'CONDITIONAL GO'|'GO'|'INSUFFICIENT DATA', draft, reasons[], conditions[], counts }
 */

const NORM = [
  [/^PASSED\s*\(LOW/i, 'PASSED_LOW'],
  [/^PASS(ED)?$/i, 'PASSED'],
  [/^PARTIAL/i, 'PARTIAL'],
  [/^FAIL/i, 'FAILED'],
  [/^BLOCKED/i, 'BLOCKED'],
  [/^NOT IN SCOPE/i, 'NOT_IN_SCOPE'],
  [/^SKIP/i, 'SKIP'],
];

function normStatus(s) {
  const t = String(s || '').trim();
  for (const [re, v] of NORM) if (re.test(t)) return v;
  return 'UNKNOWN';
}

function normPriority(p) {
  const m = String(p || '').match(/P\s*([1-4])/i);
  return m ? `P${m[1]}` : null;
}

function computeVerdict({ results = [], risks = [], reviewed = false } = {}) {
  const reasons = [], conditions = [];
  const counts = { total: results.length, passed: 0, passed_low: 0, partial: 0, failed_product: 0, failed_other: 0, blocked: 0, skip: 0, not_in_scope: 0, unknown: 0 };
  const passedIds = new Set();
  let executed = 0;
  const high = p => p === 'P1' || p === 'P2';

  for (const r of results) {
    const st = normStatus(r.status);
    let pr = normPriority(r.priority);
    if (!pr && !['SKIP', 'NOT_IN_SCOPE'].includes(st)) { pr = 'P1'; conditions.push(`${r.id}: prioritas tidak tercatat, diperlakukan P1 (konservatif).`); }
    switch (st) {
      case 'PASSED': counts.passed++; executed++; passedIds.add(r.id); break;
      case 'PASSED_LOW': counts.passed_low++; executed++; if (high(pr)) conditions.push(`${r.id} (${pr}) PASSED LOW CONFIDENCE — konfirmasi visual/screenshot.`); break;
      case 'PARTIAL': counts.partial++; executed++; if (high(pr)) conditions.push(`${r.id} (${pr}) PARTIAL — layer belum tuntas.`); break;
      case 'FAILED': {
        executed++;
        const cat = String(r.failure_category || '').toLowerCase();
        if (cat && cat !== 'product') {
          counts.failed_other++;
          if (high(pr)) conditions.push(`${r.id} (${pr}) FAILED ${cat} — perbaiki & jalankan ulang (dihitung BLOCKED).`);
        } else {
          counts.failed_product++;
          const note = cat ? '' : ' [failure_category belum diisi → dianggap product sampai direview]';
          if (high(pr)) reasons.push(`${r.id} (${pr}) FAILED product${note}.`);
          else conditions.push(`${r.id} (${pr}) FAILED product${note} — defect prioritas rendah, butuh mitigasi & pemilik.`);
        }
        break;
      }
      case 'BLOCKED': counts.blocked++; if (high(pr)) conditions.push(`${r.id} (${pr}) BLOCKED.`); break;
      case 'SKIP': counts.skip++; break;
      case 'NOT_IN_SCOPE': counts.not_in_scope++; break;
      default: counts.unknown++; conditions.push(`${r.id}: status "${r.status || '-'}" tidak dikenal.`);
    }
  }

  for (const k of risks || []) {
    const lvl = String(k.level || '').toLowerCase();
    if ((lvl === 'critical' || lvl === 'high') && !(k.tc_ids || []).some(id => passedIds.has(id))) {
      reasons.push(`Risiko ${k.id} (${k.level}) belum punya satu pun TC PASSED dalam scope.`);
    }
  }

  let verdict;
  if (!executed) {
    verdict = 'INSUFFICIENT DATA';
    reasons.push('Tidak ada TC yang benar-benar dieksekusi (semua BLOCKED/SKIP/NOT IN SCOPE atau kosong).');
  } else if (reasons.length) verdict = 'NO-GO';
  else if (conditions.length) verdict = 'CONDITIONAL GO';
  else { verdict = 'GO'; conditions.push('Pastikan exit criteria 03-plan.md terpenuhi sebelum GO final.'); }

  return { verdict, draft: !reviewed, reasons, conditions, counts };
}

function verdictSummary(v) {
  const c = v.counts;
  const head = `${v.draft ? '[DRAFT — belum direview] ' : ''}${v.verdict}: ${c.passed} passed, ${c.passed_low} low-confidence, ${c.partial} partial, ${c.failed_product} failed (product), ${c.failed_other} failed (non-product), ${c.blocked} blocked, ${c.skip} skip.`;
  const why = [...v.reasons, ...v.conditions].slice(0, 8).join(' ');
  return why ? `${head} ${why}` : head;
}

module.exports = { computeVerdict, verdictSummary, normStatus, normPriority };

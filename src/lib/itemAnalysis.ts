/**
 * Classical Test Theory item analysis.
 *
 * Accepted CSV layouts (first column = student id/name, first row = item labels):
 *  1. Letter responses + key row: a row whose first cell is "KEY" holds the correct option per item.
 *  2. Scored matrix: every cell is 0/1 (or a partial score between 0 and 1).
 */

export interface ItemStat {
  item: string;
  key: string | null;
  p: number;
  discrimination: number;
  pointBiserial: number;
  flags: string[];
  distractors: { option: string; upper: number; lower: number; total: number }[];
}

export interface TestStats {
  students: number;
  items: number;
  mean: number;
  sd: number;
  meanPct: number;
  kr20: number;
  sem: number;
  scores: number[];
  itemStats: ItemStat[];
}

const mean = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const variance = (a: number[]) => {
  const m = mean(a);
  return a.length ? a.reduce((s, x) => s + (x - m) ** 2, 0) / a.length : 0;
};

function correlation(x: number[], y: number[]) {
  const mx = mean(x);
  const my = mean(y);
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < x.length; i++) {
    num += (x[i] - mx) * (y[i] - my);
    dx += (x[i] - mx) ** 2;
    dy += (y[i] - my) ** 2;
  }
  return dx && dy ? num / Math.sqrt(dx * dy) : 0;
}

export function analyzeResponses(rows: string[][]): TestStats {
  if (rows.length < 3) throw new Error('Need a header row and at least 2 students.');
  const header = rows[0].slice(1).map((h, i) => h || `Q${i + 1}`);
  const k = header.length;
  if (k < 2) throw new Error('Need at least 2 item columns.');

  const keyRow = rows.find((r) => /^(key|answer ?key|answers?)$/i.test(r[0] ?? ''));
  const studentRows = rows.slice(1).filter((r) => r !== keyRow).map((r) => r.slice(1, k + 1));
  if (studentRows.length < 2) throw new Error('Need responses from at least 2 students.');

  const keys = keyRow ? keyRow.slice(1, k + 1).map((x) => x.trim().toUpperCase()) : null;
  const numeric = !keys && studentRows.every((r) => r.every((c) => c === '' || (!Number.isNaN(Number(c)) && Number(c) >= 0 && Number(c) <= 1)));
  if (!keys && !numeric) throw new Error('Add a "KEY" row with the correct answers, or upload a 0/1 scored matrix.');

  const score = (resp: string, j: number) => {
    if (numeric) return Number(resp || 0);
    return resp.trim().toUpperCase() === keys![j] ? 1 : 0;
  };

  const matrix = studentRows.map((r) => header.map((_, j) => score(r[j] ?? '', j)));
  const totals = matrix.map((r) => r.reduce((s, x) => s + x, 0));
  const n = matrix.length;

  // Upper / lower 27% groups by total score.
  const order = totals.map((t, i) => ({ t, i })).sort((a, b) => b.t - a.t);
  const g = Math.max(1, Math.round(n * 0.27));
  const upper = order.slice(0, g).map((o) => o.i);
  const lower = order.slice(-g).map((o) => o.i);

  let sumPQ = 0;
  const itemStats: ItemStat[] = header.map((item, j) => {
    const col = matrix.map((r) => r[j]);
    const p = mean(col);
    sumPQ += p * (1 - p);
    const pu = mean(upper.map((i) => matrix[i][j]));
    const pl = mean(lower.map((i) => matrix[i][j]));
    const rest = totals.map((t, i) => t - col[i]);
    const rpb = correlation(col, rest);

    const distractors: ItemStat['distractors'] = [];
    if (keys) {
      const options = new Set(studentRows.map((r) => (r[j] ?? '').trim().toUpperCase()).filter(Boolean));
      options.add(keys[j]);
      for (const option of [...options].sort()) {
        const count = (idx: number[]) => idx.filter((i) => (studentRows[i][j] ?? '').trim().toUpperCase() === option).length;
        distractors.push({ option, upper: count(upper), lower: count(lower), total: count(studentRows.map((_, i) => i)) });
      }
    }

    const flags: string[] = [];
    if (p < 0.2) flags.push('Very hard');
    else if (p > 0.9) flags.push('Very easy');
    if (pu - pl < 0) flags.push('Negative discrimination: check the key');
    else if (pu - pl < 0.2) flags.push('Poor discrimination');
    if (keys) {
      for (const d of distractors) {
        if (d.option === keys[j]) continue;
        if (d.total === 0) flags.push(`Distractor ${d.option} never chosen`);
        else if (d.upper > d.lower) flags.push(`Distractor ${d.option} attracts top students`);
      }
    }

    return { item, key: keys ? keys[j] : null, p, discrimination: pu - pl, pointBiserial: rpb, flags, distractors };
  });

  const sd = Math.sqrt(variance(totals));
  const kr20 = k > 1 && variance(totals) > 0 ? (k / (k - 1)) * (1 - sumPQ / variance(totals)) : 0;
  return {
    students: n,
    items: k,
    mean: mean(totals),
    sd,
    meanPct: (mean(totals) / k) * 100,
    kr20,
    sem: sd * Math.sqrt(Math.max(0, 1 - kr20)),
    scores: totals,
    itemStats,
  };
}

export function reliabilityLabel(kr20: number) {
  if (kr20 >= 0.9) return 'Excellent';
  if (kr20 >= 0.8) return 'Good';
  if (kr20 >= 0.7) return 'Acceptable';
  if (kr20 >= 0.6) return 'Questionable';
  return 'Poor';
}

export function summarizeForAi(s: TestStats) {
  const lines = [
    `Students: ${s.students}, items: ${s.items}, mean ${s.mean.toFixed(2)} (${s.meanPct.toFixed(1)}%), SD ${s.sd.toFixed(2)}, KR-20 ${s.kr20.toFixed(2)}, SEM ${s.sem.toFixed(2)}.`,
    ...s.itemStats.map((it) => `${it.item}: p=${it.p.toFixed(2)}, D=${it.discrimination.toFixed(2)}, rpb=${it.pointBiserial.toFixed(2)}${it.flags.length ? ` [${it.flags.join('; ')}]` : ''}`),
  ];
  return lines.join('\n').slice(0, 2900);
}

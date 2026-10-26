type DaeGradeMetrics = {
  clientRetention: number;
  clientTarget: number;
  strategies: number;
  visits: number;
  achievement: number;
  coordination: string | number | null | undefined;
  dailyReport: string | number | null | undefined;
};

function metricValue(value: string | number | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const match = String(value ?? "").trim().match(/-?\d+(?:[.,]\d+)?/);
  if (!match) return 0;
  const parsed = Number(match[0].replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Mirrors the DAE worksheet: strategy target is 4; retention uses existing clients; remaining targets are [10, 6, 100, 6]. */
export function daeIndicatorScore(metrics: DaeGradeMetrics): number {
  const coordination = metricValue(metrics.coordination);
  const dailyReport = metricValue(metrics.dailyReport);
  const clientTarget = Math.max(0, metrics.clientTarget);
  const score =
    (clientTarget ? metrics.clientRetention / clientTarget : 0) * 30 +
    (metrics.strategies / 4) * 25 +
    (metrics.visits / 10) * 20 +
    (metrics.achievement / 6) * 15 +
    (coordination / 100) * 7.5 +
    (dailyReport / 6) * 2.5;

  return Math.round(score);
}

export function daeGrade(score: number): string {
  if (score >= 95) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  return "Buruk";
}

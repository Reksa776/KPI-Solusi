type DaeGradeMetrics = {
  clientRetention: number;
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

/** Mirrors the latest DAE worksheet: indicator targets [5, 5, 10, 6, 100, 6] and weights [30, 25, 20, 15, 7.5, 2.5]. */
export function daeIndicatorScore(metrics: DaeGradeMetrics): number {
  const coordination = metricValue(metrics.coordination);
  const dailyReport = metricValue(metrics.dailyReport);
  const score =
    (metrics.clientRetention / 5) * 30 +
    (metrics.strategies / 5) * 25 +
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

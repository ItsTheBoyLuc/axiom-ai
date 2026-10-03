/** "57.8%" for percentages, "1500 Elo" / "81 score" for other units (a space keeps words readable). */
export function formatScore(score: number, unit: string): string {
  return unit === '%' ? `${score}%` : `${score} ${unit}`;
}

/** Unit label for a chart axis or title: "%" stays "%", others read as written. */
export const unitLabel = (unit: string): string => (unit === '%' ? '%' : unit);

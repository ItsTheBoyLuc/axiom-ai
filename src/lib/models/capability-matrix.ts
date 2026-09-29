import type { BenchmarkResult } from '@/types/model';

/** Rows of the profile capabilities matrix (docs/PROMPT.md 7.3.4). `key` = benchmark category. */
export const MATRIX_ROWS = [
  { key: 'reasoning', label: 'Reasoning' },
  { key: 'coding', label: 'Coding' },
  { key: 'mathematics', label: 'Mathematics' },
  { key: 'multimodal', label: 'Multimodal' },
  { key: 'long-context', label: 'Long-context' },
  { key: 'tool-use', label: 'Tool use' },
  { key: 'instruction-following', label: 'Instruction following' },
  { key: 'creative-writing', label: 'Creative writing' },
] as const;

export type MatrixRow = {
  key: string;
  label: string;
  /** Benchmark results evidencing this capability, newest first. Empty = "No verified data". */
  evidence: BenchmarkResult[];
};

/**
 * Builds the matrix from benchmark results only. A cell is filled solely by real benchmark
 * evidence for that capability: there is no inference, averaging or invented score.
 */
export function buildCapabilityMatrix(results: BenchmarkResult[]): MatrixRow[] {
  return MATRIX_ROWS.map(({ key, label }) => ({
    key,
    label,
    evidence: results
      .filter((r) => r.category === key)
      .sort((a, b) => b.evaluationDate.localeCompare(a.evaluationDate)),
  }));
}

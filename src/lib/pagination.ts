/** Compact page list: 1 … 4 5 6 … 12 (first, last and the current page's neighbours). */
export function pageWindow(page: number, count: number): (number | 'gap')[] {
  const keep = new Set([1, count, page - 1, page, page + 1]);
  const nums = [...keep].filter((n) => n >= 1 && n <= count).sort((a, b) => a - b);
  const out: (number | 'gap')[] = [];
  nums.forEach((n, i) => {
    if (i > 0 && n - nums[i - 1]! > 1) out.push('gap');
    out.push(n);
  });
  return out;
}

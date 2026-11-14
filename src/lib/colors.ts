// Soft course colours. Each has a light-mode and dark-mode pair, defined in index.css.
export const COURSE_COLORS = ['blue', 'purple', 'orange', 'green', 'pink', 'yellow', 'teal', 'red', 'gray'] as const

export function nextColor(used: string[]): string {
  return COURSE_COLORS.find((c) => !used.includes(c)) ?? COURSE_COLORS[used.length % COURSE_COLORS.length]
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string { return count === 1 ? singular : plural; }
export function articleFor(noun: string): 'a' | 'an' { return /^[aeiou]/i.test(noun.trim()) ? 'an' : 'a'; }
export function formatQuantity(value: number, unit: string): string { return `${value} ${pluralize(value, unit)}`; }

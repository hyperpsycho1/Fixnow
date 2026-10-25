export function lkrToCents(value: string): number | null {
  const match = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) return null;
  const cents = Number(match[1]) * 100 + Number((match[2] || '').padEnd(2, '0'));
  return Number.isSafeInteger(cents) ? cents : null;
}

export function centsToLkr(cents: number): string {
  return `Rs. ${(cents / 100).toLocaleString('en-LK', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
}

export function sriLankaDateTimeInput(date: Date | null) {
  if (!date) return '';
  return new Date(date.getTime() + 330 * 60_000).toISOString().slice(0, 16);
}

export function parseSriLankaDateTime(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(`${value}:00+05:30`);
  return Number.isFinite(date.getTime()) ? date : null;
}

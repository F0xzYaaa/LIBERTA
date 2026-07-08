// Small formatting helpers shared across guest-facing pages (currency/date
// display). Centralized here so every page renders prices and dates the
// same way instead of each page re-implementing Intl formatting options.

const THB_FORMATTER = new Intl.NumberFormat('th-TH', {
  style: 'currency',
  currency: 'THB',
  maximumFractionDigits: 0,
});

/** Formats a number as Thai Baht, e.g. 4500 -> "฿4,500". */
export function formatCurrency(amount: number): string {
  return THB_FORMATTER.format(amount);
}

const DATE_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

/** Formats an ISO date string, e.g. "2026-07-10" -> "10 Jul 2026". Falls back to the raw input if unparsable. */
export function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return isoDate;
  return DATE_FORMATTER.format(date);
}

import { describe, expect, it } from 'vitest';
import { formatCurrency, formatDate } from './format';

describe('formatCurrency', () => {
  it('formats a whole number as THB with no decimal places', () => {
    const result = formatCurrency(4500);
    expect(result).toContain('4,500');
    // Thai Baht symbol/currency code should appear in some form.
    expect(result).toMatch(/฿|THB/);
  });

  it('formats zero', () => {
    expect(formatCurrency(0)).toContain('0');
  });

  it('formats negative numbers without throwing', () => {
    expect(() => formatCurrency(-100)).not.toThrow();
  });
});

describe('formatDate', () => {
  it('formats a valid ISO date string as "DD Mon YYYY"', () => {
    expect(formatDate('2026-07-10')).toBe('10 Jul 2026');
  });

  it('falls back to the raw input string for an unparsable date', () => {
    expect(formatDate('not-a-date')).toBe('not-a-date');
  });

  it('falls back to the raw input for an empty string', () => {
    expect(formatDate('')).toBe('');
  });
});

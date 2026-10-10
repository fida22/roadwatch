import { describe, it, expect } from 'vitest';
import { classify, suggest } from './conflicts';

describe('classify', () => {
  it('overlap -> high', () =>
    expect(classify('2026-10-10', '2026-11-10', '2026-10-01', '2026-11-15')?.severity).toBe('high'));
  it('touching on the same day (inclusive end) -> high', () =>
    expect(classify('2026-11-15', '2026-12-01', '2026-10-01', '2026-11-15')?.severity).toBe('high'));
  it('gap of 30 -> medium', () =>
    expect(classify('2026-12-15', '2027-01-15', '2026-10-01', '2026-11-15')?.severity).toBe('medium'));
  it('gap of 31 -> low', () =>
    expect(classify('2026-12-16', '2027-01-15', '2026-10-01', '2026-11-15')?.severity).toBe('low'));
  it('gap of 180 -> low, 181 -> null', () => {
    expect(classify('2027-05-14', '2027-06-01', '2026-10-01', '2026-11-15')?.severity).toBe('low');
    expect(classify('2027-05-15', '2027-06-01', '2026-10-01', '2026-11-15')).toBeNull();
  });
  it('new project BEFORE existing one is handled', () =>
    expect(classify('2026-06-01', '2026-07-01', '2026-10-01', '2026-11-15')?.severity).toBe('low'));
});

describe('suggest', () => {
  it('matches the doc example', () => {
    const s = suggest('2026-11-10', '2026-12-18', '2026-10-01', '2026-11-15');
    expect(s.shift.start_date).toBe('2026-11-23');
    expect(s.shift.end_date).toBe('2026-12-31');
    expect(s.merge).toEqual({ start_date: '2026-10-01', end_date: '2026-12-18' });
  });
});
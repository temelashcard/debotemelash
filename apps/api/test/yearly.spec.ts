/** Yearly fees (DECISIONS.md, 2026-11-06): the fee for a finance year, and the commission on it. */
import { addDays, billingOf, earnedBy, termsFrom, type Prices } from '../src/money/money.service';

const prices: Prices = { starter: 19000, full: 21000, included: 2, extra: 5000, cStarter: 16, cFull: 20, cExtra: 20, gov: 30 };
const starter = (due: string | null) => termsFrom(prices, 'starter', 1, due);

describe('yearly fee', () => {
  it('prices a plan by the year', () => {
    expect(starter(null)).toMatchObject({ fee: 19000, commissionBase: 3040 });
    expect(termsFrom(prices, 'full', 2, null)).toMatchObject({ fee: 21000, commissionBase: 4200, commissionExtra: 1000 });
    expect(termsFrom(prices, 'full', 4, null)).toMatchObject({ fee: 31000 });
    expect(termsFrom(prices, 'pilot', 1, null)).toMatchObject({ fee: 0 });
  });

  it('gives each state from what was paid', () => {
    const t = starter('2026-11-20');
    const at = (paid: number, today: string, status = 'active') => billingOf(status, t, paid, today);
    expect(at(0, '2026-11-10', 'trial')).toBe('btrial');
    expect(at(0, '2026-11-20')).toBe('due');
    expect(at(0, '2026-11-21')).toBe('overdue');
    expect(at(19000, '2027-03-01')).toBe('paid'); // one payment covers the year
    expect(at(10000, '2026-11-20')).toBe('partial');
  });

  it('counts days', () => {
    expect(addDays('2026-12-30', 7)).toBe('2027-01-06');
  });
});

describe('commission', () => {
  it('is a share of each payment, and goes down when money is taken back', () => {
    const t = starter('2026-11-20');
    expect(earnedBy(19000, t)).toBe(3040);
    expect(earnedBy(9500, t)).toBe(1520);
    expect(earnedBy(0, t)).toBe(0);
    expect(earnedBy(-100, t)).toBe(0);
  });

  it('counts extra branches, and nothing on a pilot', () => {
    expect(earnedBy(21000, termsFrom(prices, 'full', 2, null))).toBe(4200);
    expect(earnedBy(31000, termsFrom(prices, 'full', 4, null))).toBe(6200);
    expect(earnedBy(5000, termsFrom(prices, 'pilot', 1, null))).toBe(0);
  });
});

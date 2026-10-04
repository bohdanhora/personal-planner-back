import {
  addLocalDays,
  differenceInLocalDays,
  enumerateLocalDates,
  isValidLocalDate,
  toLocalDateInTimeZone,
  weekdayOf,
} from './local-date';

describe('local-date', () => {
  it('validates real calendar dates only', () => {
    expect(isValidLocalDate('2026-02-28')).toBe(true);
    expect(isValidLocalDate('2026-02-30')).toBe(false);
    expect(isValidLocalDate('26-02-01')).toBe(false);
  });

  it('moves across month and year boundaries', () => {
    expect(addLocalDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addLocalDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('counts and enumerates days inclusively', () => {
    expect(differenceInLocalDays('2026-10-01', '2026-10-04')).toBe(3);
    expect(enumerateLocalDates('2026-10-01', '2026-10-03')).toEqual([
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
    ]);
    expect(enumerateLocalDates('2026-10-03', '2026-10-01')).toEqual([]);
  });

  it('reads the calendar day in a timezone', () => {
    const instant = new Date('2026-10-04T22:30:00.000Z');
    expect(toLocalDateInTimeZone(instant, 'Europe/Kyiv')).toBe('2026-10-05');
    expect(toLocalDateInTimeZone(instant, 'America/New_York')).toBe('2026-10-04');
  });

  it('knows the weekday', () => {
    expect(weekdayOf('2026-10-04')).toBe(0);
    expect(weekdayOf('2026-10-05')).toBe(1);
  });
});

export type LocalDateString = string;

export const LOCAL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const MS_PER_DAY = 86_400_000;

const dateFormatters = new Map<string, Intl.DateTimeFormat>();

const getDateFormatter = (timeZone: string): Intl.DateTimeFormat => {
  const cached = dateFormatters.get(timeZone);

  if (cached) {
    return cached;
  }

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  dateFormatters.set(timeZone, formatter);
  return formatter;
};

const pad = (value: number, length = 2): string => String(value).padStart(length, '0');

export const isValidTimeZone = (timeZone: string): boolean => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
};

export const toLocalDateString = (utcMidnight: Date): LocalDateString =>
  `${pad(utcMidnight.getUTCFullYear(), 4)}-${pad(utcMidnight.getUTCMonth() + 1)}-${pad(utcMidnight.getUTCDate())}`;

export const isValidLocalDate = (value: string): boolean => {
  if (!LOCAL_DATE_PATTERN.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && toLocalDateString(parsed) === value;
};

export const parseLocalDate = (value: LocalDateString): Date => new Date(`${value}T00:00:00.000Z`);

export const toLocalDateInTimeZone = (instant: Date, timeZone: string): LocalDateString =>
  getDateFormatter(timeZone).format(instant);

export const todayInTimeZone = (timeZone: string, now = new Date()): LocalDateString =>
  toLocalDateInTimeZone(now, timeZone);

export const addLocalDays = (value: LocalDateString, days: number): LocalDateString =>
  toLocalDateString(new Date(parseLocalDate(value).getTime() + days * MS_PER_DAY));

export const differenceInLocalDays = (from: LocalDateString, to: LocalDateString): number =>
  Math.round((parseLocalDate(to).getTime() - parseLocalDate(from).getTime()) / MS_PER_DAY);

export const enumerateLocalDates = (
  from: LocalDateString,
  to: LocalDateString,
): LocalDateString[] => {
  const total = differenceInLocalDays(from, to);

  if (total < 0) {
    return [];
  }

  return Array.from({ length: total + 1 }, (_, index) => addLocalDays(from, index));
};

export const weekdayOf = (value: LocalDateString): number => parseLocalDate(value).getUTCDay();

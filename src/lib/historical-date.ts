import type { DatePrecision } from "@/src/lib/types";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December"
] as const;

type HistoricalDateParts = {
  legacyDate: string;
  displayDate: string;
  datePrecision: DatePrecision;
  sortYear: number;
  sortMonth: number | null;
  sortDay: number | null;
};

function assertNonZeroYear(year: number) {
  if (year === 0) {
    throw new Error("Year 0 is not allowed.");
  }
}

function padYear(year: number) {
  return Math.abs(year).toString().padStart(4, "0");
}

function toLegacyDateString(year: number, month: number, day: number) {
  assertNonZeroYear(year);
  const base = `${padYear(year)}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
  return year < 0 ? `${base} BC` : base;
}

function isLeapYear(year: number) {
  const normalizedYear = Math.abs(year);
  return (normalizedYear % 4 === 0 && normalizedYear % 100 !== 0) || normalizedYear % 400 === 0;
}

function assertValidMonth(month: number) {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("Month must be between 1 and 12.");
  }
}

function assertValidDay(year: number, month: number, day: number) {
  assertValidMonth(month);
  const daysInMonth = [
    31,
    isLeapYear(year) ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31
  ];
  const maxDays = daysInMonth[month - 1];

  if (!Number.isInteger(day) || day < 1 || typeof maxDays !== "number" || day > maxDays) {
    throw new Error("Day is out of range for the given month.");
  }
}

function formatYearLabel(year: number, forceEra = false) {
  assertNonZeroYear(year);
  const absoluteYear = Math.abs(year).toString();

  if (year < 0) {
    return `${absoluteYear} BCE`;
  }

  if (forceEra) {
    return `${absoluteYear} CE`;
  }

  return absoluteYear;
}

function formatDisplayDateFromParts(
  year: number,
  month: number | null,
  day: number | null,
  precision: DatePrecision,
  forceEra = false
) {
  const yearLabel = formatYearLabel(year, forceEra);

  if (precision === "year" || month === null) {
    return yearLabel;
  }

  const monthLabel = MONTH_NAMES[month - 1];
  if (!monthLabel) {
    return yearLabel;
  }

  if (precision === "month" || day === null) {
    return `${monthLabel} ${yearLabel}`;
  }

  return `${monthLabel} ${day}, ${yearLabel}`;
}

function parseIsoYear(rawDate: string) {
  const match = rawDate.match(/^(\d{4})$/);
  if (!match) {
    return null;
  }

  return {
    year: Number(match[1])
  };
}

function parseIsoMonth(rawDate: string) {
  const match = rawDate.match(/^(\d{4})-(\d{2})$/);
  if (!match) {
    return null;
  }

  return {
    year: Number(match[1]),
    month: Number(match[2])
  };
}

function parseIsoDay(rawDate: string) {
  const match = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3])
  };
}

function parseSqlLegacyBcDay(rawDate: string) {
  const match = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})\s+BC$/i);
  if (!match) {
    return null;
  }

  return {
    year: -Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3])
  };
}

function parseYearWithEra(rawDate: string) {
  const match = rawDate.match(/^(\d{1,6})\s*(BCE|CE)$/i);
  if (!match) {
    return null;
  }

  const absoluteYear = Number(match[1]);
  const rawEra = match[2];
  if (!rawEra) {
    return null;
  }

  const era = rawEra.toUpperCase();
  const year = era === "BCE" ? -absoluteYear : absoluteYear;
  assertNonZeroYear(year);

  return {
    year,
    forceEra: true
  };
}

function parseApproximateYear(rawDate: string) {
  const match = rawDate.match(/^(?:c\.|ca\.|circa)\s*(\d{1,6})(?:\s*(BCE|CE))?$/i);
  if (!match) {
    return null;
  }

  const absoluteYear = Number(match[1]);
  const era = (match[2] || "CE").toUpperCase();
  const year = era === "BCE" ? -absoluteYear : absoluteYear;
  assertNonZeroYear(year);

  return {
    year,
    era
  };
}

export function parseHistoricalDateInput(rawDate: string, rawPrecision?: DatePrecision): HistoricalDateParts {
  const value = rawDate.trim();
  if (!value) {
    throw new Error("Date is required.");
  }

  const approximate = parseApproximateYear(value);
  if (approximate) {
    if (rawPrecision && rawPrecision !== "approximate") {
      throw new Error("Approximate chronology requires approximate precision.");
    }

    return {
      legacyDate: toLegacyDateString(approximate.year, 1, 1),
      displayDate: value,
      datePrecision: "approximate",
      sortYear: approximate.year,
      sortMonth: null,
      sortDay: null
    };
  }

  const explicitPrecision = rawPrecision || null;
  const isoDay = parseIsoDay(value);
  const isoMonth = parseIsoMonth(value);
  const isoYear = parseIsoYear(value);
  const sqlLegacyBcDay = parseSqlLegacyBcDay(value);
  const eraYear = parseYearWithEra(value);
  const normalizedDay = sqlLegacyBcDay || isoDay;

  if (explicitPrecision === "day") {
    if (!normalizedDay) {
      throw new Error("Day precision dates must use YYYY-MM-DD.");
    }

    assertNonZeroYear(normalizedDay.year);
    assertValidDay(normalizedDay.year, normalizedDay.month, normalizedDay.day);
    return {
      legacyDate: toLegacyDateString(normalizedDay.year, normalizedDay.month, normalizedDay.day),
      displayDate: formatDisplayDateFromParts(normalizedDay.year, normalizedDay.month, normalizedDay.day, "day"),
      datePrecision: "day",
      sortYear: normalizedDay.year,
      sortMonth: normalizedDay.month,
      sortDay: normalizedDay.day
    };
  }

  if (explicitPrecision === "month") {
    if (isoMonth) {
      assertNonZeroYear(isoMonth.year);
      assertValidMonth(isoMonth.month);
      return {
        legacyDate: toLegacyDateString(isoMonth.year, isoMonth.month, 1),
        displayDate: formatDisplayDateFromParts(isoMonth.year, isoMonth.month, null, "month"),
        datePrecision: "month",
        sortYear: isoMonth.year,
        sortMonth: isoMonth.month,
        sortDay: null
      };
    }

    if (normalizedDay && normalizedDay.day === 1) {
      assertNonZeroYear(normalizedDay.year);
      assertValidDay(normalizedDay.year, normalizedDay.month, normalizedDay.day);
      return {
        legacyDate: toLegacyDateString(normalizedDay.year, normalizedDay.month, normalizedDay.day),
        displayDate: formatDisplayDateFromParts(normalizedDay.year, normalizedDay.month, null, "month"),
        datePrecision: "month",
        sortYear: normalizedDay.year,
        sortMonth: normalizedDay.month,
        sortDay: null
      };
    }

    throw new Error("Month precision dates must use YYYY-MM or YYYY-MM-01.");
  }

  if (explicitPrecision === "year") {
    if (eraYear) {
      return {
        legacyDate: toLegacyDateString(eraYear.year, 1, 1),
        displayDate: formatDisplayDateFromParts(eraYear.year, null, null, "year", true),
        datePrecision: "year",
        sortYear: eraYear.year,
        sortMonth: null,
        sortDay: null
      };
    }

    if (isoYear) {
      assertNonZeroYear(isoYear.year);
      return {
        legacyDate: toLegacyDateString(isoYear.year, 1, 1),
        displayDate: formatDisplayDateFromParts(isoYear.year, null, null, "year"),
        datePrecision: "year",
        sortYear: isoYear.year,
        sortMonth: null,
        sortDay: null
      };
    }

    if (normalizedDay && normalizedDay.month === 1 && normalizedDay.day === 1) {
      assertNonZeroYear(normalizedDay.year);
      assertValidDay(normalizedDay.year, normalizedDay.month, normalizedDay.day);
      return {
        legacyDate: toLegacyDateString(normalizedDay.year, normalizedDay.month, normalizedDay.day),
        displayDate: formatDisplayDateFromParts(normalizedDay.year, null, null, "year"),
        datePrecision: "year",
        sortYear: normalizedDay.year,
        sortMonth: null,
        sortDay: null
      };
    }

    throw new Error("Year precision dates must use YYYY, YYYY-01-01, or an explicit BCE/CE year.");
  }

  if (explicitPrecision === "approximate") {
    if (normalizedDay) {
      assertNonZeroYear(normalizedDay.year);
      assertValidDay(normalizedDay.year, normalizedDay.month, normalizedDay.day);
      return {
        legacyDate: toLegacyDateString(normalizedDay.year, normalizedDay.month, normalizedDay.day),
        displayDate: value,
        datePrecision: "approximate",
        sortYear: normalizedDay.year,
        sortMonth: normalizedDay.month,
        sortDay: normalizedDay.day
      };
    }

    throw new Error("Approximate precision dates must use a supported historical date expression.");
  }

  if (eraYear) {
    return {
      legacyDate: toLegacyDateString(eraYear.year, 1, 1),
      displayDate: formatDisplayDateFromParts(eraYear.year, null, null, "year", true),
      datePrecision: "year",
      sortYear: eraYear.year,
      sortMonth: null,
      sortDay: null
    };
  }

  if (normalizedDay) {
    assertNonZeroYear(normalizedDay.year);
    assertValidDay(normalizedDay.year, normalizedDay.month, normalizedDay.day);
    return {
      legacyDate: toLegacyDateString(normalizedDay.year, normalizedDay.month, normalizedDay.day),
      displayDate: formatDisplayDateFromParts(normalizedDay.year, normalizedDay.month, normalizedDay.day, "day"),
      datePrecision: "day",
      sortYear: normalizedDay.year,
      sortMonth: normalizedDay.month,
      sortDay: normalizedDay.day
    };
  }

  if (isoMonth) {
    assertNonZeroYear(isoMonth.year);
    assertValidMonth(isoMonth.month);
    return {
      legacyDate: toLegacyDateString(isoMonth.year, isoMonth.month, 1),
      displayDate: formatDisplayDateFromParts(isoMonth.year, isoMonth.month, null, "month"),
      datePrecision: "month",
      sortYear: isoMonth.year,
      sortMonth: isoMonth.month,
      sortDay: null
    };
  }

  if (isoYear) {
    assertNonZeroYear(isoYear.year);
    return {
      legacyDate: toLegacyDateString(isoYear.year, 1, 1),
      displayDate: formatDisplayDateFromParts(isoYear.year, null, null, "year"),
      datePrecision: "year",
      sortYear: isoYear.year,
      sortMonth: null,
      sortDay: null
    };
  }

  throw new Error("Date must use a supported historical format.");
}

export function formatHistoricalDisplayDate(input: {
  date: string;
  datePrecision: DatePrecision;
  displayDate?: string | null;
  sortYear?: number | null;
  sortMonth?: number | null;
  sortDay?: number | null;
}) {
  if (input.displayDate?.trim()) {
    return input.displayDate.trim();
  }

  const parsed = parseHistoricalDateInput(input.date, input.datePrecision);
  return parsed.displayDate;
}

export function formatHistoricalYearLabel(input: {
  date: string;
  datePrecision: DatePrecision;
  displayDate?: string | null;
  sortYear?: number | null;
}) {
  if (typeof input.sortYear === "number" && input.sortYear !== 0) {
    return formatYearLabel(input.sortYear);
  }

  const parsed = parseHistoricalDateInput(input.date, input.datePrecision);
  return formatYearLabel(parsed.sortYear);
}

export function compareHistoricalSort(
  left: {
    sortYear?: number | null;
    sortMonth?: number | null;
    sortDay?: number | null;
    date: string;
    datePrecision: DatePrecision;
  },
  right: {
    sortYear?: number | null;
    sortMonth?: number | null;
    sortDay?: number | null;
    date: string;
    datePrecision: DatePrecision;
  }
) {
  const leftParts =
    typeof left.sortYear === "number"
      ? left
      : parseHistoricalDateInput(left.date, left.datePrecision);
  const rightParts =
    typeof right.sortYear === "number"
      ? right
      : parseHistoricalDateInput(right.date, right.datePrecision);

  if ((leftParts.sortYear || 0) !== (rightParts.sortYear || 0)) {
    return (leftParts.sortYear || 0) - (rightParts.sortYear || 0);
  }

  if ((leftParts.sortMonth || 0) !== (rightParts.sortMonth || 0)) {
    return (leftParts.sortMonth || 0) - (rightParts.sortMonth || 0);
  }

  if ((leftParts.sortDay || 0) !== (rightParts.sortDay || 0)) {
    return (leftParts.sortDay || 0) - (rightParts.sortDay || 0);
  }

  return 0;
}

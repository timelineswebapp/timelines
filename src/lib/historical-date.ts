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

const APPROXIMATE_PREFIX = /^(?:c\.|ca\.|circa)\s*/i;

type ChronologyModifier = "early" | "mid" | "late" | null;
type Era = "BCE" | "CE";

type HistoricalDateParts = {
  legacyDate: string;
  displayDate: string;
  datePrecision: DatePrecision;
  sortYear: number;
  sortMonth: number | null;
  sortDay: number | null;
};

type HistoricalParseOptions = {
  approximate?: boolean;
  modifier?: ChronologyModifier;
  forceEra?: boolean;
};

type HistoricalSortLike = {
  sortYear?: number | null;
  sortMonth?: number | null;
  sortDay?: number | null;
  date: string;
  datePrecision: DatePrecision;
  title?: string;
  displayDate?: string | null;
  eventOrder?: number | null;
  id?: number | null;
};

type EraYear = {
  year: number;
  forceEra: boolean;
};

type NumericDate = {
  year: number;
  month: number;
  day: number;
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

function toCanonicalEra(rawEra: string | undefined): Era {
  const normalized = (rawEra || "CE").toUpperCase();
  if (normalized === "BCE" || normalized === "BC") {
    return "BCE";
  }

  return "CE";
}

function ordinalSuffix(value: number) {
  const remainder = value % 100;
  if (remainder >= 11 && remainder <= 13) {
    return "th";
  }

  switch (value % 10) {
    case 1:
      return "st";
    case 2:
      return "nd";
    case 3:
      return "rd";
    default:
      return "th";
  }
}

function formatCenturyDisplay(century: number, era: Era, modifier: ChronologyModifier, approximate: boolean) {
  const base = `${century}${ordinalSuffix(century)} century ${era}`;
  const withModifier = modifier ? `${modifier} ${base}` : base;
  return approximate ? `c. ${withModifier}` : withModifier;
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
  options?: HistoricalParseOptions
) {
  const approximate = options?.approximate || false;
  const forceEra = options?.forceEra || false;
  const yearLabel = formatYearLabel(year, forceEra);

  let label = yearLabel;

  if (precision !== "year" && month !== null) {
    const monthLabel = MONTH_NAMES[month - 1];
    if (monthLabel) {
      label =
        precision === "day" && day !== null
          ? `${monthLabel} ${day}, ${yearLabel}`
          : `${monthLabel} ${yearLabel}`;
    }
  }

  return approximate ? `c. ${label}` : label;
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

function parseEraYear(rawDate: string): EraYear | null {
  const match = rawDate.match(/^(\d{1,6})\s*(BCE|BC|CE|AD)$/i);
  if (!match) {
    return null;
  }

  const absoluteYear = Number(match[1]);
  const era = toCanonicalEra(match[2]);
  const year = era === "BCE" ? -absoluteYear : absoluteYear;
  assertNonZeroYear(year);

  return {
    year,
    forceEra: true
  };
}

function parseEraMonthOrDay(rawDate: string): NumericDate | { year: number; month: number; day: null } | null {
  const match = rawDate.match(/^(\d{1,6})\s*(BCE|BC|CE|AD)\s*-\s*(\d{2})(?:\s*-\s*(\d{2}))?$/i);
  if (!match) {
    return null;
  }

  const absoluteYear = Number(match[1]);
  const era = toCanonicalEra(match[2]);
  const month = Number(match[3]);
  const rawDay = match[4];
  const year = era === "BCE" ? -absoluteYear : absoluteYear;

  assertNonZeroYear(year);
  assertValidMonth(month);

  if (rawDay) {
    const day = Number(rawDay);
    assertValidDay(year, month, day);
    return {
      year,
      month,
      day
    };
  }

  return {
    year,
    month,
    day: null
  };
}

function parseCenturyExpression(rawDate: string) {
  const match = rawDate.match(/^(?:(early|mid|late)[-\s]+)?(\d{1,2})(?:st|nd|rd|th)\s+century\s*(BCE|BC|CE|AD)?$/i);
  if (!match) {
    return null;
  }

  const modifier = ((match[1] || null)?.toLowerCase() || null) as ChronologyModifier;
  const century = Number(match[2]);
  if (!Number.isInteger(century) || century < 1) {
    throw new Error("Century must be a positive ordinal.");
  }

  const era = toCanonicalEra(match[3]);
  let startYear = era === "BCE" ? -(century * 100) : (century - 1) * 100 + 1;
  let endYear = era === "BCE" ? -((century - 1) * 100 + 1) : century * 100;

  assertNonZeroYear(startYear);
  assertNonZeroYear(endYear);

  const span = endYear - startYear;
  const anchorRatio = modifier === "early" ? 0.25 : modifier === "late" ? 0.75 : 0.5;
  const anchorYear = Math.round(startYear + span * anchorRatio);
  assertNonZeroYear(anchorYear);

  return {
    century,
    era,
    modifier,
    anchorYear
  };
}

function normalizeApproximatePrefix(rawDate: string) {
  if (!APPROXIMATE_PREFIX.test(rawDate)) {
    return {
      approximate: false,
      value: rawDate.trim()
    };
  }

  return {
    approximate: true,
    value: rawDate.replace(APPROXIMATE_PREFIX, "").trim()
  };
}

function normalizeEarlyCeIsoInput(rawDate: string) {
  const yearMatch = rawDate.match(/^(\d{1,3})$/);
  if (yearMatch) {
    const year = Number(yearMatch[1]);
    if (year > 0) {
      return year.toString().padStart(4, "0");
    }
  }

  const dayMatch = rawDate.match(/^(\d{1,3})-(\d{2})-(\d{2})$/);
  if (dayMatch) {
    const year = Number(dayMatch[1]);
    if (year > 0) {
      return `${year.toString().padStart(4, "0")}-${dayMatch[2]}-${dayMatch[3]}`;
    }
  }

  const monthMatch = rawDate.match(/^(\d{1,3})-(\d{2})$/);
  if (monthMatch) {
    const year = Number(monthMatch[1]);
    if (year > 0) {
      return `${year.toString().padStart(4, "0")}-${monthMatch[2]}`;
    }
  }

  return rawDate;
}

function resolvePrecisionRank(precision: DatePrecision) {
  switch (precision) {
    case "approximate":
      return 0;
    case "year":
      return 1;
    case "month":
      return 2;
    case "day":
      return 3;
    default:
      return 0;
  }
}

function buildHistoricalParts(
  year: number,
  month: number | null,
  day: number | null,
  precision: DatePrecision,
  options?: HistoricalParseOptions
): HistoricalDateParts {
  const effectiveMonth = month ?? 1;
  const effectiveDay = day ?? 1;

  assertNonZeroYear(year);
  assertValidDay(year, effectiveMonth, effectiveDay);

  return {
    legacyDate: toLegacyDateString(year, effectiveMonth, effectiveDay),
    displayDate: formatDisplayDateFromParts(year, month, day, precision, options),
    datePrecision: precision,
    sortYear: year,
    sortMonth: month,
    sortDay: day
  };
}

export function parseHistoricalDateInput(rawDate: string, rawPrecision?: DatePrecision): HistoricalDateParts {
  const value = rawDate.trim();
  if (!value) {
    throw new Error("Date is required.");
  }

  const { approximate, value: normalizedApproximateValue } = normalizeApproximatePrefix(value);
  const normalizedValue = normalizeEarlyCeIsoInput(normalizedApproximateValue);
  const explicitPrecision = rawPrecision || null;
  const isoDay = parseIsoDay(normalizedValue);
  const isoMonth = parseIsoMonth(normalizedValue);
  const isoYear = parseIsoYear(normalizedValue);
  const sqlLegacyBcDay = parseSqlLegacyBcDay(normalizedValue);
  const eraYear = parseEraYear(normalizedValue);
  const eraMonthOrDay = parseEraMonthOrDay(normalizedValue);
  const century = parseCenturyExpression(normalizedValue);
  const normalizedDay =
    sqlLegacyBcDay || (eraMonthOrDay && eraMonthOrDay.day !== null ? eraMonthOrDay : null) || isoDay;
  const normalizedMonth =
    (eraMonthOrDay && eraMonthOrDay.day === null ? eraMonthOrDay : null) || isoMonth;

  if (century) {
    if (explicitPrecision && explicitPrecision !== "approximate") {
      throw new Error("Century expressions must use approximate precision.");
    }

    return {
      legacyDate: toLegacyDateString(century.anchorYear, 1, 1),
      displayDate: formatCenturyDisplay(century.century, century.era, century.modifier, true),
      datePrecision: "approximate",
      sortYear: century.anchorYear,
      sortMonth: null,
      sortDay: null
    };
  }

  if (explicitPrecision === "day") {
    if (!normalizedDay) {
      throw new Error("Day precision dates must use YYYY-MM-DD or an explicit BCE/CE day.");
    }

    return buildHistoricalParts(normalizedDay.year, normalizedDay.month, normalizedDay.day, "day", {
      approximate,
      forceEra: eraYear?.forceEra || (eraMonthOrDay ? eraMonthOrDay.year > 0 : false)
    });
  }

  if (explicitPrecision === "month") {
    if (normalizedMonth) {
      return buildHistoricalParts(normalizedMonth.year, normalizedMonth.month, null, "month", {
        approximate,
        forceEra: normalizedMonth.year > 0 && !!eraMonthOrDay
      });
    }

    if (normalizedDay && normalizedDay.day === 1) {
      return buildHistoricalParts(normalizedDay.year, normalizedDay.month, null, "month", {
        approximate,
        forceEra: normalizedDay.year > 0 && !!eraMonthOrDay
      });
    }

    throw new Error("Month precision dates must use YYYY-MM, YYYY-MM-01, or an explicit BCE/CE month.");
  }

  if (explicitPrecision === "year") {
    if (eraYear) {
      return buildHistoricalParts(eraYear.year, null, null, "year", {
        approximate,
        forceEra: true
      });
    }

    if (isoYear) {
      return buildHistoricalParts(isoYear.year, null, null, "year", {
        approximate
      });
    }

    if (normalizedDay && normalizedDay.month === 1 && normalizedDay.day === 1) {
      return buildHistoricalParts(normalizedDay.year, null, null, "year", {
        approximate,
        forceEra: normalizedDay.year > 0 && !!sqlLegacyBcDay
      });
    }

    throw new Error("Year precision dates must use YYYY, YYYY-01-01, or an explicit BCE/CE year.");
  }

  if (explicitPrecision === "approximate") {
    if (normalizedDay) {
      return buildHistoricalParts(normalizedDay.year, normalizedDay.month, normalizedDay.day, "approximate", {
        approximate: true,
        forceEra: normalizedDay.year > 0 && !!eraMonthOrDay
      });
    }

    if (normalizedMonth) {
      return buildHistoricalParts(normalizedMonth.year, normalizedMonth.month, null, "approximate", {
        approximate: true,
        forceEra: normalizedMonth.year > 0 && !!eraMonthOrDay
      });
    }

    if (eraYear) {
      return buildHistoricalParts(eraYear.year, null, null, "approximate", {
        approximate: true,
        forceEra: true
      });
    }

    if (isoYear) {
      return buildHistoricalParts(isoYear.year, null, null, "approximate", {
        approximate: true
      });
    }

    throw new Error("Approximate precision dates must use a supported historical date expression.");
  }

  if (approximate) {
    if (normalizedDay) {
      return buildHistoricalParts(normalizedDay.year, normalizedDay.month, normalizedDay.day, "approximate", {
        approximate: true,
        forceEra: normalizedDay.year > 0 && !!eraMonthOrDay
      });
    }

    if (normalizedMonth) {
      return buildHistoricalParts(normalizedMonth.year, normalizedMonth.month, null, "approximate", {
        approximate: true,
        forceEra: normalizedMonth.year > 0 && !!eraMonthOrDay
      });
    }

    if (eraYear) {
      return buildHistoricalParts(eraYear.year, null, null, "approximate", {
        approximate: true,
        forceEra: true
      });
    }

    if (isoYear) {
      return buildHistoricalParts(isoYear.year, null, null, "approximate", {
        approximate: true
      });
    }
  }

  if (eraMonthOrDay) {
    if (eraMonthOrDay.day === null) {
      return buildHistoricalParts(eraMonthOrDay.year, eraMonthOrDay.month, null, "month", {
        forceEra: eraMonthOrDay.year > 0
      });
    }

    return buildHistoricalParts(eraMonthOrDay.year, eraMonthOrDay.month, eraMonthOrDay.day, "day", {
      forceEra: eraMonthOrDay.year > 0
    });
  }

  if (eraYear) {
    return buildHistoricalParts(eraYear.year, null, null, "year", {
      forceEra: true
    });
  }

  if (normalizedDay) {
    return buildHistoricalParts(normalizedDay.year, normalizedDay.month, normalizedDay.day, "day");
  }

  if (normalizedMonth) {
    return buildHistoricalParts(normalizedMonth.year, normalizedMonth.month, null, "month");
  }

  if (isoYear) {
    return buildHistoricalParts(isoYear.year, null, null, "year");
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
  forceEra?: boolean;
}) {
  if (input.displayDate?.trim()) {
    const trimmed = input.displayDate.trim();
    const eraMatch = trimmed.match(/^c\.\s+(.+)$/i);
    const withoutApproximate = eraMatch?.[1] || trimmed;
    const centuryMatch = withoutApproximate.match(/^(?:early|mid|late)\s+\d+(?:st|nd|rd|th)\s+century\s+(BCE|CE)$/i);
    if (centuryMatch) {
      return withoutApproximate;
    }

    const yearMatch = withoutApproximate.match(/(\d+)\s*(BCE|CE)$/i);
    const matchedYear = yearMatch?.[1];
    const matchedEra = yearMatch?.[2];
    if (matchedYear && matchedEra) {
      return `${matchedYear} ${matchedEra.toUpperCase()}`;
    }
  }

  if (typeof input.sortYear === "number" && input.sortYear !== 0) {
    return formatYearLabel(input.sortYear, input.forceEra);
  }

  const parsed = parseHistoricalDateInput(input.date, input.datePrecision);
  return formatYearLabel(parsed.sortYear, input.forceEra);
}

export function compareHistoricalSort(left: HistoricalSortLike, right: HistoricalSortLike) {
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

  const precisionDelta = resolvePrecisionRank(left.datePrecision) - resolvePrecisionRank(right.datePrecision);
  if (precisionDelta !== 0) {
    return precisionDelta;
  }

  if (typeof left.eventOrder === "number" && typeof right.eventOrder === "number" && left.eventOrder !== right.eventOrder) {
    return left.eventOrder - right.eventOrder;
  }

  if (typeof left.id === "number" && typeof right.id === "number" && left.id !== right.id) {
    return left.id - right.id;
  }

  const leftTitle = left.title?.trim().toLowerCase() || "";
  const rightTitle = right.title?.trim().toLowerCase() || "";
  if (leftTitle !== rightTitle) {
    return leftTitle.localeCompare(rightTitle);
  }

  const leftDisplay = left.displayDate?.trim() || left.date;
  const rightDisplay = right.displayDate?.trim() || right.date;
  return leftDisplay.localeCompare(rightDisplay);
}

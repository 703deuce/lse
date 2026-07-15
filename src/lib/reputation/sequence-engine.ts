/** Quiet hours + sending window helpers (pure; timezone-aware via Intl). */

export type LocalParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number; // 0=Sun … 6=Sat
};

export function localPartsInTimeZone(date: Date, timeZone: string): LocalParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  });
  const parts = fmt.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "0";
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    weekday: weekdayMap[get("weekday")] ?? 0,
  };
}

function parseHm(hm: string): { hour: number; minute: number } {
  const [h, m] = hm.split(":").map((x) => Number(x));
  return { hour: h || 0, minute: m || 0 };
}

export function minutesOfDay(hour: number, minute: number): number {
  return hour * 60 + minute;
}

/**
 * True when `now` is inside [windowStart, windowEnd) in the recipient timezone.
 * Windows that wrap midnight are supported (e.g. 22:00–06:00).
 */
export function isWithinSendingWindow(
  now: Date,
  timeZone: string,
  windowStart: string,
  windowEnd: string,
  sendDays?: number[]
): boolean {
  const local = localPartsInTimeZone(now, timeZone);
  if (sendDays && sendDays.length > 0 && !sendDays.includes(local.weekday)) {
    return false;
  }
  const start = parseHm(windowStart);
  const end = parseHm(windowEnd);
  const cur = minutesOfDay(local.hour, local.minute);
  const a = minutesOfDay(start.hour, start.minute);
  const b = minutesOfDay(end.hour, end.minute);
  if (a === b) return true;
  if (a < b) return cur >= a && cur < b;
  return cur >= a || cur < b;
}

/** Quiet hours = outside the allowed sending window. */
export function isQuietHour(
  now: Date,
  timeZone: string,
  windowStart: string,
  windowEnd: string
): boolean {
  return !isWithinSendingWindow(now, timeZone, windowStart, windowEnd);
}

export type SequenceCondition =
  | "message_delivered"
  | "link_clicked"
  | "customer_replied"
  | "customer_opted_out"
  | "review_detected"
  | "no_activity"
  | "valid_phone"
  | "valid_email";

export type RecipientFacts = {
  delivered: boolean;
  clicked: boolean;
  replied: boolean;
  optedOut: boolean;
  reviewDetected: boolean;
  hasPhone: boolean;
  hasEmail: boolean;
};

export function evaluateSequenceCondition(
  condition: SequenceCondition,
  facts: RecipientFacts
): boolean {
  switch (condition) {
    case "message_delivered":
      return facts.delivered;
    case "link_clicked":
      return facts.clicked;
    case "customer_replied":
      return facts.replied;
    case "customer_opted_out":
      return facts.optedOut;
    case "review_detected":
      return facts.reviewDetected;
    case "no_activity":
      return !facts.clicked && !facts.replied && !facts.reviewDetected;
    case "valid_phone":
      return facts.hasPhone;
    case "valid_email":
      return facts.hasEmail;
    default:
      return false;
  }
}

/** Default review-request drip (brief example). */
export function defaultReviewRequestSequence() {
  return [
    { step_key: "initial", step_type: "send_sms" as const, config: {} },
    { step_key: "wait_2d", step_type: "wait" as const, config: { days: 2 } },
    {
      step_key: "reminder_1_gate",
      step_type: "condition" as const,
      config: {
        all: ["no_activity", "customer_opted_out:false"] as string[],
        then: "reminder_1",
        else: "end",
      },
    },
    { step_key: "reminder_1", step_type: "send_sms" as const, config: { template: "reminder" } },
    { step_key: "wait_4d", step_type: "wait" as const, config: { days: 4 } },
    {
      step_key: "reminder_2_gate",
      step_type: "condition" as const,
      config: {
        all: ["no_activity", "customer_opted_out:false"] as string[],
        then: "reminder_2",
        else: "end",
      },
    },
    { step_key: "reminder_2", step_type: "send_sms" as const, config: { template: "final" } },
    { step_key: "end", step_type: "end" as const, config: {} },
  ];
}

export const SEQUENCE_LIMITS = {
  maxReminders: 2,
  minWaitHours: 24,
} as const;

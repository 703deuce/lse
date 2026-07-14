/**
 * Structured JSON logger. Optional Sentry hook is a no-op until SENTRY_DSN is set
 * and @sentry/node is installed — do not require external setup.
 */

export type LogFields = Record<string, unknown>;

type LogLevel = "debug" | "info" | "warn" | "error";

function emit(level: LogLevel, msg: string, fields?: LogFields) {
  const payload = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...fields,
  };
  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);

  // Soft Sentry bridge — only when both DSN and package exist.
  if (level === "error" && process.env.SENTRY_DSN) {
    void captureOptionalSentry(payload);
  }
}

async function captureOptionalSentry(payload: Record<string, unknown>) {
  try {
    // Dynamic import keeps production builds working without the package.
    const sentry = (await import("@sentry/node" as string).catch(() => null)) as {
      captureMessage?: (message: string, context?: unknown) => void;
      captureException?: (err: unknown) => void;
    } | null;
    if (!sentry?.captureMessage) return;
    sentry.captureMessage(String(payload.msg ?? "error"), {
      level: "error",
      extra: payload,
    });
  } catch {
    // ignore
  }
}

export const logger = {
  debug: (msg: string, fields?: LogFields) => emit("debug", msg, fields),
  info: (msg: string, fields?: LogFields) => emit("info", msg, fields),
  warn: (msg: string, fields?: LogFields) => emit("warn", msg, fields),
  error: (msg: string, fields?: LogFields) => emit("error", msg, fields),
};

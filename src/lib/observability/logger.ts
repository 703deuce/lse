/**
 * Structured JSON logger — console only (no Sentry / third-party crash reporters).
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
}

export const logger = {
  debug: (msg: string, fields?: LogFields) => emit("debug", msg, fields),
  info: (msg: string, fields?: LogFields) => emit("info", msg, fields),
  warn: (msg: string, fields?: LogFields) => emit("warn", msg, fields),
  error: (msg: string, fields?: LogFields) => emit("error", msg, fields),
};

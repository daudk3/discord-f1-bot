/**
 * Simple structured logger.
 * Writes to stdout/stderr with timestamps and log levels.
 */

enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

function log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  const timestamp = new Date().toISOString();
  const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
  const line = `[${timestamp}] [${level}] ${message}${metaStr}`;

  if (level === LogLevel.ERROR) {
    console.error(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  debug: (msg: string, meta?: Record<string, unknown>) => log(LogLevel.DEBUG, msg, meta),
  info: (msg: string, meta?: Record<string, unknown>) => log(LogLevel.INFO, msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => log(LogLevel.WARN, msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => log(LogLevel.ERROR, msg, meta),
};

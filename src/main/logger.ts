import { appendFileSync, existsSync, mkdirSync, renameSync, statSync } from 'node:fs';
import { join } from 'node:path';

type Level = 'debug' | 'info' | 'warn' | 'error';
const ORDER: Record<Level, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const MAX_LOG_BYTES = 1_000_000;

let threshold: Level = 'info';
let logFile: string | null = null;

export function configureLogger(options: { level: Level; directory?: string }): void {
  threshold = options.level;
  if (options.directory) {
    try {
      mkdirSync(options.directory, { recursive: true });
      logFile = join(options.directory, 'main.log');
      if (existsSync(logFile) && statSync(logFile).size > MAX_LOG_BYTES) renameSync(logFile, `${logFile}.1`);
    } catch {
      logFile = null;
    }
  }
}

function format(arg: unknown): string {
  if (arg instanceof Error) return arg.message;
  if (typeof arg === 'string') return arg;
  try {
    return JSON.stringify(arg);
  } catch {
    return String(arg);
  }
}

export interface Logger {
  debug(message: string, ...extra: unknown[]): void;
  info(message: string, ...extra: unknown[]): void;
  warn(message: string, ...extra: unknown[]): void;
  error(message: string, ...extra: unknown[]): void;
}

/** Scoped logger, e.g. `createLogger('spotify')`. Never logs tokens or API keys: callers must not pass them. */
export function createLogger(scope: string): Logger {
  const write = (level: Level, message: string, extra: unknown[]): void => {
    if (ORDER[level] < ORDER[threshold]) return;
    const line = `${new Date().toISOString()} ${level.toUpperCase().padEnd(5)} [${scope}] ${message}${
      extra.length ? ' ' + extra.map(format).join(' ') : ''
    }`;
    (level === 'error' ? console.error : level === 'warn' ? console.warn : console.log)(line);
    if (logFile) {
      try {
        appendFileSync(logFile, line + '\n');
      } catch {
        /* logging must never throw */
      }
    }
  };
  return {
    debug: (m, ...e) => write('debug', m, e),
    info: (m, ...e) => write('info', m, e),
    warn: (m, ...e) => write('warn', m, e),
    error: (m, ...e) => write('error', m, e),
  };
}

// main/services/logging.ts

const levels = ['debug', 'info', 'warn', 'error', 'critical'] as const
type LogLevel = typeof levels[number]

interface LoggerConfig {
    enabled: boolean
    level: LogLevel
    write_output: boolean
    output_size: number
}

const config: LoggerConfig = {
    enabled: false,
    level: 'debug',
    write_output: false,
    output_size: 3000,
}

export function configureLogging(newConfig: Partial<LoggerConfig>) {
    Object.assign(config, newConfig)
}

const levelPriority: Record<LogLevel, number> = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40,
    critical: 50,
}

const colors: Record<LogLevel, string> = {
    debug: '\x1b[34m',    // blue
    info: '\x1b[32m',     // green
    warn: '\x1b[33m',     // yellow
    error: '\x1b[31m',    // red
    critical: '\x1b[41m', // red background
}
const reset = '\x1b[0m' // reset color

export function log(level: LogLevel, action: string, details?: unknown, context?: string) {
    if ((!config.enabled) || (levelPriority[level] < levelPriority[config.level])) return

    const timestamp = new Date().toISOString()
    const color = colors[level] || ''

    const message = `${color}[${timestamp}] [${level.toUpperCase()}] [${context ?? '-'}] ${action}`
    const detailsStr = details ? `\n${JSON.stringify(details, null, 2)}` : ''

    const logentry = {
        timestamp,
        level,
        context,
        action,
        details
    }

    console.log(message + detailsStr + reset)
}

export const logging = {
    debug(action: string, details?: unknown, context?: string) {
        log('debug', action, details, context)
    },
    info(action: string, details?: unknown, context?: string) {
        log('info', action, details, context)
    },
    warn(action: string, details?: unknown, context?: string) {
        log('warn', action, details, context)
    },
    error(action: string, details?: unknown, context?: string) {
        log('error', action, details, context)
    },
    critical(action: string, details?: unknown, context?: string) {
        log('critical', action, details, context)
    },
}

export function createLogger(context: string) {
    const scoped: Partial<typeof logging> = {}

    for (const level of Object.keys(logging) as LogLevel[]) {
        scoped[level] = (action: string, details?: unknown) =>
            logging[level](action, details, context)
    }

    return scoped as Omit<typeof logging, never>
}
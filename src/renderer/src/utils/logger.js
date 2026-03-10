// renderer/src/utils/logger.js
// Renderer-side logger — mirrors the createLogger interface from main/services/logging.ts
// Uses only the browser console; no IPC or Electron dependencies.
// Drop-in replaceable if logging strategy changes.

const levels = ['debug', 'info', 'warn', 'error', 'critical']

const levelPriority = { debug: 10, info: 20, warn: 30, error: 40, critical: 50 }

const consoleMethods = { debug: 'debug', info: 'info', warn: 'warn', error: 'error', critical: 'error' }

const colors = {
  debug:    'color:#5b9bd5',  // blue
  info:     'color:#6ab04c',  // green
  warn:     'color:#f9ca24',  // yellow
  error:    'color:#eb4d4b',  // red
  critical: 'color:#fff;background:#eb4d4b;padding:1px 4px;border-radius:2px',
}

let config = {
  enabled: false,
  level: 'debug',
}

export function configureRendererLogging(newConfig) {
  config = { ...config, ...newConfig }
}

function log(level, action, details, context) {
  if (!config.enabled || levelPriority[level] < levelPriority[config.level]) return

  const timestamp = new Date().toISOString()
  const label = `[${timestamp}] [${level.toUpperCase()}] [${context ?? '-'}] ${action}`
  const method = consoleMethods[level]

  if (details !== undefined) {
    console[method]('%c' + label, colors[level], details)
  } else {
    console[method]('%c' + label, colors[level])
  }
}

export function createLogger(context) {
  return {
    debug:    (action, details) => log('debug',    action, details, context),
    info:     (action, details) => log('info',     action, details, context),
    warn:     (action, details) => log('warn',     action, details, context),
    error:    (action, details) => log('error',    action, details, context),
    critical: (action, details) => log('critical', action, details, context),
  }
}
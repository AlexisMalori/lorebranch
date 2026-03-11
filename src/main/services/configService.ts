// main/services/configService.ts
// Handles primary app configuration set

import path from 'path'
import { app } from 'electron'
import { configureLogging } from './logging'

// Types

export interface AppPaths {
  userData: string
  database: string
  images:   string
  logs:     string
}

export interface AppConfig {
  isDev:      boolean
  appName:    string
  appVersion: string
  paths:      AppPaths
}

// Internal state 

let _config: AppConfig | null = null

function requireInit(): AppConfig {
  if (!_config) throw new Error('configService.init() has not been called')
  return _config
}

// Logging defaults

const LOGGING_DEV = {
  enabled:      true,
  level:        'debug' as const,
  write_output: false,
  output_size:  3000,
}

const LOGGING_PROD = {
  enabled:      false,
  level:        'warn' as const,
  write_output: false,
  output_size:  1000,
}

// API

export const configService = {
  /**
   * Must be called once inside the Electron `app.whenReady()` handler,
   * before any other main-process service is initialised.
   */
  init(): AppConfig {
    if (_config) return _config

    const isDev      = !app.isPackaged
    const appName    = app.getName()
    const appVersion = app.getVersion()
    const userData   = app.getPath('userData')

    const paths: AppPaths = {
      userData,
      database: path.join(userData, 'app.db'),
      images:   path.join(userData, 'images'),
      logs:     path.join(userData, 'logs'),
    }

    // Bootstrap logging first so every subsequent service can use it
    configureLogging(isDev ? LOGGING_DEV : LOGGING_PROD)

    _config = { isDev, appName, appVersion, paths }
    return _config
  },

  // Resolved paths
  get paths(): AppPaths {
    return requireInit().paths
  },

  // Config snapshot
  get config(): AppConfig {
    return requireInit()
  },

  // Whether the app is in DEV or PROD mode
  get isDev(): boolean {
    return requireInit().isDev
  },

  // For testing only
  _reset() {
    _config = null
  },
}
// URL validation utility
export function isValidUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    return ['http:', 'https:'].includes(urlObj.protocol);
  } catch {
    return false;
  }
}

// URL sanitization utility
export function sanitizeUrl(url: string): string {
  if (!url) return '';
  
  try {
    const urlObj = new URL(url);
    // Remove potentially dangerous parts
    urlObj.hash = '';
    urlObj.username = '';
    urlObj.password = '';
    return urlObj.toString();
  } catch {
    return '';
  }
}

// Safe fetch with timeout and validation
export async function safeFetch(url: string, options: RequestInit = {}, timeout: number = 30000): Promise<Response> {
  if (!isValidUrl(url)) {
    throw new Error(`Invalid URL: ${url}`);
  }

  const sanitizedUrl = sanitizeUrl(url);
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(sanitizedUrl, {
      ...options,
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Error handling utility
export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode?: number;

  constructor(message: string, code: string = 'UNKNOWN_ERROR', statusCode?: number) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

// Logger utility to replace console logging
export class Logger {
  private static log(level: 'info' | 'warn' | 'error', message: string, data?: any) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      ...(data && { data })
    };

    if (process.env.NODE_ENV === 'development') {
      // In development, still use console for debugging
      switch (level) {
        case 'info':
          console.info(`[${timestamp}] INFO:`, message, data);
          break;
        case 'warn':
          console.warn(`[${timestamp}] WARN:`, message, data);
          break;
        case 'error':
          console.error(`[${timestamp}] ERROR:`, message, data);
          break;
      }
    } else {
      // In production, you might want to send logs to a service
      // For now, we'll still use console but with structured format
      console.log(JSON.stringify(logEntry));
    }
  }

  static info(message: string, data?: any) {
    this.log('info', message, data);
  }

  static warn(message: string, data?: any) {
    this.log('warn', message, data);
  }

  static error(message: string, data?: any) {
    this.log('error', message, data);
  }
}

// Centralized error handler
export function handleError(error: any, context?: string): AppError {
  if (error instanceof AppError) {
    Logger.error(`${context ? `[${context}] ` : ''}${error.message}`, { code: error.code });
    return error;
  }

  if (error instanceof Error) {
    const appError = new AppError(error.message, 'UNKNOWN_ERROR');
    Logger.error(`${context ? `[${context}] ` : ''}${error.message}`, { 
      name: error.name, 
      stack: error.stack 
    });
    return appError;
  }

  const appError = new AppError(String(error), 'UNKNOWN_ERROR');
  Logger.error(`${context ? `[${context}] ` : ''}Unknown error: ${error}`);
  return appError;
}

interface ErrorLog {
  timestamp: string;
  error: Error;
  componentName?: string;
  additionalInfo?: Record<string, any>;
}

class ErrorLogger {
  private static logs: ErrorLog[] = [];
  private static maxLogs = 100;

  static logError(error: Error, componentName?: string, additionalInfo?: Record<string, any>) {
    const errorLog: ErrorLog = {
      timestamp: new Date().toISOString(),
      error,
      componentName,
      additionalInfo
    };

    console.error('Error logged:', {
      message: error.message,
      stack: error.stack,
      componentName,
      additionalInfo
    });

    this.logs.unshift(errorLog);
    if (this.logs.length > this.maxLogs) {
      this.logs.pop();
    }

    // Save to localStorage for persistence
    try {
      localStorage.setItem('error_logs', JSON.stringify(this.logs));
    } catch (e) {
      console.error('Failed to save error logs to localStorage:', e);
    }
  }

  static getLogs(): ErrorLog[] {
    return this.logs;
  }

  static clearLogs() {
    this.logs = [];
    try {
      localStorage.removeItem('error_logs');
    } catch (e) {
      console.error('Failed to clear error logs from localStorage:', e);
    }
  }

  static loadLogsFromStorage() {
    try {
      const storedLogs = localStorage.getItem('error_logs');
      if (storedLogs) {
        this.logs = JSON.parse(storedLogs);
      }
    } catch (e) {
      console.error('Failed to load error logs from localStorage:', e);
    }
  }
}

// Load logs from storage when the module is imported
ErrorLogger.loadLogsFromStorage();

export default ErrorLogger; 
import { createApp } from "vue";
import App from "./App.vue";
import "./assets/main.css";
import "./styles/globals.css";
import ErrorLogger from "./utils/errorLogger";

// Global error handler
window.onerror = (message, source, lineno, colno, error) => {
  ErrorLogger.logError(
    error || new Error(String(message)),
    'Global',
    { source, lineno, colno }
  );
};

// Handle unhandled promise rejections
window.onunhandledrejection = (event) => {
  ErrorLogger.logError(
    event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
    'UnhandledPromise'
  );
};

const app = createApp(App);

// Global error handler for Vue
app.config.errorHandler = (error, instance, info) => {
  ErrorLogger.logError(
    error instanceof Error ? error : new Error(String(error)),
    'Vue',
    { componentInfo: info }
  );
};

// Add debug info to window for easy access
if (process.env.NODE_ENV === 'development') {
  (window as any).__DEBUG__ = {
    ErrorLogger,
    app
  };
}

app.mount("#app");

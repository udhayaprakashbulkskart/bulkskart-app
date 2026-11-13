import * as Sentry from "@sentry/react";
import { createRoot } from "react-dom/client";
import { useEffect } from "react";
import App from "./App.tsx";
import { AppWrapper } from "./components/common/PageMeta.tsx";
import { installChunkRecovery, isChunkLoadError, reloadForStaleChunk } from "./lib/chunkRecovery";
import "./index.css";

Sentry.init({
  dsn: import.meta.env['VITE_SENTRY_DSN'] as string | undefined,
  environment: import.meta.env.MODE,
});

installChunkRecovery();

function RootErrorFallback({ error, resetError }: { error?: unknown; resetError?: () => void }) {
  const errorMessage = error instanceof Error ? error.message : typeof error === 'string' ? error : undefined;
  const chunkError = isChunkLoadError(error);

  useEffect(() => {
    if (chunkError) {
      reloadForStaleChunk('error-boundary');
    }
  }, [chunkError]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-6">
      <div className="max-w-md w-full bg-card border border-border rounded-xl p-8 text-center shadow-lg space-y-5">
        <div className="w-16 h-16 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center font-bold text-2xl">
          !
        </div>
        <div className="space-y-2">
          <h1 className="text-xl font-bold tracking-tight">
            {chunkError ? 'Updating BulkSkart…' : 'Something went wrong'}
          </h1>
          <p className="text-sm text-muted-foreground">
            {chunkError
              ? 'A newer version was deployed. Reloading to get the latest files…'
              : 'We encountered an unexpected error while loading the page. Please try refreshing or return to the homepage.'}
          </p>
          {errorMessage && !chunkError && (
            <p className="text-xs text-muted-foreground/80 font-mono bg-muted p-2 rounded text-left overflow-x-auto max-h-24">
              {errorMessage}
            </p>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
          <button
            type="button"
            onClick={() => {
              if (resetError) resetError();
              if (chunkError) {
                reloadForStaleChunk('manual-refresh');
              } else {
                window.location.reload();
              }
            }}
            className="px-4 py-2 bg-[#C94400] text-primary-foreground font-medium rounded-lg text-sm hover:opacity-90 transition"
          >
            Refresh Page
          </button>
          <a
            href="/"
            className="px-4 py-2 border border-border bg-card hover:bg-muted text-foreground font-medium rounded-lg text-sm transition"
          >
            Back to Home
          </a>
        </div>
      </div>
    </div>
  );
}

try {
  const rootElement = document.getElementById("root");
  if (!rootElement) {
    throw new Error("Target container '#root' was not found in the DOM.");
  }

  const root = createRoot(rootElement);
  root.render(
    <Sentry.ErrorBoundary fallback={(fallbackProps) => <RootErrorFallback error={fallbackProps.error} resetError={fallbackProps.resetError} />}>
      <AppWrapper>
        <App />
      </AppWrapper>
    </Sentry.ErrorBoundary>
  );
} catch (initializationError) {
  console.error('[Root Mount Error]:', initializationError);
  const rootElement = document.getElementById("root");
  if (rootElement) {
    const errorMsg = initializationError instanceof Error ? initializationError.message : String(initializationError);
    rootElement.innerHTML = `
      <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #0f172a; color: #f8fafc; font-family: system-ui, -apple-system, sans-serif; padding: 24px;">
        <div style="max-width: 420px; width: 100%; background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 32px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.3);">
          <div style="width: 56px; height: 56px; border-radius: 50%; background: rgba(59, 130, 246, 0.15); color: #60a5fa; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 24px;">!</div>
          <h1 style="font-size: 20px; font-weight: 700; margin-bottom: 8px;">BulkSkart Loading Alert</h1>
          <p style="font-size: 14px; color: #94a3b8; margin-bottom: 16px;">We encountered an unexpected issue while loading the application. Please refresh to continue.</p>
          <pre style="font-size: 11px; color: #ef4444; background: #0f172a; padding: 10px; border-radius: 6px; text-align: left; overflow-x: auto; margin-bottom: 20px;">${errorMsg}</pre>
          <button onclick="window.location.reload()" style="background: #2563eb; color: #ffffff; border: none; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: background 0.2s;">Refresh Page</button>
        </div>
      </div>
    `;
  }
}

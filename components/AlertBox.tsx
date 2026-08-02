'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

type AlertType = 'error' | 'success' | 'warning' | 'info';

export interface AlertOptions {
  type?: AlertType;
  detail?: string;
}

interface AlertState {
  message: string | null;
  type: AlertType;
  detail: string | null;
  visible: boolean;
}

interface AlertContextType {
  showAlert: (message: string, opts?: AlertType | AlertOptions) => void;
  clearAlert: () => void;
}

const AlertContext = createContext<AlertContextType | null>(null);

export function useAlert() {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert must be used within an AlertProvider');
  }
  return context;
}

interface AlertProviderProps {
  children: ReactNode;
}

const icons: Record<AlertType, string> = {
  error: '✕',
  success: '✓',
  warning: '⚠',
  info: 'ℹ',
};

export function AlertProvider({ children }: AlertProviderProps) {
  const [alert, setAlert] = useState<AlertState>({ message: null, type: 'error', detail: null, visible: false });
  const [copied, setCopied] = useState(false);

  const showAlert = useCallback((message: string, opts?: AlertType | AlertOptions) => {
    const resolved: AlertOptions = typeof opts === 'string' ? { type: opts } : (opts ?? {});
    setAlert({
      message,
      type: resolved.type ?? 'error',
      detail: resolved.detail?.trim() ? resolved.detail : null,
      visible: true,
    });
    setCopied(false);
  }, []);

  const clearAlert = useCallback(() => {
    setAlert(prev => ({ ...prev, visible: false }));
    setTimeout(() => setAlert({ message: null, type: 'error', detail: null, visible: false }), 300);
  }, []);

  const handleCopy = useCallback(async () => {
    if (!alert.detail) return;
    try {
      await navigator.clipboard.writeText(alert.detail);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error('Copy failed', err);
    }
  }, [alert.detail]);

  const accentColors: Record<AlertType, string> = {
    error: 'border-l-destructive',
    success: 'border-l-success',
    warning: 'border-l-warning',
    info: 'border-l-info',
  };

  const iconColors: Record<AlertType, string> = {
    error: 'text-destructive',
    success: 'text-success',
    warning: 'text-warning',
    info: 'text-info',
  };

  const widthClass = alert.detail ? 'max-w-xl' : 'max-w-sm';

  return (
    <AlertContext.Provider value={{ showAlert, clearAlert }}>
      {alert.message && (
        <div
          className={`fixed top-4 right-4 z-50 ${widthClass} w-full transition-all duration-300 ease-out ${
            alert.visible
              ? 'translate-x-0 opacity-100'
              : 'translate-x-4 opacity-0'
          }`}
        >
          <div
            className={`flex max-h-[80vh] flex-col gap-2 overflow-auto rounded-lg border border-border border-l-[3px] ${accentColors[alert.type]} bg-elevated px-3.5 py-3 shadow-2xl`}
            role={alert.type === 'error' ? 'alert' : 'status'}
          >
            <div className="flex items-start gap-2.5">
              <span className={`text-sm mt-0.5 shrink-0 ${iconColors[alert.type]}`}>{icons[alert.type]}</span>
              <p className="flex-1 text-sm text-foreground leading-snug whitespace-pre-wrap break-words">{alert.message}</p>
              <button
                onClick={clearAlert}
                className="shrink-0 text-muted-foreground hover:text-foreground transition-colors text-xs mt-0.5"
                aria-label="Close alert"
              >
                ✕
              </button>
            </div>
            {alert.detail && (
              <details className="ml-6 group">
                <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground select-none">
                  Details
                </summary>
                <div className="mt-1.5 flex flex-col gap-1.5">
                  <pre className="text-xs text-muted-foreground bg-muted rounded p-2 max-h-60 overflow-auto whitespace-pre-wrap break-words font-mono">
                    {alert.detail}
                  </pre>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="self-start text-xs text-muted-foreground hover:text-foreground border border-border rounded px-2 py-0.5"
                  >
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </details>
            )}
          </div>
        </div>
      )}
      {children}
    </AlertContext.Provider>
  );
}

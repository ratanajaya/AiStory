'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

type AlertType = 'error' | 'success' | 'warning' | 'info';

interface AlertState {
  message: string | null;
  type: AlertType;
  visible: boolean;
}

interface AlertContextType {
  showAlert: (message: string, type?: AlertType) => void;
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
  const [alert, setAlert] = useState<AlertState>({ message: null, type: 'error', visible: false });

  const showAlert = useCallback((message: string, type: AlertType = 'error') => {
    setAlert({ message, type, visible: true });
  }, []);

  const clearAlert = useCallback(() => {
    setAlert(prev => ({ ...prev, visible: false }));
    setTimeout(() => setAlert({ message: null, type: 'error', visible: false }), 300);
  }, []);

  const accentColors: Record<AlertType, string> = {
    error: 'border-l-red-500',
    success: 'border-l-emerald-500',
    warning: 'border-l-amber-500',
    info: 'border-l-sky-500',
  };

  const iconColors: Record<AlertType, string> = {
    error: 'text-red-400',
    success: 'text-emerald-400',
    warning: 'text-amber-400',
    info: 'text-sky-400',
  };

  return (
    <AlertContext.Provider value={{ showAlert, clearAlert }}>
      {alert.message && (
        <div
          className={`fixed top-4 right-4 z-50 max-w-sm w-full transition-all duration-300 ease-out ${
            alert.visible
              ? 'translate-x-0 opacity-100'
              : 'translate-x-4 opacity-0'
          }`}
        >
          <div
            className={`flex items-start gap-2.5 rounded-md border border-border border-l-[3px] ${accentColors[alert.type]} bg-card px-3.5 py-3 shadow-lg`}
          >
            <span className={`text-sm mt-0.5 shrink-0 ${iconColors[alert.type]}`}>{icons[alert.type]}</span>
            <p className="flex-1 text-sm text-foreground leading-snug">{alert.message}</p>
            <button
              onClick={clearAlert}
              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors text-xs mt-0.5"
              aria-label="Close alert"
            >
              ✕
            </button>
          </div>
        </div>
      )}
      {children}
    </AlertContext.Provider>
  );
}

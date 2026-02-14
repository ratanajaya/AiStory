'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

type AlertType = 'error' | 'success' | 'warning' | 'info';

interface AlertState {
  message: string | null;
  type: AlertType;
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

export function AlertProvider({ children }: AlertProviderProps) {
  const [alert, setAlert] = useState<AlertState>({ message: null, type: 'error' });

  const showAlert = useCallback((message: string, type: AlertType = 'error') => {
    setAlert({ message, type });
  }, []);

  const clearAlert = useCallback(() => {
    setAlert({ message: null, type: 'error' });
  }, []);

  const alertStyles: Record<AlertType, string> = {
    error: 'bg-red-900/80 border-red-700 text-red-100',
    success: 'bg-green-900/80 border-green-700 text-green-100',
    warning: 'bg-yellow-900/80 border-yellow-700 text-yellow-100',
    info: 'bg-blue-900/80 border-blue-700 text-blue-100',
  };

  return (
    <AlertContext.Provider value={{ showAlert, clearAlert }}>
      {alert.message && (
        <div className={`fixed top-0 left-0 right-0 z-20 p-4 border-b ${alertStyles[alert.type]}`}>
          <div className="max-w-4xl mx-auto flex justify-between items-center">
            <span>{alert.message}</span>
            <button
              onClick={clearAlert}
              className="ml-4 px-2 py-1 hover:opacity-80 transition-opacity"
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

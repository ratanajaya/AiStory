'use client';

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import _ls from '@/utils/_ls';

export interface UiState {
  sidebarOpen: boolean;
  bookAudioHidden: boolean;
  debugPanelOpen: boolean;
}

const defaultUiState: UiState = {
  sidebarOpen: false,
  bookAudioHidden: false,
  debugPanelOpen: false,
};

interface UiStateContextType {
  uiState: UiState;
  setSidebarOpen: (open: boolean) => void;
  setBookAudioHidden: (hidden: boolean) => void;
  setDebugPanelOpen: (open: boolean) => void;
}

const UiStateContext = createContext<UiStateContextType | null>(null);

export function useUiState() {
  const context = useContext(UiStateContext);

  if (!context) {
    throw new Error('useUiState must be used within a UiStateProvider');
  }

  return context;
}

export function UiStateProvider({ children }: { children: ReactNode }) {
  const [uiState, setUiState] = useState<UiState>(defaultUiState);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const savedUiState = _ls.load<Partial<UiState>>(_ls.keys.uiState);

    if (savedUiState && typeof savedUiState === 'object') {
      setUiState((prev) => ({
        ...prev,
        ...savedUiState,
      }));
    }

    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) {
      return;
    }

    _ls.set(_ls.keys.uiState, uiState);
  }, [loaded, uiState]);

  const value = useMemo<UiStateContextType>(() => ({
    uiState,
    setSidebarOpen: (open) => {
      setUiState((prev) => ({
        ...prev,
        sidebarOpen: open,
      }));
    },
    setBookAudioHidden: (hidden) => {
      setUiState((prev) => ({
        ...prev,
        bookAudioHidden: hidden,
      }));
    },
    setDebugPanelOpen: (open) => {
      setUiState((prev) => ({
        ...prev,
        debugPanelOpen: open,
      }));
    },
  }), [uiState]);

  return (
    <UiStateContext.Provider value={value}>
      {children}
    </UiStateContext.Provider>
  );
}
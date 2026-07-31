const cache: Record<string, unknown> = {};

const canUseLocalStorage = () => {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
};

const hasCachedValue = (key: string) => {
  return Object.prototype.hasOwnProperty.call(cache, key);
};

const keys = {
  uiState: "ai-story:ui-state",
  aiApiLogs: "ai-story:ai-api-logs",
};

const _ls = {
  keys,
  getAllKeys: () => {
    if (!canUseLocalStorage()) {
      return [];
    }

    return Object.keys(window.localStorage);
  },

  load: <T>(key: string) => {
    if (!canUseLocalStorage()) {
      return undefined;
    }

    try {
      const serializedValue = window.localStorage.getItem(key);
      if (serializedValue === null) {
        return undefined;
      }

      return JSON.parse(serializedValue) as T;
    } catch {
      return undefined;
    }
  },

  loadWithCache: <T>(key: string) => {
    if (hasCachedValue(key)) {
      return cache[key] as T | undefined;
    }

    const value = _ls.load<T>(key);
    cache[key] = value;

    return value;
  },

  remove: (key: string) => {
    delete cache[key];

    if (!canUseLocalStorage()) {
      return;
    }

    window.localStorage.removeItem(key);
  },
  
  set: (key: string, value: any) => {
    delete cache[key];

    if (!canUseLocalStorage()) {
      return;
    }

    const serializedValue = JSON.stringify(value);
    window.localStorage.setItem(key, serializedValue);
  },

  clear: () => {
    Object.keys(cache).forEach((key) => {
      delete cache[key];
    });

    if (!canUseLocalStorage()) {
      return;
    }

    window.localStorage.clear();
  }
}

export default _ls;

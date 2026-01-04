const cache = {};

const _ls = {
  getAllKeys: () => {
    return Object.keys(localStorage);
  },

  load: <T>(key: string) => {
    try {
      const serializedValue = localStorage.getItem(key);
      if (serializedValue === null) {
        return undefined;
      }
      return JSON.parse(serializedValue) as T;
    } catch (err) {
      return undefined;
    }
  },

  loadWithCache: <T>(key: string) => {
    const keyIdx = key as keyof typeof cache;
    if(cache[keyIdx])
      return cache[keyIdx];

    //@ts-ignore
    cache[keyIdx] = _ls.load<T>(key);

    return cache[keyIdx];
  },
  remove: (key: string) => {
    localStorage.removeItem(key);
  },
  
  set: (key: string, value: any) => {
    const serializedValue = JSON.stringify(value);
    localStorage.setItem(key, serializedValue);

    const keyIdx = key as keyof typeof cache;
    //@ts-ignore
    cache[keyIdx] = null;
  },

  clear: () => {
    localStorage.clear();
  }
}

export default _ls;
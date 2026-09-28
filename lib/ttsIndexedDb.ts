

const DB_NAME = 'ai-story-tts';
const DB_VERSION = 2;
const STORE_NAME = 'segment-audio';
const CHUNK_STORE = 'chunk-audio';

export type AudioPlaybackState = 'idle' | 'loading' | 'waiting' | 'playing' | 'paused' | 'error';

export interface AudioPlaybackStatus {
  chunkKey?: string;
  partIndex?: number;
  partCount?: number;
  activeSegmentId: string | null;
  state: AudioPlaybackState;
  currentTime: number;
  duration: number;
  errorMessage: string | null;
}

export interface SegmentAudioRecord {
  segmentId: string;
  content: string;
  mimeType: string;
  configId: string;
  audioBlob: Blob;
  updatedAt: number;
}

export interface ChunkAudioRecord extends SegmentAudioRecord {
  cacheKey: string;
  chunkVersion: string;
}

let openDbPromise: Promise<IDBDatabase> | null = null;
let sharedAudio: HTMLAudioElement | null = null;
let currentAudioUrl: string | null = null;
const initializedAudio = new WeakSet<HTMLAudioElement>();
let preparedAudio: { key: string; audio: HTMLAudioElement; url: string } | null = null;
let playbackStatus: AudioPlaybackStatus = {
  activeSegmentId: null,
  state: 'idle',
  currentTime: 0,
  duration: 0,
  errorMessage: null,
};

const playbackListeners = new Set<(status: AudioPlaybackStatus) => void>();

const ensureBrowserSupport = () => {
  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
    throw new Error('Audio cache is only available in the browser');
  }
};

const getDb = (): Promise<IDBDatabase> => {
  ensureBrowserSupport();

  if (!openDbPromise) {
    openDbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error ?? new Error('Failed to open IndexedDB'));
      request.onblocked = () => reject(new Error('Close other AiStory tabs to upgrade the audio cache.'));
      request.onupgradeneeded = () => {
        const db = request.result;

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'segmentId' });
        }
        if (!db.objectStoreNames.contains(CHUNK_STORE)) {
          db.createObjectStore(CHUNK_STORE, { keyPath: 'cacheKey' }).createIndex('segmentId', 'segmentId');
        }
      };
      request.onsuccess = () => {
        request.result.onversionchange = () => { request.result.close(); openDbPromise = null; };
        resolve(request.result);
      };
    });
  }

  return openDbPromise;
};

const notifyPlaybackListeners = () => {
  const snapshot = { ...playbackStatus };

  playbackListeners.forEach(listener => {
    listener(snapshot);
  });
};

const getSafeTimeValue = (value: number) => Number.isFinite(value) ? value : 0;

const getAudioTiming = (audio: HTMLAudioElement) => ({
  currentTime: getSafeTimeValue(audio.currentTime),
  duration: getSafeTimeValue(audio.duration),
});

const getAudioErrorMessage = (audio: HTMLAudioElement) => {
  if (!audio.error) {
    return 'Audio playback failed.';
  }

  switch (audio.error.code) {
    case MediaError.MEDIA_ERR_ABORTED:
      return 'Audio playback was aborted.';
    case MediaError.MEDIA_ERR_NETWORK:
      return 'A network error interrupted audio playback.';
    case MediaError.MEDIA_ERR_DECODE:
      return 'The audio could not be decoded.';
    case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
      return 'The audio format is not supported.';
    default:
      return 'Audio playback failed.';
  }
};

const updatePlaybackStatus = (updates: Partial<AudioPlaybackStatus>) => {
  playbackStatus = {
    ...playbackStatus,
    ...updates,
  };
  notifyPlaybackListeners();
};

const clearCurrentAudioUrl = () => {
  if (!currentAudioUrl) {
    return;
  }

  URL.revokeObjectURL(currentAudioUrl);
  currentAudioUrl = null;
};

const resetAudioElement = (audio: HTMLAudioElement) => {
  audio.removeAttribute('src');
  audio.load();
};

const runTransaction = async <T>(
  mode: IDBTransactionMode,
  executor: (store: IDBObjectStore, resolve: (value: T) => void, reject: (reason?: unknown) => void) => void,
  storeName = STORE_NAME,
  signal?: AbortSignal,
): Promise<T> => {
  const db = await getDb();
  signal?.throwIfAborted();

  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    let value: T;
    const abort = () => transaction.abort();
    const cleanup = () => signal?.removeEventListener('abort', abort);
    signal?.addEventListener('abort', abort, { once: true });
    transaction.oncomplete = () => { cleanup(); resolve(value); };
    transaction.onabort = transaction.onerror = () => {
      cleanup(); reject(signal?.aborted ? signal.reason : transaction.error ?? new Error('IndexedDB transaction failed'));
    };
    executor(store, result => { value = result; }, reject);
  });
};

export const getSegmentAudio = async (segmentId: string): Promise<SegmentAudioRecord | null> => {
  return runTransaction<SegmentAudioRecord | null>('readonly', (store, resolve, reject) => {
    const request = store.get(segmentId);

    request.onerror = () => reject(request.error ?? new Error('Failed to read cached audio'));
    request.onsuccess = () => resolve((request.result as SegmentAudioRecord | undefined) ?? null);
  });
};

export const isSegmentAudioRecordCurrent = (
  record: SegmentAudioRecord | null,
  content: string,
  configId: string,
): record is SegmentAudioRecord => {
  return !!record
    && record.content === content
    && record.configId === configId;
};

export const saveSegmentAudio = async (record: SegmentAudioRecord): Promise<void> => {
  return runTransaction<void>('readwrite', (store, resolve, reject) => {
    const request = store.put(record);

    request.onerror = () => reject(request.error ?? new Error('Failed to save cached audio'));
    request.onsuccess = () => resolve();
  });
};

export const deleteSegmentAudio = async (segmentId: string): Promise<void> => {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME, CHUNK_STORE], 'readwrite');
    transaction.oncomplete = () => resolve();
    transaction.onabort = transaction.onerror = () => reject(transaction.error ?? new Error('Failed to delete cached audio'));
    transaction.objectStore(STORE_NAME).delete(segmentId);
    const cursor = transaction.objectStore(CHUNK_STORE).index('segmentId').openCursor(IDBKeyRange.only(segmentId));
    cursor.onsuccess = () => { if (cursor.result) { cursor.result.delete(); cursor.result.continue(); } };
  });
};

export const getChunkAudio = (cacheKey: string): Promise<ChunkAudioRecord | null> =>
  runTransaction('readonly', (store, resolve, reject) => {
    const request = store.get(cacheKey);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  }, CHUNK_STORE);

export const saveChunkAudio = (record: ChunkAudioRecord, signal?: AbortSignal): Promise<void> =>
  runTransaction('readwrite', (store, resolve, reject) => {
    const request = store.put(record);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  }, CHUNK_STORE, signal);

const getSharedAudio = () => {
  ensureBrowserSupport();

  if (!sharedAudio) {
    sharedAudio = new Audio();
  }

  const audio = sharedAudio;

  if (!initializedAudio.has(audio)) {
    audio.addEventListener('loadedmetadata', () => {
      if (audio !== sharedAudio) return;
      updatePlaybackStatus({
        ...getAudioTiming(audio),
        errorMessage: null,
      });
    });

    audio.addEventListener('durationchange', () => {
      if (audio !== sharedAudio) return;
      updatePlaybackStatus(getAudioTiming(audio));
    });

    audio.addEventListener('timeupdate', () => {
      if (audio !== sharedAudio) return;
      updatePlaybackStatus(getAudioTiming(audio));
    });

    audio.addEventListener('waiting', () => {
      if (audio !== sharedAudio) return;
      if (!playbackStatus.activeSegmentId) {
        return;
      }

      updatePlaybackStatus({
        ...getAudioTiming(audio),
        state: 'waiting',
        errorMessage: null,
      });
    });

    audio.addEventListener('playing', () => {
      if (audio !== sharedAudio) return;
      if (!playbackStatus.activeSegmentId) {
        return;
      }

      updatePlaybackStatus({
        ...getAudioTiming(audio),
        state: 'playing',
        errorMessage: null,
      });
    });

    audio.addEventListener('pause', () => {
      if (audio !== sharedAudio) return;
      if (!playbackStatus.activeSegmentId || audio.ended) {
        return;
      }

      updatePlaybackStatus({
        ...getAudioTiming(audio),
        state: 'paused',
      });
    });

    audio.addEventListener('error', () => {
      if (audio !== sharedAudio) return;
      if (!playbackStatus.activeSegmentId) {
        return;
      }

      updatePlaybackStatus({
        ...getAudioTiming(audio),
        state: 'error',
        errorMessage: getAudioErrorMessage(audio),
      });
    });

    audio.addEventListener('ended', () => {
      if (audio !== sharedAudio) return;
      clearCurrentAudioUrl();
      playbackStatus = {
        activeSegmentId: null,
        state: 'idle',
        currentTime: 0,
        duration: 0,
        errorMessage: null,
      };
      resetAudioElement(audio);
      notifyPlaybackListeners();
    });

    initializedAudio.add(audio);
  }

  return audio;
};

export const subscribeToAudioPlayback = (listener: (status: AudioPlaybackStatus) => void) => {
  playbackListeners.add(listener);
  listener({ ...playbackStatus });

  return () => {
    playbackListeners.delete(listener);
  };
};

export const clearPreloadedAudio = () => {
  if (!preparedAudio) return;
  resetAudioElement(preparedAudio.audio);
  URL.revokeObjectURL(preparedAudio.url);
  preparedAudio = null;
};

export const preloadAudioBlob = (key: string, blob: Blob) => {
  if (preparedAudio?.key === key) return;
  clearPreloadedAudio();
  const audio = new Audio();
  const url = URL.createObjectURL(blob);
  preparedAudio = { key, audio, url };
  audio.preload = 'auto'; audio.src = url; audio.load();
};

export const playAudioBlob = async (
  segmentId: string, audioBlob: Blob | undefined,
  part?: { chunkKey: string; partIndex: number; partCount: number },
): Promise<void> => {
  if(!audioBlob) {
    throw new Error('No audio data available to play.');
  }

  const previous = getSharedAudio();
  previous.pause();
  clearCurrentAudioUrl();
  const prepared = part && preparedAudio?.key === part.chunkKey ? preparedAudio : null;
  if (prepared) { sharedAudio = prepared.audio; preparedAudio = null; resetAudioElement(previous); }
  const audio = getSharedAudio();

  playbackStatus = {
    ...part,
    activeSegmentId: segmentId,
    state: 'loading',
    currentTime: 0,
    duration: 0,
    errorMessage: null,
  };
  notifyPlaybackListeners();
  currentAudioUrl = prepared?.url ?? URL.createObjectURL(audioBlob);
  if (!prepared) audio.src = currentAudioUrl;
  audio.currentTime = 0;

  const playbackUrl = currentAudioUrl;
  try {
    await audio.play();
  } catch (error) {
    if (currentAudioUrl !== playbackUrl) return;
    updatePlaybackStatus({
      state: 'error',
      errorMessage: error instanceof Error ? error.message : 'Audio playback failed.',
    });
    throw error;
  }
};

export const pauseAudioPlayback = (segmentId?: string): boolean => {
  const audio = getSharedAudio();

  if (!playbackStatus.activeSegmentId) {
    return false;
  }

  if (segmentId && playbackStatus.activeSegmentId !== segmentId) {
    return false;
  }

  if (audio.paused) {
    return false;
  }

  audio.pause();
  return true;
};

export const resumeAudioPlayback = async (segmentId?: string): Promise<boolean> => {
  const audio = getSharedAudio();

  if (!playbackStatus.activeSegmentId) {
    return false;
  }

  if (segmentId && playbackStatus.activeSegmentId !== segmentId) {
    return false;
  }

  if (!audio.paused || !audio.src) {
    return false;
  }

  updatePlaybackStatus({
    ...getAudioTiming(audio),
    state: 'loading',
    errorMessage: null,
  });

  const playbackUrl = currentAudioUrl;
  try {
    await audio.play();
  } catch (error) {
    if (currentAudioUrl !== playbackUrl) return false;
    updatePlaybackStatus({
      state: 'error',
      errorMessage: error instanceof Error ? error.message : 'Audio playback failed.',
    });
    throw error;
  }

  return true;
};

export const stopAudioPlayback = (segmentId?: string): boolean => {
  if (!sharedAudio) return false;
  const audio = getSharedAudio();

  if (!playbackStatus.activeSegmentId) {
    return false;
  }

  if (segmentId && playbackStatus.activeSegmentId !== segmentId) {
    return false;
  }

  playbackStatus = {
    activeSegmentId: null,
    state: 'idle',
    currentTime: 0,
    duration: 0,
    errorMessage: null,
  };

  audio.pause();
  audio.currentTime = 0;
  clearCurrentAudioUrl();
  resetAudioElement(audio);
  notifyPlaybackListeners();

  return true;
};
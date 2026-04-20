const DB_NAME = 'ai-story-tts';
const DB_VERSION = 1;
const STORE_NAME = 'segment-audio';

export type AudioPlaybackState = 'idle' | 'playing' | 'paused';

export interface AudioPlaybackStatus {
  activeSegmentId: string | null;
  state: AudioPlaybackState;
}

export interface SegmentAudioRecord {
  segmentId: string;
  content: string;
  mimeType: string;
  audioBlob: Blob;
  updatedAt: number;
}

let openDbPromise: Promise<IDBDatabase> | null = null;
let sharedAudio: HTMLAudioElement | null = null;
let currentAudioUrl: string | null = null;
let isAudioInitialized = false;
let playbackStatus: AudioPlaybackStatus = {
  activeSegmentId: null,
  state: 'idle',
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
      request.onupgradeneeded = () => {
        const db = request.result;

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'segmentId' });
        }
      };
      request.onsuccess = () => resolve(request.result);
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
): Promise<T> => {
  const db = await getDb();

  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);

    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'));

    executor(store, resolve, reject);
  });
};

export const getSegmentAudio = async (segmentId: string): Promise<SegmentAudioRecord | null> => {
  return runTransaction<SegmentAudioRecord | null>('readonly', (store, resolve, reject) => {
    const request = store.get(segmentId);

    request.onerror = () => reject(request.error ?? new Error('Failed to read cached audio'));
    request.onsuccess = () => resolve((request.result as SegmentAudioRecord | undefined) ?? null);
  });
};

export const saveSegmentAudio = async (record: SegmentAudioRecord): Promise<void> => {
  return runTransaction<void>('readwrite', (store, resolve, reject) => {
    const request = store.put(record);

    request.onerror = () => reject(request.error ?? new Error('Failed to save cached audio'));
    request.onsuccess = () => resolve();
  });
};

export const deleteSegmentAudio = async (segmentId: string): Promise<void> => {
  return runTransaction<void>('readwrite', (store, resolve, reject) => {
    const request = store.delete(segmentId);

    request.onerror = () => reject(request.error ?? new Error('Failed to delete cached audio'));
    request.onsuccess = () => resolve();
  });
};

const getSharedAudio = () => {
  ensureBrowserSupport();

  if (!sharedAudio) {
    sharedAudio = new Audio();
  }

  if (!isAudioInitialized) {
    sharedAudio.addEventListener('play', () => {
      playbackStatus = {
        ...playbackStatus,
        state: 'playing',
      };
      notifyPlaybackListeners();
    });

    sharedAudio.addEventListener('pause', () => {
      playbackStatus = playbackStatus.activeSegmentId
        ? { ...playbackStatus, state: 'paused' }
        : { activeSegmentId: null, state: 'idle' };
      notifyPlaybackListeners();
    });

    sharedAudio.addEventListener('ended', () => {
      clearCurrentAudioUrl();
      playbackStatus = {
        activeSegmentId: null,
        state: 'idle',
      };
      resetAudioElement(sharedAudio!);
      notifyPlaybackListeners();
    });

    isAudioInitialized = true;
  }

  return sharedAudio;
};

export const subscribeToAudioPlayback = (listener: (status: AudioPlaybackStatus) => void) => {
  playbackListeners.add(listener);
  listener({ ...playbackStatus });

  return () => {
    playbackListeners.delete(listener);
  };
};

export const playAudioBlob = async (segmentId: string, audioBlob: Blob): Promise<void> => {
  const audio = getSharedAudio();

  audio.pause();
  clearCurrentAudioUrl();

  playbackStatus = {
    activeSegmentId: segmentId,
    state: 'paused',
  };
  notifyPlaybackListeners();
  currentAudioUrl = URL.createObjectURL(audioBlob);
  audio.src = currentAudioUrl;
  audio.currentTime = 0;

  await audio.play();
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

  await audio.play();
  return true;
};

export const stopAudioPlayback = (segmentId?: string): boolean => {
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
  };

  audio.pause();
  audio.currentTime = 0;
  clearCurrentAudioUrl();
  resetAudioElement(audio);
  notifyPlaybackListeners();

  return true;
};
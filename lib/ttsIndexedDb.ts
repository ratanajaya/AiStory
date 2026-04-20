import { TTS_CACHE_CONFIG_ID } from "@/lib/ttsConfig";

const DB_NAME = 'ai-story-tts';
const DB_VERSION = 1;
const STORE_NAME = 'segment-audio';

export type AudioPlaybackState = 'idle' | 'loading' | 'waiting' | 'playing' | 'paused' | 'error';

export interface AudioPlaybackStatus {
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

let openDbPromise: Promise<IDBDatabase> | null = null;
let sharedAudio: HTMLAudioElement | null = null;
let currentAudioUrl: string | null = null;
let isAudioInitialized = false;
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

export const isSegmentAudioRecordCurrent = (
  record: SegmentAudioRecord | null,
  content: string,
): record is SegmentAudioRecord => {
  return !!record
    && record.content === content
    && record.configId === TTS_CACHE_CONFIG_ID;
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

  const audio = sharedAudio;

  if (!isAudioInitialized) {
    audio.addEventListener('loadedmetadata', () => {
      updatePlaybackStatus({
        ...getAudioTiming(audio),
        errorMessage: null,
      });
    });

    audio.addEventListener('durationchange', () => {
      updatePlaybackStatus(getAudioTiming(audio));
    });

    audio.addEventListener('timeupdate', () => {
      updatePlaybackStatus(getAudioTiming(audio));
    });

    audio.addEventListener('waiting', () => {
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
      if (!playbackStatus.activeSegmentId || audio.ended) {
        return;
      }

      updatePlaybackStatus({
        ...getAudioTiming(audio),
        state: 'paused',
      });
    });

    audio.addEventListener('error', () => {
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

    isAudioInitialized = true;
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

export const playAudioBlob = async (segmentId: string, audioBlob: Blob | undefined): Promise<void> => {
  if(!audioBlob) {
    throw new Error('No audio data available to play.');
  }

  const audio = getSharedAudio();

  audio.pause();
  clearCurrentAudioUrl();

  playbackStatus = {
    activeSegmentId: segmentId,
    state: 'loading',
    currentTime: 0,
    duration: 0,
    errorMessage: null,
  };
  notifyPlaybackListeners();
  currentAudioUrl = URL.createObjectURL(audioBlob);
  audio.src = currentAudioUrl;
  audio.currentTime = 0;

  try {
    await audio.play();
  } catch (error) {
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

  try {
    await audio.play();
  } catch (error) {
    updatePlaybackStatus({
      state: 'error',
      errorMessage: error instanceof Error ? error.message : 'Audio playback failed.',
    });
    throw error;
  }

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
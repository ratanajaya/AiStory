import type { AiApiLogEntry, JsonLogValue } from '@/types';
import _ls from '@/utils/_ls';

export const AI_API_LOG_LIMIT = 100;
export const AI_API_LOG_RESPONSE_PREVIEW_LIMIT = 160;

type NewAiApiLogEntry = Omit<AiApiLogEntry, 'id' | 'createdAt'> & Partial<Pick<AiApiLogEntry, 'id' | 'createdAt'>>;

const listeners = new Set<(entries: AiApiLogEntry[]) => void>();

const isLogEntry = (value: unknown): value is AiApiLogEntry => {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<AiApiLogEntry>;
  return typeof entry.id === 'string'
    && typeof entry.createdAt === 'number'
    && (entry.kind === 'llm' || entry.kind === 'tts')
    && (entry.status === 'success' || entry.status === 'error')
    && typeof entry.feature === 'string'
    && typeof entry.durationMs === 'number'
    && entry.payload !== undefined;
};

export const loadAiApiLogs = (): AiApiLogEntry[] => {
  const saved = _ls.load<unknown>(_ls.keys.aiApiLogs);
  if (!Array.isArray(saved)) return [];

  return saved.filter(isLogEntry).sort((left, right) => right.createdAt - left.createdAt).slice(0, AI_API_LOG_LIMIT);
};

const notify = (entries: AiApiLogEntry[]) => {
  listeners.forEach((listener) => listener(entries));
};

const createId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export const appendAiApiLog = (entry: NewAiApiLogEntry): AiApiLogEntry => {
  const completedEntry: AiApiLogEntry = {
    ...entry,
    id: entry.id ?? createId(),
    createdAt: entry.createdAt ?? Date.now(),
  } as AiApiLogEntry;
  const entries = [completedEntry, ...loadAiApiLogs()].slice(0, AI_API_LOG_LIMIT);

  try {
    _ls.set(_ls.keys.aiApiLogs, entries);
    notify(entries);
  } catch (error) {
    console.error('Failed to save AI API log:', error);
  }

  return completedEntry;
};

export const clearAiApiLogs = () => {
  _ls.remove(_ls.keys.aiApiLogs);
  notify([]);
};

export const subscribeToAiApiLogs = (listener: (entries: AiApiLogEntry[]) => void) => {
  listeners.add(listener);
  listener(loadAiApiLogs());

  return () => {
    listeners.delete(listener);
  };
};

export const createLogError = (error: unknown): JsonLogValue => {
  if (error instanceof Error) {
    const details: Record<string, JsonLogValue> = {
      name: error.name,
      message: error.message,
    };
    const statusCode = (error as Error & { statusCode?: unknown }).statusCode;
    const envelope = (error as Error & { envelope?: unknown }).envelope;
    if (typeof statusCode === 'number') details.statusCode = statusCode;
    if (envelope && typeof envelope === 'object') details.envelope = envelope as JsonLogValue;
    return details;
  }

  return { message: typeof error === 'string' ? error : 'Unknown error' };
};

const normalizeResponseText = (value: string) => {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized || null;
};

export const getAiApiLogResponseText = (entry: AiApiLogEntry): string | null => {
  if (entry.status !== 'success' || entry.response === undefined) return null;

  if (typeof entry.response === 'string') return normalizeResponseText(entry.response);
  if (!entry.response || typeof entry.response !== 'object' || Array.isArray(entry.response)) return null;

  const content = entry.response.content;
  return typeof content === 'string' ? normalizeResponseText(content) : null;
};

export const getAiApiLogResponsePreview = (entry: AiApiLogEntry): string | null => {
  const text = getAiApiLogResponseText(entry);
  if (!text) return null;
  if (text.length <= AI_API_LOG_RESPONSE_PREVIEW_LIMIT) return text;

  return `${text.slice(0, AI_API_LOG_RESPONSE_PREVIEW_LIMIT - 1)}…`;
};

const toFilenamePart = (value: string) => {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return normalized || 'llm-call';
};

const toFilenameTimestamp = (timestamp: number) => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 'unknown-time';
  return date.toISOString().replace(/[:.]/g, '-');
};

export const createAiApiLogDownload = (entry: AiApiLogEntry) => {
  const record = {
    id: entry.id,
    createdAt: entry.createdAt,
    kind: entry.kind,
    status: entry.status,
    feature: entry.feature,
    bookId: entry.bookId,
    bookName: entry.bookName,
    httpStatus: entry.httpStatus,
    durationMs: entry.durationMs,
    payload: entry.payload,
    response: entry.response,
    error: entry.error,
  };

  return {
    filename: `ai-api-log-${toFilenamePart(entry.feature)}-${toFilenameTimestamp(entry.createdAt)}.json`,
    content: JSON.stringify(record, null, 2),
  };
};

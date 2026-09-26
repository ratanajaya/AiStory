export const GUEST_DAYS = 7;
export const TRIAL_LIMITS = { text: 20, audio: 10_000 } as const;
export const IP_LIMITS = { text: 60, audio: 30_000 } as const;
export const GUEST_STORAGE_LIMITS = { books: 10, templates: 10, uploads: 5 } as const;
export const REQUEST_LIMITS = { textBytes: 65_536, audioCharacters: 5_000, imageBytes: 5 * 1024 * 1024 } as const;

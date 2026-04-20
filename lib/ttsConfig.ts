export const TTS_SYNTHESIS_CONFIG = {
  model: 'hexgrad/Kokoro-82M',
  voice: 'af_nicole',
  //voice: 'af_heart',
  responseFormat: 'mp3',
  sampleRate: 48000,
  stream: false,
} as const;

export const TTS_CACHE_CONFIG_ID = [
  TTS_SYNTHESIS_CONFIG.model,
  TTS_SYNTHESIS_CONFIG.voice,
  TTS_SYNTHESIS_CONFIG.responseFormat,
  TTS_SYNTHESIS_CONFIG.sampleRate,
  TTS_SYNTHESIS_CONFIG.stream,
].join('|');
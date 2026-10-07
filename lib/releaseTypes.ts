import type { TtsConfig } from '@/types';
export interface ReleasedAudio { partIndex: number; objectKey: string; mimeType: string; byteSize: number }
export interface ReleasedSegment { id: string; content: string; expectedAudioParts: number; audio: ReleasedAudio[] }
export interface ReleasedBook { releaseId: string; sourceBookId: string; ownerEmail: string; title: string; releasedAt: string; revision: number; segments: ReleasedSegment[] }
export interface ReleaseAttemptResponse { attemptId: string; title: string; segments: ReleasedSegment[]; selectedTts: TtsConfig; replacing: boolean }
export interface ReleaseFileInput { segmentId: string; partIndex: number; whole: boolean; mimeType: string; byteSize: number }
export interface ReleaseFile extends ReleaseFileInput { objectKey: string }

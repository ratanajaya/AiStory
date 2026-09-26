import { KeyValue } from './../types/index';
import mongoose, { Schema } from 'mongoose';
import { StorySegment, SegmentSummary, Chapter, Template, Book, User, ApiKeyConfig, LlmConfig, LongTermMemoryState } from '@/types';

// Sub-schemas for Book components
const StorySegmentSchema = new Schema<StorySegment>({
  id: { type: String, required: true },
  day: { type: Number, required: true },
  role: { type: String, required: true },
  content: { type: String, required: true },
  excludeFromPrevStory: { type: Boolean },
  toSummarize: { type: Boolean },
  segmentSummaryId: { type: String },
  chapterId: { type: String },
  narrationModel: {
    type: new Schema<LlmConfig>({
      service: { type: String, enum: ['together', 'openAi'], required: true },
      model: { type: String, required: true },
    }, { _id: false }),
    default: undefined,
  },
}, { _id: false });

const SegmentSummarySchema = new Schema<SegmentSummary>({
  id: { type: String, required: true },
  content: { type: String, required: true }
}, { _id: false });

const ChapterSchema = new Schema<Chapter>({
  id: { type: String, required: true },
  title: { type: String, required: true },
  summary: { type: String, required: true }
}, { _id: false });

const LongTermMemorySchema = new Schema<LongTermMemoryState>({
  content: {
    schemaVersion: { type: Number, default: 1, required: true },
    entries: { type: Schema.Types.Mixed, default: () => ({}) },
  },
  revision: { type: Number, default: 0, required: true },
  checkpoint: {
    throughSegmentId: { type: String, default: null },
    fingerprint: { type: String, default: null },
  },
  updatedAt: { type: String, default: null },
}, { _id: false });

const TemplateSchema = new Schema<Template>({
  templateId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  promptBuilder: {
    narration1: { type: String, default: null },
    narration2: { type: String, default: null },
    narrationSystem: { type: String, default: null },
    enhancer: { type: String, default: null },
    enhancerSystem: { type: String, default: null },
    segmentSummarizer: { type: String, default: null },
    segmentSummarizerSystem: { type: String, default: null },
    chapterSummarizer: { type: String, default: null },
    chapterSummarizerSystem: { type: String, default: null },
    outlineIdeaGenerator: { type: String, default: null },
    outlineIdeaGeneratorSystem: { type: String, default: null }
  },
  storyBackground: { type: String, required: true },
  writingStyle: { type: String, required: true },
  imageUrl: { type: String, default: null },
  ownerEmail: { type: String },
  guestId: { type: String },
  expiresAt: { type: Date },
  isPublic: { type: Boolean, default: false }
}, {
  timestamps: true,
  toJSON: { virtuals: false },
  toObject: { virtuals: false }
});

TemplateSchema.index({ guestId: 1 });
TemplateSchema.index({ isPublic: 1, createdAt: -1 });

const BookSchema = new Schema<Book>({
  bookId: { type: String, required: true, unique: true },
  templateId: { type: String, required: true },
  name: { type: String, default: null },
  draftOutline: { type: String, default: '' },
  draftIdea: { type: String, default: '' },
  storySegments: [StorySegmentSchema],
  segmentSummaries: [SegmentSummarySchema],
  chapters: [ChapterSchema],
  longTermMemory: {
    type: LongTermMemorySchema,
    default: () => ({
      content: { schemaVersion: 1, entries: {} },
      revision: 0,
      checkpoint: { throughSegmentId: null, fingerprint: null },
      updatedAt: null,
    }),
  },
  ownerEmail: { type: String },
  guestId: { type: String },
  expiresAt: { type: Date }
}, {
  timestamps: true,
  toJSON: { virtuals: false },
  toObject: { virtuals: false }
});

BookSchema.index({ guestId: 1 });

const KeyValueSchema = new Schema<KeyValue>({
  key: { type: String, required: true, unique: true },
  value: { type: Schema.Types.Mixed }
}, {
  timestamps: true,
  toJSON: { virtuals: false },
  toObject: { virtuals: false }
});

// Documents must belong to exactly one account or expiring guest workspace.
function validateOwnership(this: { ownerEmail?: string | null; guestId?: string | null; expiresAt?: Date | null }) {
  if (Boolean(this.ownerEmail) === Boolean(this.guestId) || (this.guestId && !this.expiresAt) || (this.ownerEmail && this.expiresAt)) throw new Error('Invalid workspace ownership');
}
BookSchema.pre('validate', validateOwnership);
TemplateSchema.pre('validate', validateOwnership);

// Export models
export const TemplateModel = mongoose.models.Template || mongoose.model<Template>('Template', TemplateSchema, 'templates');
export const BookModel = mongoose.models.Book || mongoose.model<Book>('Book', BookSchema, 'books');
export const KeyValueModel = mongoose.models.KeyValue || mongoose.model<KeyValue>('KeyValue', KeyValueSchema, 'keyvalues');

// User schemas
const ApiKeyConfigSchema = new Schema<ApiKeyConfig>({
  together: { type: String, default: null },
  openAi: { type: String, default: null }
}, { _id: false });

const LlmConfigSchema = new Schema<LlmConfig>({
  service: { type: String, enum: ['together', 'openAi'], required: true },
  model: { type: String, required: true }
}, { _id: false });

const TtsConfigSchema = new Schema({
  service: { type: String, enum: ['together', 'openAi'], required: true },
  model: { type: String, required: true },
  voice: { type: String, required: true },
}, { _id: false });

const UserSchema = new Schema<User>({
  email: { type: String, required: true, unique: true },
  isAdmin: { type: Boolean, default: false },
  registeredAt: { type: Date, default: Date.now },
  lastLoginAt: { type: Date, default: Date.now },
  selectedLlm: { type: LlmConfigSchema, default: null },
  selectedTts: { type: TtsConfigSchema, default: null },
  apiKey: { type: ApiKeyConfigSchema, default: () => ({ together: null, openAi: null }) },
  trialTextUsed: { type: Number, default: 0 },
  trialAudioUsed: { type: Number, default: 0 },
  trialAccount: { type: Boolean, default: false }
}, {
  timestamps: true,
  toJSON: { virtuals: false },
  toObject: { virtuals: false }
});

export const UserModel = mongoose.models.User || mongoose.model<User>('User', UserSchema, 'users');

const GuestWorkspaceSchema = new Schema({
  guestId: { type: String, required: true, unique: true },
  tokenHash: { type: String, required: true, unique: true },
  state: { type: String, enum: ['active', 'claimed', 'cleaning'], default: 'active' },
  expiresAt: { type: Date, required: true },
  selectedLlm: { type: LlmConfigSchema, default: null },
  selectedTts: { type: TtsConfigSchema, default: null },
  encryptedKeys: { together: { type: String, default: null }, openAi: { type: String, default: null } },
  trialTextUsed: { type: Number, default: 0 },
  trialAudioUsed: { type: Number, default: 0 },
  uploadCount: { type: Number, default: 0 },
  claimedBy: { type: String, default: null },
  lastMutationAt: { type: Date, default: null },
  claimedExpiresAt: { type: Date },
}, { timestamps: true });
GuestWorkspaceSchema.index({ claimedExpiresAt: 1 }, { expireAfterSeconds: 0 });
GuestWorkspaceSchema.index({ state: 1, expiresAt: 1 });
export const GuestWorkspaceModel = mongoose.models.GuestWorkspace || mongoose.model('GuestWorkspace', GuestWorkspaceSchema, 'guestWorkspaces');

const GuestUploadSchema = new Schema({
  guestId: { type: String },
  ownerEmail: { type: String },
  imageUrl: { type: String, required: true },
  expiresAt: { type: Date },
}, { timestamps: true });
GuestUploadSchema.pre('validate', validateOwnership);
GuestUploadSchema.index({ guestId: 1 });
export const GuestUploadModel = mongoose.models.GuestUpload || mongoose.model('GuestUpload', GuestUploadSchema, 'guestUploads');

const GuestIpUsageSchema = new Schema({
  key: { type: String, unique: true, required: true },
  textUsed: { type: Number, default: 0 },
  audioUsed: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
});
GuestIpUsageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const GuestIpUsageModel = mongoose.models.GuestIpUsage || mongoose.model('GuestIpUsage', GuestIpUsageSchema, 'guestIpUsage');

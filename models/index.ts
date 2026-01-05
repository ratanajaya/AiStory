import { KeyValue } from './../types/index';
import mongoose, { Schema } from 'mongoose';
import { StorySegment, SegmentSummary, Chapter, Template, Book } from '@/types';

// Sub-schemas for Book components
const StorySegmentSchema = new Schema<StorySegment>({
  id: { type: String, required: true },
  day: { type: Number, required: true },
  role: { type: String, required: true },
  content: { type: String, required: true },
  excludeFromPrevStory: { type: Boolean },
  toSummarize: { type: Boolean },
  segmentSummaryId: { type: String },
  chapterId: { type: String }
}, { _id: false });

const SegmentSummarySchema = new Schema<SegmentSummary>({
  id: { type: String, required: true },
  content: { type: String, required: true }
}, { _id: false });

const ChapterSchema = new Schema<Chapter>({
  id: { type: String, required: true },
  title: { type: String, required: true },
  summary: { type: String, required: true },
  endState: { type: Schema.Types.Mixed }
}, { _id: false });

const TemplateSchema = new Schema<Template>({
  templateId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  prompt: {
    narrator: { type: String, default: null },
    inputTag: { type: String, default: null },
    summarizer: { type: String, default: null },
    summarizerEndState: { type: String, default: null }
  },
  storyBackground: { type: String, required: true }
}, {
  timestamps: true,
  toJSON: { virtuals: false },
  toObject: { virtuals: false }
});

const BookSchema = new Schema<Book>({
  bookId: { type: String, required: true, unique: true },
  templateId: { type: String, required: true },
  name: { type: String, default: null },
  storySegments: [StorySegmentSchema],
  segmentSummaries: [SegmentSummarySchema],
  chapters: [ChapterSchema]
}, {
  timestamps: true,
  toJSON: { virtuals: false },
  toObject: { virtuals: false }
});

const KeyValueSchema = new Schema<KeyValue>({
  key: { type: String, required: true, unique: true },
  value: { type: Schema.Types.Mixed }
}, {
  timestamps: true,
  toJSON: { virtuals: false },
  toObject: { virtuals: false }
});

// Export models
export const TemplateModel = mongoose.models.Template || mongoose.model<Template>('Template', TemplateSchema, 'templates');
export const BookModel = mongoose.models.Book || mongoose.model<Book>('Book', BookSchema, 'books');
export const KeyValueModel = mongoose.models.KeyValue || mongoose.model<KeyValue>('KeyValue', KeyValueSchema, 'keyvalues');

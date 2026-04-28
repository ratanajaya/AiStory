import { Book, PromptConfig, Template } from "@/types";
import _constant from "./_constant";
import _util from "./_util";
import { BookUIModel } from "@/types/extendedTypes";

const _promptUtil = {
  replacePromptBuilderString: (promptBuilderText: string, data: Record<string, string>) => {
    let result = promptBuilderText;
    for (const key in data) {
      const placeholder = `{${key}}`;
      result = result.split(placeholder).join(data[key]);
    }
    return result;
  },
  craftBookPrompt(promptBuilderText: string, 
    template: Template,
    book: Book | BookUIModel,
    idLimitExclusive: string | null
  ){
    const background = template.storyBackground;

    let previousChapters = '';
    book.chapters.forEach((chapter, i) => {
      previousChapters += chapter.title.toUpperCase() + ':' + _constant.newLine;
      previousChapters += chapter.summary + _constant.newLine2;
    });

    const { segmentsWithoutChapter } = _util.splitSegmentsWithChapter(book.storySegments);

    const segmentsWithoutChapterString = _util.getStorySegmentAsString(segmentsWithoutChapter, book.segmentSummaries, idLimitExclusive);
    const currentChapter = `${_util.altString(segmentsWithoutChapterString, '[THIS IS THE START OF A NEW CHAPTER]')}${_constant.newLine2}`;
    
    const result = _promptUtil.replacePromptBuilderString(promptBuilderText, {
      background,
      previousChapters,
      currentChapter
    });
    
    return result;
  }
}

export default _promptUtil;
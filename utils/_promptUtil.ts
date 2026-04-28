import { Book, Template } from "@/types";
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
    idLimitExclusive: string | null,
    extraData?: Record<string, string | null | undefined>
  ){
    const background = template.storyBackground;

    let previousChapters = '';
    book.chapters.forEach((chapter) => {
      previousChapters += chapter.title.toUpperCase() + ':' + _constant.newLine;
      previousChapters += chapter.summary + _constant.newLine2;
    });

    const { segmentsWithoutChapter } = _util.splitSegmentsWithChapter(book.storySegments);

    const segmentsWithoutChapterString = _util.getStorySegmentAsString(segmentsWithoutChapter, book.segmentSummaries, idLimitExclusive);
    const currentChapter = `${_util.altString(segmentsWithoutChapterString, '[THIS IS THE START OF A NEW CHAPTER]')}${_constant.newLine2}`;

    const promptData: Record<string, string> = {
      background,
      previousChapters,
      currentChapter,
      //narrator: template.prompt.narrator ?? '',
      textboxInput: '',
      inputTag: template.prompt.inputTag ?? '',
    };

    if (extraData) {
      Object.entries(extraData).forEach(([key, value]) => {
        promptData[key] = value ?? '';
      });
    }
    
    return _promptUtil.replacePromptBuilderString(promptBuilderText, promptData);
  }
}

export default _promptUtil;
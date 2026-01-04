import { _constant } from "./_constant";

const _util = {
  isNullOrWhitespace: (input: string | null | undefined) => {
    return !input || !input.trim();
  },
  altString: (input: string | null | undefined, alt: string) => {
    if(_util.isNullOrWhitespace(input)){
      return alt;
    }
    return input;
  },
  conditionalString: (input: string | null | undefined, output: string) => {
    if(_util.isNullOrWhitespace(input)){
      return "";
    }
    return output;
  },
  generateTimestamp: () => {
    const now = new Date();
    return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
  },

  cleanupLlmResponse: (input: string) => {
    return input.replace('[NO CONTENT]', '').replace('```json','').replace('```','').trim();
  },
}

export default _util;
import { Book, Template } from ".";

export interface BookSafeModel extends Omit<Book, 'ownerEmail'> {}

export interface BookUIModel extends BookSafeModel {}

export interface TemplateSafeModel extends Omit<Template, 'ownerEmail'> {}

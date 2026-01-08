import { Book, Template } from ".";

export interface BookSafeModel extends Omit<Book, 'ownerEmail'> {}

export interface BookUIModel extends BookSafeModel {
  shouldSave: boolean;
}

export interface TemplateSafeModel extends Omit<Template, 'ownerEmail'> {}
import type { Book, Template } from '@/types';

export function partitionTemplateItems(templates: Template[], books: Book[]) {
  const inactiveTemplates = templates.filter(template => template.isActive === false);
  const inactiveIds = new Set(inactiveTemplates.map(template => template.templateId));
  return {
    activeTemplates: templates.filter(template => template.isActive !== false),
    inactiveTemplates,
    inactiveBooks: books.filter(book => book.isActive === false && !inactiveIds.has(book.templateId)),
  };
}

import React, { useCallback, useLayoutEffect, useRef, useImperativeHandle } from 'react';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  autoSize?: boolean | { minRows?: number; maxRows?: number };
  size?: 'small' | 'default';
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = '', autoSize = false, rows, size = 'default', onInput, ...props }, ref) => {
    const internalRef = useRef<HTMLTextAreaElement>(null);
    const lastMeasuredValueRef = useRef<string | null>(null);
    const lastAutoSizeConfigRef = useRef<string | null>(null);
    const sizeClass = size === 'small'
      ? autoSize
        ? 'min-h-7 px-2 py-1 text-xs'
        : rows === 1
          ? 'h-7 px-2 py-1 text-xs'
          : 'px-2 py-1 text-xs'
      : autoSize
        ? 'min-h-10 px-3 py-2 text-sm'
        : rows === 1
          ? 'h-10 px-3 py-2 text-sm'
          : rows
            ? 'px-3 py-2 text-sm'
            : 'min-h-20 px-3 py-2 text-sm';
    
    useImperativeHandle(ref, () => internalRef.current!);

    const adjustHeight = useCallback(() => {
      const textarea = internalRef.current;
      if (!textarea || !autoSize) return;

      const minRows = typeof autoSize === 'object' ? autoSize.minRows || 1 : 1;
      const maxRows = typeof autoSize === 'object' ? autoSize.maxRows : undefined;
      const autoSizeConfig = `${minRows}:${maxRows ?? ''}`;

      if (
        textarea.value === lastMeasuredValueRef.current
        && autoSizeConfig === lastAutoSizeConfigRef.current
      ) {
        return;
      }

      // Resizing a focused textarea can make browsers scroll its caret into view.
      // Preserve every scrollable ancestor, including the page, while measuring.
      const scrollPositions: Array<{ element: HTMLElement; top: number; left: number }> = [];
      let ancestor = textarea.parentElement;
      while (ancestor) {
        if (ancestor.scrollHeight > ancestor.clientHeight || ancestor.scrollWidth > ancestor.clientWidth) {
          scrollPositions.push({ element: ancestor, top: ancestor.scrollTop, left: ancestor.scrollLeft });
        }
        ancestor = ancestor.parentElement;
      }
      const windowTop = window.scrollY;
      const windowLeft = window.scrollX;
      const textareaScrollTop = textarea.scrollTop;

      textarea.style.height = 'auto';

      const computedStyle = window.getComputedStyle(textarea);
      const lineHeight = parseInt(computedStyle.lineHeight) || 20;
      const paddingTop = parseInt(computedStyle.paddingTop) || 0;
      const paddingBottom = parseInt(computedStyle.paddingBottom) || 0;
      const minHeight = minRows * lineHeight + paddingTop + paddingBottom;
      const maxHeight = maxRows ? maxRows * lineHeight + paddingTop + paddingBottom : Infinity;
      const newHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight);
      textarea.style.height = `${newHeight}px`;

      textarea.scrollTop = textareaScrollTop;
      scrollPositions.forEach(({ element, top, left }) => {
        element.scrollTop = top;
        element.scrollLeft = left;
      });
      window.scrollTo(windowLeft, windowTop);

      lastMeasuredValueRef.current = textarea.value;
      lastAutoSizeConfigRef.current = autoSizeConfig;
    }, [autoSize]);

    useLayoutEffect(() => {
      adjustHeight();
    }, [adjustHeight, props.value]);

    return (
      <textarea
        ref={internalRef}
        rows={autoSize ? undefined : rows}
        className={`flex w-full rounded-md border border-input bg-background shadow-sm transition-colors placeholder:text-muted-foreground hover:border-ring/70 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 aria-invalid:border-destructive aria-invalid:ring-destructive/30 read-only:bg-muted/70 read-only:text-muted-foreground disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60 ${sizeClass} ${autoSize ? 'resize-none overflow-hidden' : ''} ${className}`}
        onInput={(event) => {
          onInput?.(event);
          adjustHeight();
        }}
        {...props}
      />
    );
  }
);

Textarea.displayName = 'Textarea';

import React, { useEffect, useRef, useImperativeHandle } from 'react';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  autoSize?: boolean | { minRows?: number; maxRows?: number };
  size?: 'small' | 'default';
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className = '', autoSize = false, rows, size = 'default', ...props }, ref) => {
    const internalRef = useRef<HTMLTextAreaElement>(null);
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

    useEffect(() => {
      const textarea = internalRef.current;
      if (!textarea || !autoSize) return;

      const adjustHeight = () => {
        const minRows = typeof autoSize === 'object' ? autoSize.minRows || 1 : 1;
        const maxRows = typeof autoSize === 'object' ? autoSize.maxRows : undefined;
        
        // Reset height to measure scrollHeight accurately
        textarea.style.height = 'auto';
        
        // Calculate line height
        const computedStyle = window.getComputedStyle(textarea);
        const lineHeight = parseInt(computedStyle.lineHeight) || 20;
        const paddingTop = parseInt(computedStyle.paddingTop) || 0;
        const paddingBottom = parseInt(computedStyle.paddingBottom) || 0;
        
        // Calculate min and max heights
        const minHeight = minRows * lineHeight + paddingTop + paddingBottom;
        const maxHeight = maxRows ? maxRows * lineHeight + paddingTop + paddingBottom : Infinity;
        
        // Set height based on content, but respect min/max
        const newHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight);
        textarea.style.height = `${newHeight}px`;
      };

      // Adjust on mount and when value changes
      adjustHeight();
      
      // Also adjust on input
      textarea.addEventListener('input', adjustHeight);
      
      return () => {
        textarea.removeEventListener('input', adjustHeight);
      };
    }, [autoSize, props.value]);

    return (
      <textarea
        ref={internalRef}
        rows={autoSize ? undefined : rows}
        className={`flex w-full rounded-md border border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 ${sizeClass} ${autoSize ? 'resize-none overflow-hidden' : ''} ${className}`}
        {...props}
      />
    );
  }
);

Textarea.displayName = 'Textarea';

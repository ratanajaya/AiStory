import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { useAnchoredOverlay } from '@/components/useAnchoredOverlay';

export function SegmentDirectionPreview({ inputRef, draft, suffix }: {
  inputRef: RefObject<HTMLTextAreaElement | null>;
  draft: string;
  suffix: string;
}) {
  const mirrorRef = useRef<HTMLDivElement>(null);
  const suffixRef = useRef<HTMLSpanElement>(null);
  const [clipped, setClipped] = useState(false);
  const { triggerRef, overlayRef, position } = useAnchoredOverlay(clipped, 'top');

  useLayoutEffect(() => {
    const field = inputRef.current;
    const mirror = mirrorRef.current;
    const inlineSuffix = suffixRef.current;
    if (!field || !mirror || !inlineSuffix) return;

    const syncScroll = () => {
      mirror.scrollTop = field.scrollTop;
      mirror.scrollLeft = field.scrollLeft;

      const bounds = mirror.getBoundingClientRect();
      setClipped(Array.from(inlineSuffix.getClientRects()).some(rect =>
        rect.width > 0 && (rect.top < bounds.top || rect.bottom > bounds.bottom
          || rect.left < bounds.left || rect.right > bounds.right)
      ));
    };
    const syncLayout = () => {
      const style = getComputedStyle(field);
      Object.assign(mirror.style, {
        top: `${field.clientTop}px`,
        left: `${field.clientLeft}px`,
        width: `${field.clientWidth}px`,
        height: `${field.clientHeight}px`,
        padding: style.padding,
        font: style.font,
        fontKerning: style.fontKerning,
        fontFeatureSettings: style.fontFeatureSettings,
        fontVariationSettings: style.fontVariationSettings,
        lineHeight: style.lineHeight,
        letterSpacing: style.letterSpacing,
        wordSpacing: style.wordSpacing,
        textAlign: style.textAlign,
        textIndent: style.textIndent,
        textTransform: style.textTransform,
        direction: style.direction,
        tabSize: style.tabSize,
        whiteSpace: style.whiteSpace,
        overflowWrap: style.overflowWrap,
        wordBreak: style.wordBreak,
      });
      syncScroll();
    };

    syncLayout();
    field.addEventListener('scroll', syncScroll);
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(syncLayout) : null;
    observer?.observe(field);
    return () => {
      field.removeEventListener('scroll', syncScroll);
      observer?.disconnect();
    };
  }, [inputRef, draft, suffix]);

  return (
    <>
      <div
        ref={mirrorRef}
        aria-hidden="true"
        className="pointer-events-none absolute box-border overflow-hidden text-transparent"
        style={{ visibility: clipped ? 'hidden' : undefined }}
      >
        {draft}<wbr /><span ref={suffixRef} className="text-muted-foreground">{suffix}</span>
      </div>
      <span ref={triggerRef} aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0" />
      {clipped && createPortal(
        <div
          ref={overlayRef}
          aria-hidden="true"
          className="pointer-events-none fixed z-[80] whitespace-pre-wrap [overflow-wrap:anywhere] rounded-md border border-border bg-elevated px-2.5 py-1.5 text-sm text-elevated-foreground shadow-xl"
          style={{ ...position, maxWidth: 'min(28rem, calc(100vw - 1rem))' }}
        >
          {suffix}
        </div>,
        document.body
      )}
    </>
  );
}

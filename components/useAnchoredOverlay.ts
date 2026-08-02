'use client';

import { useCallback, useLayoutEffect, useRef, useState } from 'react';

export type OverlayPlacement = 'top' | 'left';

interface OverlayPosition {
  left: number;
  top: number;
  visibility: 'hidden' | 'visible';
}

const VIEWPORT_MARGIN = 8;
const OVERLAY_OFFSET = 8;

export function useAnchoredOverlay(open: boolean, placement: OverlayPlacement) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<OverlayPosition>({
    left: VIEWPORT_MARGIN,
    top: VIEWPORT_MARGIN,
    visibility: 'hidden',
  });

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    const overlay = overlayRef.current;
    if (!trigger || !overlay) return;

    const triggerRect = trigger.getBoundingClientRect();
    const overlayRect = overlay.getBoundingClientRect();
    let left: number;
    let top: number;

    if (placement === 'left') {
      const fitsLeft = triggerRect.left >= overlayRect.width + OVERLAY_OFFSET + VIEWPORT_MARGIN;
      left = fitsLeft
        ? triggerRect.left - overlayRect.width - OVERLAY_OFFSET
        : triggerRect.right + OVERLAY_OFFSET;
      top = triggerRect.top + (triggerRect.height - overlayRect.height) / 2;
    } else {
      const fitsAbove = triggerRect.top >= overlayRect.height + OVERLAY_OFFSET + VIEWPORT_MARGIN;
      top = fitsAbove
        ? triggerRect.top - overlayRect.height - OVERLAY_OFFSET
        : triggerRect.bottom + OVERLAY_OFFSET;
      left = triggerRect.left + (triggerRect.width - overlayRect.width) / 2;
    }

    const maxLeft = Math.max(VIEWPORT_MARGIN, window.innerWidth - overlayRect.width - VIEWPORT_MARGIN);
    const maxTop = Math.max(VIEWPORT_MARGIN, window.innerHeight - overlayRect.height - VIEWPORT_MARGIN);
    setPosition({
      left: Math.min(Math.max(left, VIEWPORT_MARGIN), maxLeft),
      top: Math.min(Math.max(top, VIEWPORT_MARGIN), maxTop),
      visibility: 'visible',
    });
  }, [placement]);

  useLayoutEffect(() => {
    if (!open) return;

    updatePosition();
    const frame = window.requestAnimationFrame(updatePosition);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, updatePosition]);

  return { triggerRef, overlayRef, position };
}

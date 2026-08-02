'use client';

import { ReactElement, ReactNode, cloneElement, useEffect, useId, useState } from 'react';
import { createPortal } from 'react-dom';
import { OverlayPlacement, useAnchoredOverlay } from '@/components/useAnchoredOverlay';

interface TooltipProps {
  content: ReactNode;
  placement?: OverlayPlacement;
  maxWidth?: number | string;
  triggerClassName?: string;
  children: ReactElement<{ 'aria-describedby'?: string }>;
}

export function Tooltip({
  content,
  placement = 'top',
  maxWidth = 320,
  triggerClassName = 'inline-flex',
  children,
}: TooltipProps) {
  const [open, setOpen] = useState(false);
  const [mountNode, setMountNode] = useState<HTMLElement | null>(null);
  const tooltipId = useId();
  const { triggerRef, overlayRef, position } = useAnchoredOverlay(open, placement);

  useEffect(() => {
    setMountNode(document.body);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  return (
    <>
      <span
        ref={triggerRef}
        className={triggerClassName}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocusCapture={() => setOpen(true)}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
        }}
      >
        {cloneElement(children, { 'aria-describedby': open ? tooltipId : undefined })}
      </span>
      {open && mountNode && createPortal(
        <div
          ref={overlayRef}
          id={tooltipId}
          role="tooltip"
          className="pointer-events-none fixed z-[80] rounded-md border border-border bg-elevated px-2.5 py-1.5 text-xs leading-relaxed text-elevated-foreground shadow-xl"
          style={{
            left: position.left,
            top: position.top,
            visibility: position.visibility,
            maxWidth: typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth,
          }}
        >
          {content}
        </div>,
        mountNode
      )}
    </>
  );
}

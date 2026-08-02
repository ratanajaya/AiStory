'use client';

import { ReactNode, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/Button';

interface ModalProps {
  open: boolean;
  title?: string;
  width?: number | string;
  centered?: boolean;
  onOk?: () => void | Promise<void>;
  onCancel?: () => void;
  okText?: string;
  cancelText?: string;
  children: ReactNode;
}

const focusableSelector = [
  'button:not([disabled])',
  'input:not([disabled])',
  'textarea:not([disabled])',
  'select:not([disabled])',
  '[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export default function Modal({
  open,
  title,
  width = 720,
  centered = true,
  onOk,
  onCancel,
  okText = 'OK',
  cancelText = 'Cancel',
  children,
}: ModalProps) {
  const [mountNode, setMountNode] = useState<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCancelRef = useRef(onCancel);
  const titleId = useId();

  useEffect(() => {
    onCancelRef.current = onCancel;
  }, [onCancel]);

  useEffect(() => {
    setMountNode(document.body);
  }, []);

  useEffect(() => {
    if (!open || !mountNode) return;

    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusTimer = window.setTimeout(() => {
      const focusable = dialogRef.current?.querySelector<HTMLElement>(focusableSelector);
      (focusable ?? dialogRef.current)?.focus();
    }, 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && onCancelRef.current) {
        event.preventDefault();
        onCancelRef.current();
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector)
      );
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [mountNode, open]);

  if (!open || !mountNode) return null;

  const contentWidth = typeof width === 'number' ? `${width}px` : width;

  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-[2px] ${centered ? 'items-center' : 'items-start pt-16'}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel?.();
      }}
    >
      <div
        ref={dialogRef}
        className="flex max-h-[calc(100vh-2rem)] w-full flex-col overflow-hidden rounded-xl border border-border bg-elevated text-elevated-foreground shadow-2xl"
        style={{ maxWidth: contentWidth }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-label={title ? undefined : 'Dialog'}
        tabIndex={-1}
        onMouseDown={(event) => event.stopPropagation()}
      >
        {(title || onCancel) && (
          <div className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-5 py-4">
            {title && (
              <h2 id={titleId} className="text-lg font-semibold tracking-tight text-foreground">
                {title}
              </h2>
            )}
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="ml-auto rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Close dialog"
              >
                <span aria-hidden="true">&#x2715;</span>
              </button>
            )}
          </div>
        )}
        <div className="min-h-0 overflow-y-auto px-5 py-4">{children}</div>
        {(onOk || onCancel) && (
          <div className="flex shrink-0 justify-end gap-2 border-t border-border bg-card/60 px-5 py-4">
            {onCancel && (
              <Button variant="outline" onClick={onCancel}>
                {cancelText}
              </Button>
            )}
            {onOk && (
              <Button variant="primary" onClick={() => void onOk()}>
                {okText}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>,
    mountNode
  );
}

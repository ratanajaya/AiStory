'use client';

import { ReactElement, ReactNode, cloneElement, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/Button';
import { useAnchoredOverlay } from '@/components/useAnchoredOverlay';

interface ConfirmPopoverProps {
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => unknown | Promise<unknown>;
  children: ReactElement<{ 'aria-haspopup'?: 'dialog'; 'aria-expanded'?: boolean }>;
}

export function ConfirmPopover({
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  children,
}: ConfirmPopoverProps) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const [mountNode, setMountNode] = useState<HTMLElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const { triggerRef, overlayRef, position } = useAnchoredOverlay(open, 'top');

  useEffect(() => {
    setMountNode(document.body);
  }, []);

  const close = useCallback(() => {
    if (pending) return;
    setOpen(false);
    window.setTimeout(() => previouslyFocusedRef.current?.focus(), 0);
  }, [pending]);

  useEffect(() => {
    if (!open) return;

    const focusTimer = window.setTimeout(() => cancelButtonRef.current?.focus(), 0);

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!overlayRef.current?.contains(target) && !triggerRef.current?.contains(target)) close();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [close, open, overlayRef, triggerRef]);

  const handleConfirm = async () => {
    if (pending) return;
    setPending(true);
    setError(undefined);
    try {
      const result = await onConfirm();
      if (result === false) {
        setError('Unable to complete the action. Please try again.');
        return;
      }
      setOpen(false);
      window.setTimeout(() => previouslyFocusedRef.current?.focus(), 0);
    } catch {
      setError('Unable to complete the action. Please try again.');
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <span
        ref={triggerRef}
        className="inline-flex"
        onClick={() => {
          if (pending) return;
          previouslyFocusedRef.current = document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
          setError(undefined);
          setOpen((current) => !current);
        }}
      >
        {cloneElement(children, { 'aria-haspopup': 'dialog', 'aria-expanded': open })}
      </span>
      {open && mountNode && createPortal(
        <div
          ref={overlayRef}
          role="dialog"
          aria-label="Confirmation"
          className="fixed z-[80] w-72 rounded-lg border border-border bg-elevated p-3 text-elevated-foreground shadow-2xl"
          style={{ left: position.left, top: position.top, visibility: position.visibility }}
        >
          <p className="text-sm leading-relaxed">{message}</p>
          {error && <p className="mt-2 text-xs text-destructive" role="alert">{error}</p>}
          <div className="mt-3 flex justify-end gap-2">
            <Button ref={cancelButtonRef} type="button" variant="ghost" size="small" onClick={close} disabled={pending}>
              {cancelLabel}
            </Button>
            <Button type="button" variant="danger" size="small" onClick={() => void handleConfirm()} disabled={pending}>
              {pending ? 'Working...' : confirmLabel}
            </Button>
          </div>
        </div>,
        mountNode
      )}
    </>
  );
}

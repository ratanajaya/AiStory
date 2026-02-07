'use client';

import { ReactNode, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/Button';

interface ModalProps {
  open: boolean;
  title?: string;
  width?: number | string;
  centered?: boolean;
  onOk?: () => void;
  onCancel?: () => void;
  okText?: string;
  cancelText?: string;
  children: ReactNode;
}

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

  useEffect(() => {
    setMountNode(document.body);
  }, []);

  if (!open || !mountNode) {
    return null;
  }

  const contentWidth = typeof width === 'number' ? `${width}px` : width;

  return createPortal(
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onCancel}
        aria-hidden="true"
      />
      <div
        className={`absolute left-1/2 w-full px-4 ${centered ? 'top-1/2 -translate-y-1/2' : 'top-16'} -translate-x-1/2`}
      >
        <div
          className="mx-auto w-full rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl"
          style={{ maxWidth: contentWidth }}
          role="dialog"
          aria-modal="true"
        >
          {title && (
            <div className="border-b border-zinc-800 px-5 py-4 text-lg font-semibold text-white">
              {title}
            </div>
          )}
          <div className="px-5 py-4">{children}</div>
          {(onOk || onCancel) && (
            <div className="flex justify-end gap-2 border-t border-zinc-800 px-5 py-4">
              {onCancel && (
                <Button variant="secondary" onClick={onCancel}>
                  {cancelText}
                </Button>
              )}
              {onOk && (
                <Button variant="primary" onClick={onOk}>
                  {okText}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    mountNode
  );
}

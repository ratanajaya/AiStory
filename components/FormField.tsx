import React from 'react';

interface FormFieldProps {
  label: string;
  children: React.ReactNode;
  className?: string;
  labelClassName?: string;
  htmlFor?: string;
  required?: boolean;
  error?: string;
}

export function FormField({
  label,
  children,
  className = '',
  labelClassName = 'text-foreground',
  htmlFor,
  required = false,
  error,
}: FormFieldProps) {
  return (
    <div className={`mb-4 ${className}`}>
      <label htmlFor={htmlFor} className={`mb-1.5 block text-sm font-medium ${labelClassName}`}>
        {label}{required && <span className="ml-1 text-destructive" aria-hidden="true">*</span>}
      </label>
      {children}
      {error && (
        <p id={htmlFor ? `${htmlFor}-error` : undefined} className="mt-1.5 text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

import React from 'react';

interface FormFieldProps {
  label: string;
  children: React.ReactNode;
  className?: string;
  labelClassName?: string;
}

export function FormField({
  label,
  children,
  className = '',
  labelClassName = 'text-foreground',
}: FormFieldProps) {
  return (
    <div className={`mb-4 ${className}`}>
      <label className={`block mb-1 ${labelClassName}`}>
        {label}
      </label>
      {children}
    </div>
  );
}

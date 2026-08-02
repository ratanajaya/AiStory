import { InputHTMLAttributes, forwardRef } from 'react';

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  children?: React.ReactNode;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <label className={`inline-flex cursor-pointer items-center gap-2 text-sm text-foreground ${props.disabled ? 'cursor-not-allowed opacity-50' : ''}`}>
        <input
          type="checkbox"
          ref={ref}
          className={`h-4 w-4 cursor-pointer rounded border border-input bg-background accent-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed ${className}`}
          {...props}
        />
        {children && <span className="select-none">{children}</span>}
      </label>
    );
  }
);

Checkbox.displayName = 'Checkbox';

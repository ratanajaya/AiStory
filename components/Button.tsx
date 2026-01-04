import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'outline' | 'ghost';
}

const baseStyles = 'inline-flex items-center justify-center rounded-md text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2 cursor-pointer';

const variantStyles = {
  primary: 'bg-primary text-primary-foreground hover:brightness-125 shadow-sm',
  secondary: 'bg-secondary text-secondary-foreground hover:brightness-125 shadow-sm',
  accent: 'bg-accent text-accent-foreground hover:brightness-125 shadow-sm',
  outline: 'border border-input bg-background hover:brightness-125',
  ghost: 'hover:bg-muted hover:brightness-110',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'primary', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={`${baseStyles} ${variantStyles[variant]} ${className}`}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';

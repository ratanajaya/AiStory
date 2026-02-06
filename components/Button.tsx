import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'outline' | 'ghost' | 'danger';
  size?: 'small' | 'default' | 'large';
}

const baseStyles = 'inline-flex items-center justify-center rounded-md font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 cursor-pointer';

const variantStyles = {
  primary: 'bg-primary text-primary-foreground hover:brightness-125 shadow-sm',
  secondary: 'bg-secondary text-secondary-foreground hover:brightness-125 shadow-sm',
  accent: 'bg-accent text-accent-foreground hover:brightness-125 shadow-sm',
  outline: 'border border-input bg-background hover:brightness-125',
  ghost: 'hover:bg-muted hover:brightness-110',
  danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
};

const sizeStyles = {
  small: 'h-7 px-3 py-1 text-xs',
  default: 'h-10 px-4 py-2 text-sm',
  large: 'h-12 px-6 py-3 text-base',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = '', variant = 'primary', size = 'default', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';

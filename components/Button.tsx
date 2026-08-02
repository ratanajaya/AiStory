import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'accent' | 'outline' | 'ghost' | 'danger';
  size?: 'small' | 'default' | 'large';
}

const baseStyles = 'inline-flex cursor-pointer items-center justify-center rounded-md border border-transparent font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-45';

const variantStyles = {
  primary: 'border-primary/80 bg-primary text-primary-foreground shadow-sm hover:bg-highlight',
  secondary: 'border-secondary/70 bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/85',
  accent: 'border-accent bg-accent text-accent-foreground shadow-sm hover:bg-accent/85',
  outline: 'border-input bg-background text-foreground hover:border-ring hover:bg-muted',
  ghost: 'text-foreground hover:bg-muted',
  danger: 'border-destructive bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/85',
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

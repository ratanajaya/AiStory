import { InputHTMLAttributes, forwardRef } from 'react';

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  children?: React.ReactNode;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <label className={`inline-flex items-center cursor-pointer ${props.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
        <input
          type="checkbox"
          ref={ref}
          className={`
            w-4 h-4 rounded border-2 border-gray-400
            bg-transparent
            checked:bg-blue-500 checked:border-blue-500
            focus:ring-2 focus:ring-blue-500 focus:ring-offset-0
            disabled:cursor-not-allowed
            transition-colors
            cursor-pointer
            ${className}
          `}
          {...props}
        />
        {children && <span className="ml-2 select-none">{children}</span>}
      </label>
    );
  }
);

Checkbox.displayName = 'Checkbox';

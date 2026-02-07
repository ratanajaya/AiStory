import React from 'react';

import { Input } from './Input';

interface InputNumberProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value?: number;
  onChange?: (value: number) => void;
}

export const InputNumber = React.forwardRef<HTMLInputElement, InputNumberProps>(
  ({ className = '', value, onChange, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!onChange) return;
      
      const inputValue = e.target.value;
      if (inputValue === '') {
        onChange(0);
        return;
      }
      
      const numericValue = Number(inputValue);
      if (!Number.isNaN(numericValue)) {
        onChange(numericValue);
      }
    };

    return (
      <Input
        ref={ref}
        type="number"
        className={className}
        value={value}
        onChange={handleChange}
        {...props}
      />
    );
  }
);

InputNumber.displayName = 'InputNumber';

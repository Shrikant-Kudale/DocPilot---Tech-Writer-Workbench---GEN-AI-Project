/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled = false,
  icon,
  className = '',
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center justify-center font-medium rounded-[8px] transition-all duration-150 select-none focus:outline-none focus:ring-2 focus:ring-[#00A3A1]/40 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer';

  // 40px height requirement for standard md buttons
  const sizeStyles = {
    sm: 'h-8 px-3 text-xs gap-1.5',
    md: 'h-10 px-4 text-sm gap-2',
    lg: 'h-11 px-5 text-base gap-2.5',
  };

  const variantStyles = {
    // Primary teal with white text
    primary: 'bg-[#00A3A1] hover:bg-[#008d8b] active:bg-[#007b79] text-white shadow-xs',
    // Secondary white with navy border
    secondary: 'bg-white border border-[#0B1F3A] text-[#0B1F3A] hover:bg-[#0B1F3A]/5 active:bg-[#0B1F3A]/10 shadow-xs',
    outline: 'bg-transparent border border-[#E2E8F0] text-[#1B2733] hover:bg-slate-100 hover:border-slate-300',
    danger: 'bg-[#D64545] hover:bg-[#b83535] text-white shadow-xs',
    ghost: 'bg-transparent text-[#1B2733] hover:bg-slate-100',
  };

  return (
    <button
      disabled={disabled || isLoading}
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
      ) : (
        icon && <span className="shrink-0">{icon}</span>
      )}
      <span>{children}</span>
    </button>
  );
};

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

export type BadgeVariant =
  | 'default'
  | 'primary'
  | 'accent'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'outline';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'md',
  icon,
  className = '',
  ...props
}) => {
  const sizeStyles = {
    sm: 'text-[11px] px-2 py-0.5 gap-1',
    md: 'text-xs px-2.5 py-1 gap-1.5',
  };

  const variantStyles = {
    default: 'bg-slate-100 text-slate-700 border border-slate-200',
    primary: 'bg-[#0B1F3A] text-white',
    accent: 'bg-[#00A3A1]/15 text-[#008d8b] border border-[#00A3A1]/30 font-medium',
    success: 'bg-[#2E9E6B]/15 text-[#2E9E6B] border border-[#2E9E6B]/30 font-medium',
    warning: 'bg-[#F2A900]/15 text-[#b07b00] border border-[#F2A900]/30 font-medium',
    error: 'bg-[#D64545]/15 text-[#D64545] border border-[#D64545]/30 font-medium',
    info: 'bg-sky-50 text-sky-700 border border-sky-200 font-medium',
    outline: 'border border-[#E2E8F0] text-slate-600 bg-white',
  };

  return (
    <span
      className={`inline-flex items-center justify-center font-medium rounded-full tracking-wide select-none ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </span>
  );
};

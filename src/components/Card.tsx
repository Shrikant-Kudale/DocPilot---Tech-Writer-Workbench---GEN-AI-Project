/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

export interface CardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  headerAction?: React.ReactNode;
  footer?: React.ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  borderVariant?: 'default' | 'warning' | 'error' | 'success' | 'teal';
}

export const Card: React.FC<CardProps> = ({
  children,
  title,
  subtitle,
  headerAction,
  footer,
  padding = 'md',
  borderVariant = 'default',
  className = '',
  ...props
}) => {
  const paddingStyles = {
    none: 'p-0',
    sm: 'p-4',
    md: 'p-6', // 24px generous spacing
    lg: 'p-8',
  };

  const borderStyles = {
    default: 'border-[#E2E8F0] bg-white',
    warning: 'border-[#F2A900] bg-amber-50/40',
    error: 'border-[#D64545] bg-red-50/40',
    success: 'border-[#2E9E6B] bg-emerald-50/40',
    teal: 'border-[#00A3A1] bg-teal-50/30',
  };

  return (
    <div
      className={`rounded-[12px] border ${borderStyles[borderVariant]} shadow-xs transition-shadow duration-150 ${className}`}
      {...props}
    >
      {(title || headerAction) && (
        <div className="px-6 pt-5 pb-4 border-b border-[#E2E8F0] flex items-start justify-between gap-4">
          <div>
            {title && (
              <h3 className="text-base font-semibold text-[#0B1F3A] tracking-tight">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                {subtitle}
              </p>
            )}
          </div>
          {headerAction && <div className="shrink-0">{headerAction}</div>}
        </div>
      )}

      <div className={paddingStyles[padding]}>{children}</div>

      {footer && (
        <div className="px-6 py-4 bg-slate-50/70 border-t border-[#E2E8F0] rounded-b-[12px]">
          {footer}
        </div>
      )}
    </div>
  );
};

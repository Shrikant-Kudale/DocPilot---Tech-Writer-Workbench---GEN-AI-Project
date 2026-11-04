/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

export interface Column<T> {
  header: React.ReactNode;
  accessorKey?: keyof T;
  cell?: (row: T, index: number) => React.ReactNode;
  className?: string;
  width?: string;
}

export interface TableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (row: T, index: number) => string;
  emptyState?: React.ReactNode;
  isLoading?: boolean;
  className?: string;
}

export function Table<T>({
  data,
  columns,
  keyExtractor,
  emptyState,
  isLoading = false,
  className = '',
}: TableProps<T>) {
  if (isLoading) {
    return (
      <div className="py-12 text-center text-slate-500 flex flex-col items-center justify-center gap-3">
        <div className="w-6 h-6 border-2 border-[#00A3A1] border-t-transparent rounded-full animate-spin" />
        <span className="text-sm">Loading records...</span>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      emptyState || (
        <div className="py-12 text-center text-slate-400 text-sm">
          No records found.
        </div>
      )
    );
  }

  return (
    <div className={`overflow-x-auto w-full ${className}`}>
      <table className="w-full text-left border-collapse text-sm">
        <thead>
          <tr className="border-b border-[#E2E8F0] bg-slate-50/70 text-slate-600 text-xs font-semibold tracking-wider uppercase">
            {columns.map((col, idx) => (
              <th
                key={idx}
                className={`py-3 px-4 first:pl-5 last:pr-5 ${col.className || ''}`}
                style={col.width ? { width: col.width } : undefined}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E2E8F0]">
          {data.map((row, rowIdx) => (
            <tr
              key={keyExtractor(row, rowIdx)}
              className="hover:bg-slate-50/60 transition-colors duration-100 group"
            >
              {columns.map((col, colIdx) => (
                <td
                  key={colIdx}
                  className={`py-3.5 px-4 first:pl-5 last:pr-5 text-slate-700 align-middle ${col.className || ''}`}
                >
                  {col.cell
                    ? col.cell(row, rowIdx)
                    : col.accessorKey
                    ? String(row[col.accessorKey] ?? '')
                    : null}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

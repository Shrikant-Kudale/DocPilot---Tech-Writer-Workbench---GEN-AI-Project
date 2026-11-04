/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Menu, BookOpen, Compass } from 'lucide-react';
import { Button } from './Button';

interface TopBarProps {
  tabTitle: string;
  onOpenMobileSidebar: () => void;
  onOpenGuide: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  tabTitle,
  onOpenMobileSidebar,
  onOpenGuide,
}) => {
  return (
    <header className="h-16 border-b border-[#E2E8F0] bg-white sticky top-0 z-20 px-4 md:px-8 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobileSidebar}
          className="md:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          <span className="font-semibold text-lg text-[#0B1F3A] tracking-tight">
            DocPilot
          </span>
          <span className="text-slate-300 font-light hidden sm:inline">/</span>
          <span className="text-sm font-medium text-slate-600 hidden sm:inline">
            {tabTitle}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* User-friendly "How to Use / Guide" button */}
        <button
          onClick={onOpenGuide}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-[#00A3A1] border border-teal-200 text-xs font-semibold transition-all duration-150 cursor-pointer shadow-2xs"
          title="Open complete documentation & user guide"
        >
          <BookOpen className="w-4 h-4 text-[#00A3A1]" />
          <span>How to Use / Guide</span>
        </button>
      </div>
    </header>
  );
};

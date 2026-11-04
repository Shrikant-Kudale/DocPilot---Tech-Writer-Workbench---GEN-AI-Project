/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Search,
  BookOpen,
  Sparkles,
  FileEdit,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Wrench,
  Info,
  X,
  Compass,
} from 'lucide-react';

export type TabId =
  | 'ask-docs'
  | 'knowledge-base'
  | 'style-linter'
  | 'rewrite'
  | 'prompt-lab'
  | 'evaluation'
  | 'gap-report'
  | 'automation'
  | 'about';

export interface TabConfig {
  id: TabId;
  label: string;
  icon: React.ReactNode;
  badge?: number | string;
  description: string;
}

interface SidebarProps {
  activeTab: TabId;
  onSelectTab: (id: TabId) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  unresolvedGapsCount: number;
  totalChunksCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  isOpenMobile,
  onCloseMobile,
  unresolvedGapsCount,
  totalChunksCount,
}) => {
  const tabs: TabConfig[] = [
    {
      id: 'ask-docs',
      label: 'Ask Documents',
      icon: <Search className="w-4 h-4 shrink-0" />,
      description: 'Search & ask questions in plain English',
    },
    {
      id: 'knowledge-base',
      label: 'Document Library',
      icon: <BookOpen className="w-4 h-4 shrink-0" />,
      badge: totalChunksCount > 0 ? `${totalChunksCount}` : undefined,
      description: 'Upload PDF, Word, and text files',
    },
    {
      id: 'style-linter',
      label: 'Writing & Style Check',
      icon: <Sparkles className="w-4 h-4 shrink-0" />,
      description: 'Check readability, tone & active voice',
    },
    {
      id: 'rewrite',
      label: 'Smart Rewriter',
      icon: <FileEdit className="w-4 h-4 shrink-0" />,
      description: 'Improve clarity with human review',
    },
    {
      id: 'prompt-lab',
      label: 'Prompt Studio',
      icon: <Sliders className="w-4 h-4 shrink-0" />,
      description: 'Test custom writing instructions',
    },
    {
      id: 'evaluation',
      label: 'Accuracy Benchmark',
      icon: <CheckCircle2 className="w-4 h-4 shrink-0" />,
      description: 'Test search accuracy on sample questions',
    },
    {
      id: 'gap-report',
      label: 'Missing Topics Report',
      icon: <AlertCircle className="w-4 h-4 shrink-0" />,
      badge: unresolvedGapsCount > 0 ? `${unresolvedGapsCount}` : undefined,
      description: 'See questions your docs don\'t answer yet',
    },
    {
      id: 'automation',
      label: 'Publishing & Summaries',
      icon: <Wrench className="w-4 h-4 shrink-0" />,
      description: 'Generate release summaries and check links',
    },
    {
      id: 'about',
      label: 'Guide & Principles',
      icon: <Info className="w-4 h-4 shrink-0" />,
      description: 'Tips for writers and user policies',
    },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#0B1F3A] text-white select-none">
      {/* Brand Header */}
      <div className="h-16 px-5 flex items-center justify-between border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#00A3A1] flex items-center justify-center text-white shadow-sm font-bold text-base">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <div className="font-semibold text-white tracking-tight leading-none text-base">
              DocPilot
            </div>
            <div className="text-[10px] text-teal-300 font-medium mt-1 tracking-wider uppercase">
              Writer's Workbench
            </div>
          </div>
        </div>

        {/* Mobile close button */}
        <button
          onClick={onCloseMobile}
          className="md:hidden p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-md transition-colors cursor-pointer"
          aria-label="Close sidebar"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation list */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1 scrollbar-thin scrollbar-thumb-white/10">
        <div className="px-3 pb-2 text-[10px] font-semibold text-slate-400 uppercase tracking-widest">
          Writer Tools
        </div>

        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                onSelectTab(tab.id);
                onCloseMobile();
              }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 text-left group cursor-pointer ${
                isActive
                  ? 'bg-[#00A3A1] text-white shadow-sm font-semibold'
                  : 'text-slate-300 hover:bg-white/8 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <span
                  className={`${
                    isActive ? 'text-white' : 'text-slate-400 group-hover:text-white'
                  }`}
                >
                  {tab.icon}
                </span>
                <span className="truncate">{tab.label}</span>
              </div>

              {tab.badge && (
                <span
                  className={`text-[11px] px-1.5 py-0.5 rounded-full font-mono font-bold shrink-0 ${
                    isActive
                      ? 'bg-white/25 text-white'
                      : tab.id === 'gap-report'
                      ? 'bg-amber-400 text-slate-900'
                      : 'bg-white/10 text-slate-300'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer status */}
      <div className="p-4 border-t border-white/10 bg-[#08172c] text-xs text-slate-400 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#2E9E6B] animate-pulse" />
            <span className="text-slate-200 font-medium text-xs">Library Ready</span>
          </div>
          <span className="text-[11px] font-mono text-teal-300 bg-teal-950/80 px-2 py-0.5 rounded border border-teal-800/40">
            {totalChunksCount} sections
          </span>
        </div>
        <div className="mt-2 text-[11px] text-slate-400 flex items-center justify-between">
          <span>Search mode:</span>
          <span className="text-slate-200 font-medium">Plain Text Answers</span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop fixed sidebar 240px */}
      <aside className="hidden md:block w-[240px] shrink-0 h-screen sticky top-0 z-30">
        {sidebarContent}
      </aside>

      {/* Mobile drawer backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 bg-slate-900/60 z-40 md:hidden backdrop-blur-xs transition-opacity"
          onClick={onCloseMobile}
        />
      )}

      {/* Mobile drawer panel */}
      <div
        className={`fixed inset-y-0 left-0 w-[260px] z-50 transform transition-transform duration-200 ease-in-out md:hidden shadow-2xl ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {sidebarContent}
      </div>
    </>
  );
};

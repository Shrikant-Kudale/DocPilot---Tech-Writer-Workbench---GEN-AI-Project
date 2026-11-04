/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Sidebar, TabId } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { ToastProvider } from './components/Toast';
import { HowToUseModal } from './components/HowToUseModal';
import { useDocStore } from './lib/store';

// 9 Tabs
import { AskDocs } from './tabs/AskDocs';
import { KnowledgeBase } from './tabs/KnowledgeBase';
import { StyleLinter } from './tabs/StyleLinter';
import { Rewrite } from './tabs/Rewrite';
import { PromptLab } from './tabs/PromptLab';
import { Evaluation } from './tabs/Evaluation';
import { GapReport } from './tabs/GapReport';
import { Automation } from './tabs/Automation';
import { About } from './tabs/About';

export default function App() {
  const store = useDocStore();
  const [activeTab, setActiveTab] = useState<TabId>('ask-docs');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  // Pre-seed draft topic from gap report navigation
  const [pendingDraftTopic, setPendingDraftTopic] = useState<string | null>(null);

  const chunks = store.getChunks();
  const gaps = store.getGaps();
  const unresolvedGapsCount = gaps.filter((g) => g.status === 'unresolved').length;

  const tabTitles: Record<TabId, string> = {
    'ask-docs': 'Ask the Docs',
    'knowledge-base': 'Knowledge Base',
    'style-linter': 'Style Linter',
    'rewrite': 'Rewrite Assistant',
    'prompt-lab': 'Prompt Lab',
    'evaluation': 'Evaluation',
    'gap-report': 'Gap Report',
    'automation': 'Automation',
    'about': 'About & User Policy',
  };

  const navigateToTab = (tabId: string) => {
    setActiveTab(tabId as TabId);
  };

  const handleDraftForGap = (question: string) => {
    setPendingDraftTopic(question);
    setActiveTab('rewrite');
  };

  return (
    <ToastProvider>
      <div className="min-h-screen bg-[#F7F9FB] text-[#1B2733] font-sans antialiased flex flex-row">
        {/* Left Sidebar (240px, navy, white text, teal highlight on active) */}
        <Sidebar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          isOpenMobile={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
          unresolvedGapsCount={unresolvedGapsCount}
          totalChunksCount={chunks.length}
        />

        {/* Main Body Area */}
        <div className="flex-1 flex flex-col min-w-0 min-h-screen">
          {/* Top Bar with App Name and Guide Button */}
          <TopBar
            tabTitle={tabTitles[activeTab]}
            onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
            onOpenGuide={() => setIsGuideOpen(true)}
          />

          {/* Guide Documentation Modal */}
          <HowToUseModal
            isOpen={isGuideOpen}
            onClose={() => setIsGuideOpen(false)}
            onNavigateTab={(tabId) => {
              navigateToTab(tabId);
              setIsGuideOpen(false);
            }}
          />

          {/* Centered Main Container max-width 1100px */}
          <main className="flex-1 w-full max-w-[1100px] mx-auto px-4 sm:px-6 md:px-8 py-8">
            {activeTab === 'ask-docs' && (
              <AskDocs onNavigateToTab={navigateToTab} />
            )}
            {activeTab === 'knowledge-base' && <KnowledgeBase />}
            {activeTab === 'style-linter' && <StyleLinter />}
            {activeTab === 'rewrite' && <Rewrite />}
            {activeTab === 'prompt-lab' && <PromptLab />}
            {activeTab === 'evaluation' && <Evaluation />}
            {activeTab === 'gap-report' && (
              <GapReport onDraftForGap={handleDraftForGap} />
            )}
            {activeTab === 'automation' && <Automation />}
            {activeTab === 'about' && <About />}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  X,
  BookOpen,
  Search,
  Database,
  Sparkles,
  FileEdit,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Wrench,
  FileUp,
  HelpCircle,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { Button } from './Button';

interface HowToUseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab?: (tabId: string) => void;
}

export const HowToUseModal: React.FC<HowToUseModalProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
}) => {
  const [activeSection, setActiveSection] = useState<'getting-started' | 'kb' | 'ask' | 'lint' | 'rewrite' | 'prompt' | 'eval' | 'gap' | 'auto'>('getting-started');
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const sections = [
    {
      id: 'getting-started',
      title: '🚀 Getting Started',
      icon: <HelpCircle className="w-4 h-4 text-[#00A3A1]" />,
    },
    {
      id: 'kb',
      title: '📚 Building Your Knowledge Base',
      icon: <Database className="w-4 h-4 text-[#00A3A1]" />,
    },
    {
      id: 'ask',
      title: '🔍 Asking the Docs',
      icon: <Search className="w-4 h-4 text-[#00A3A1]" />,
    },
    {
      id: 'lint',
      title: '✨ Style Linter',
      icon: <Sparkles className="w-4 h-4 text-[#00A3A1]" />,
    },
    {
      id: 'rewrite',
      title: '✍️ Rewrite Assistant',
      icon: <FileEdit className="w-4 h-4 text-[#00A3A1]" />,
    },
    {
      id: 'prompt',
      title: '🧪 Prompt Lab',
      icon: <Sliders className="w-4 h-4 text-[#00A3A1]" />,
    },
    {
      id: 'eval',
      title: '📊 Evaluation Benchmark',
      icon: <CheckCircle2 className="w-4 h-4 text-[#00A3A1]" />,
    },
    {
      id: 'gap',
      title: '🚩 Gap Report',
      icon: <AlertCircle className="w-4 h-4 text-[#00A3A1]" />,
    },
    {
      id: 'auto',
      title: '⚙️ Automation Tools',
      icon: <Wrench className="w-4 h-4 text-[#00A3A1]" />,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#E2E8F0] bg-slate-50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-50 text-[#00A3A1] flex items-center justify-center border border-teal-200 shadow-xs">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#0B1F3A] tracking-tight">
                How to Use DocPilot — User Guide & Documentation
              </h2>
              <p className="text-xs text-slate-500">
                A simple, step-by-step guide to every tool in this documentation workbench.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
            aria-label="Close guide"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body with Left Navigation & Right Content */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
          {/* Left Category Menu */}
          <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-[#E2E8F0] bg-slate-50/70 p-3 space-y-1 overflow-y-auto shrink-0">
            <div className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Guide Topics
            </div>
            {sections.map((sec) => (
              <button
                key={sec.id}
                onClick={() => setActiveSection(sec.id as any)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-left transition-all cursor-pointer ${
                  activeSection === sec.id
                    ? 'bg-[#00A3A1] text-white shadow-xs font-semibold'
                    : 'text-slate-700 hover:bg-slate-200/60'
                }`}
              >
                <span className={activeSection === sec.id ? 'text-white' : 'text-slate-500'}>
                  {sec.icon}
                </span>
                <span className="truncate">{sec.title}</span>
              </button>
            ))}
          </div>

          {/* Right Content Area */}
          <div className="flex-1 p-6 overflow-y-auto space-y-6 text-slate-700 text-sm leading-relaxed">
            {activeSection === 'getting-started' && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-teal-50 border border-teal-200 text-teal-950">
                  <h3 className="font-bold text-sm text-[#0B1F3A] mb-1">
                    Welcome to DocPilot!
                  </h3>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    DocPilot is an all-in-one workbench for technical writers, software engineers, and documentation teams.
                    It helps you search your docs, check compliance with style guides, improve writing, and track missing documentation topics.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-semibold text-[#0B1F3A] text-sm">
                    How does DocPilot work in 3 simple steps?
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-xs">
                      <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-800 font-bold flex items-center justify-center mb-2">
                        1
                      </div>
                      <h5 className="font-semibold text-slate-900 mb-1">Upload Your Docs</h5>
                      <p className="text-slate-600">
                        Drop in your existing files (PDF, Word .docx, Markdown .md, or Text .txt). DocPilot automatically breaks them into searchable sections.
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-xs">
                      <div className="w-7 h-7 rounded-full bg-teal-50 text-[#00A3A1] font-bold flex items-center justify-center mb-2">
                        2
                      </div>
                      <h5 className="font-semibold text-slate-900 mb-1">Ask Questions</h5>
                      <p className="text-slate-600">
                        Ask any technical question. DocPilot finds the exact relevant paragraphs and writes a clear answer citing exact sources like [1], [2].
                      </p>
                    </div>

                    <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-xs">
                      <div className="w-7 h-7 rounded-full bg-emerald-50 text-[#2E9E6B] font-bold flex items-center justify-center mb-2">
                        3
                      </div>
                      <h5 className="font-semibold text-slate-900 mb-1">Review & Improve</h5>
                      <p className="text-slate-600">
                        Use the Style Linter to fix passive voice and terms, rewrite drafts side-by-side, and see which questions are missing from your docs.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <h4 className="font-semibold text-[#0B1F3A] text-sm mb-1.5">
                    Is there starter data already loaded?
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    <strong>Yes!</strong> To let you explore immediately without needing to upload files right away, DocPilot includes starter technical documentation on API Authentication, Webhooks, and Rate Limits. You can add your own files anytime, or reset to starter docs with one click in the Knowledge Base tab.
                  </p>
                </div>
              </div>
            )}

            {activeSection === 'kb' && (
              <div className="space-y-4">
                <h3 className="font-bold text-base text-[#0B1F3A]">
                  Building Your Knowledge Base
                </h3>
                <p className="text-xs text-slate-600">
                  The Knowledge Base is the central library DocPilot uses to answer questions and run evaluations.
                </p>

                <div className="space-y-3">
                  <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
                    <h4 className="font-semibold text-xs text-slate-900 uppercase tracking-wider">
                      Supported File Formats
                    </h4>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="px-2.5 py-1 rounded bg-teal-50 text-[#00A3A1] font-mono font-semibold border border-teal-200">
                        📄 PDF (.pdf)
                      </span>
                      <span className="px-2.5 py-1 rounded bg-blue-50 text-blue-700 font-mono font-semibold border border-blue-200">
                        📝 Word (.docx, .doc)
                      </span>
                      <span className="px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 font-mono font-semibold border border-emerald-200">
                        📑 Markdown (.md, .markdown)
                      </span>
                      <span className="px-2.5 py-1 rounded bg-slate-100 text-slate-700 font-mono font-semibold border border-slate-200">
                        📃 Plain Text (.txt)
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 text-xs">
                    <h4 className="font-semibold text-slate-900">What happens when you upload a file?</h4>
                    <ol className="list-decimal pl-5 space-y-1.5 text-slate-600">
                      <li><strong>Text Extraction:</strong> The system extracts the headings, paragraphs, code blocks, and tables from your file.</li>
                      <li><strong>Smart Chunking:</strong> Documents are broken into bite-sized chunks (~500 tokens with 50-token overlap) so the search engine can pinpoint exact answers.</li>
                      <li><strong>Embedding:</strong> A semantic vector representation is created for each chunk so questions can be matched by meaning, not just exact keywords.</li>
                      <li><strong>Ready to Query:</strong> The chunks instantly appear in the table and can immediately be searched in Tab 1 (Ask the Docs).</li>
                    </ol>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'ask' && (
              <div className="space-y-4">
                <h3 className="font-bold text-base text-[#0B1F3A]">
                  Ask the Docs: Search with Source Citations
                </h3>
                <p className="text-xs text-slate-600">
                  Ask technical questions in plain English just like a developer or customer would.
                </p>

                <div className="space-y-3 text-xs">
                  <div className="p-3.5 rounded-xl border border-teal-200 bg-teal-50/50">
                    <h4 className="font-semibold text-[#0B1F3A] mb-1">Numbered Citations [1], [2]</h4>
                    <p className="text-slate-700">
                      Every claim in the answer includes a citation badge linking directly to the exact file, section heading, and text snippet that provided the answer.
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50/50">
                    <h4 className="font-semibold text-amber-900 mb-1">
                      What is the &ldquo;Not found in docs&rdquo; warning?
                    </h4>
                    <p className="text-amber-800">
                      To prevent making up answers (hallucination), DocPilot requires at least <strong>55% relevance similarity</strong>. If your question is not covered in the knowledge base, an amber alert appears and the question is automatically saved to the <strong>Gap Report</strong> so you know what documentation needs to be written!
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'lint' && (
              <div className="space-y-4">
                <h3 className="font-bold text-base text-[#0B1F3A]">
                  Style Linter: Quality & Inclusive Language Checks
                </h3>
                <p className="text-xs text-slate-600">
                  Paste any documentation draft and click &ldquo;Lint Content&rdquo; to catch errors before publishing.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded-lg border border-red-200 bg-red-50/30">
                    <span className="font-bold text-red-700 block mb-1">Errors: Terminology</span>
                    <p className="text-slate-600">
                      Flags non-inclusive terms like &ldquo;whitelist&rdquo; (use allowlist), &ldquo;blacklist&rdquo; (use denylist), or vague links like &ldquo;click here&rdquo;.
                    </p>
                  </div>

                  <div className="p-3 rounded-lg border border-amber-200 bg-amber-50/30">
                    <span className="font-bold text-amber-700 block mb-1">Warnings: Passive Voice</span>
                    <p className="text-slate-600">
                      Catches confusing phrasing like &ldquo;is verified by&rdquo; and suggests active phrasing like &ldquo;The server verifies&rdquo;.
                    </p>
                  </div>

                  <div className="p-3 rounded-lg border border-sky-200 bg-sky-50/30">
                    <span className="font-bold text-sky-700 block mb-1">Info: Step Structure</span>
                    <p className="text-slate-600">
                      Ensures procedural steps start directly with action verbs (e.g. &ldquo;Click&rdquo;, &ldquo;Enter&rdquo;) rather than conversational filler.
                    </p>
                  </div>
                </div>

                <p className="text-xs text-slate-600">
                  Click <strong>&ldquo;Generate AI Fix&rdquo;</strong> to have DocPilot write a cleaned-up version with an explanation of every change made.
                </p>
              </div>
            )}

            {activeSection === 'rewrite' && (
              <div className="space-y-4">
                <h3 className="font-bold text-base text-[#0B1F3A]">
                  Rewrite Assistant & Human Verification
                </h3>
                <p className="text-xs text-slate-600">
                  Refactor rough developer notes into professional documentation drafts side-by-side.
                </p>

                <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/50 space-y-2 text-xs">
                  <div className="flex items-center gap-2 font-semibold text-emerald-900">
                    <ShieldCheck className="w-4 h-4 text-[#2E9E6B]" />
                    <span>Why is the &ldquo;Human verified&rdquo; checkbox mandatory?</span>
                  </div>
                  <p className="text-emerald-800 leading-relaxed">
                    AI should never publish unreviewed code snippets or documentation directly. In DocPilot, the <strong>&ldquo;Export Markdown&rdquo;</strong> button remains disabled until a human writer confirms they reviewed the draft for technical accuracy.
                  </p>
                </div>
              </div>
            )}

            {activeSection === 'gap' && (
              <div className="space-y-4">
                <h3 className="font-bold text-base text-[#0B1F3A]">
                  Gap Report: Discover What Users Are Looking For
                </h3>
                <p className="text-xs text-slate-600">
                  Whenever someone asks a question in Tab 1 that couldn&apos;t be answered from your documents, it is automatically logged here.
                </p>

                <div className="space-y-2 text-xs text-slate-600">
                  <p>
                    • <strong>Hit Counts:</strong> See how many times users have asked the same unanswered question.
                  </p>
                  <p>
                    • <strong>One-Click Draft:</strong> Click the arrow icon next to any gap to immediately open the Rewrite Assistant and draft documentation for it.
                  </p>
                  <p>
                    • <strong>Mark Resolved:</strong> Once you add the answer to your docs and upload the new file, mark the gap resolved.
                  </p>
                </div>
              </div>
            )}

            {activeSection === 'prompt' && (
              <div className="space-y-4">
                <h3 className="font-bold text-base text-[#0B1F3A]">
                  Prompt Lab: Testing & Auditing Prompts
                </h3>
                <p className="text-xs text-slate-600">
                  Test different prompt styles (e.g. Concise vs Step-by-Step) side by side with the exact same input query.
                  Use the <strong>&ldquo;Flag Hallucination&rdquo;</strong> button if an output invents a non-existent parameter or API header.
                </p>
              </div>
            )}

            {activeSection === 'eval' && (
              <div className="space-y-4">
                <h3 className="font-bold text-base text-[#0B1F3A]">
                  Evaluation: Benchmark QA Scoring
                </h3>
                <p className="text-xs text-slate-600">
                  Test your documentation knowledge base against a set of golden questions with known expected answers.
                  DocPilot runs all questions through retrieval and reports your <strong>Retrieval Hit Rate (%)</strong> and <strong>Accuracy (%)</strong> on a visual bar chart.
                </p>
              </div>
            )}

            {activeSection === 'auto' && (
              <div className="space-y-4">
                <h3 className="font-bold text-base text-[#0B1F3A]">
                  Automation: Link Checker, Metadata, & Release Notes
                </h3>
                <div className="space-y-3 text-xs text-slate-700">
                  <div className="p-3 rounded-lg border border-slate-200 bg-white">
                    <strong>1. Link Integrity Checker:</strong> Scans your markdown for broken relative links, insecure HTTP links, and missing anchor targets.
                  </div>
                  <div className="p-3 rounded-lg border border-slate-200 bg-white">
                    <strong>2. Metadata Checker:</strong> Checks your YAML frontmatter to ensure title, description, slug, and SEO lengths conform to standards.
                  </div>
                  <div className="p-3 rounded-lg border border-slate-200 bg-white">
                    <strong>3. Release-note Assembler:</strong> Converts raw git commit messages into polished, developer-facing changelogs.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-[#E2E8F0] flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500">
            Have questions? Contact your documentation team lead.
          </span>
          <Button size="sm" variant="primary" onClick={onClose}>
            Got it, close guide
          </Button>
        </div>
      </div>
    </div>
  );
};

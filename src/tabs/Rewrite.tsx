/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  FileEdit,
  Sparkles,
  Download,
  Copy,
  Check,
  ShieldCheck,
  RotateCcw,
  Sliders,
  CheckSquare,
  Square,
} from 'lucide-react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { useToast } from '../components/Toast';

const SAMPLE_ORIGINAL = `### Rate Limiting Overview

When making calls to our API, users should be aware that requests are going to be throttled if the rate limit is exceeded by them.
Our system simply utilizes a sliding window mechanism. It was decided by the backend team that 100 requests every minute would be allowed for standard tiers.

To avoid getting a 429 status code returned, you should check the X-RateLimit-Remaining response headers. If they are zero, you can just wait for a bit and retry.`;

export const Rewrite: React.FC = () => {
  const toast = useToast();

  const [originalText, setOriginalText] = useState(SAMPLE_ORIGINAL);
  const [aiDraft, setAiDraft] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [tone, setTone] = useState('Concise & Developer-focused');
  const [goal, setGoal] = useState('Active voice, imperative instructions, remove fluff');
  const [isHumanVerified, setIsHumanVerified] = useState(false);
  const [copied, setCopied] = useState(false);

  // Verification sub-items
  const [checkedCode, setCheckedCode] = useState(false);
  const [checkedAccuracy, setCheckedAccuracy] = useState(false);

  const handleGenerateRewrite = async () => {
    if (!originalText.trim()) {
      toast.warning('Please enter an original documentation draft.');
      return;
    }

    setIsLoading(true);
    setIsHumanVerified(false); // Reset verification on new generation
    setCheckedCode(false);
    setCheckedAccuracy(false);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'rewrite',
          text: originalText,
          tone,
          goal,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to generate rewrite draft');
      }

      const data = await res.json();
      setAiDraft(data.draft);
      toast.success('Generated AI draft. Review and verify before exporting.');
    } catch (err: any) {
      console.error('Rewrite error:', err);
      toast.error(err.message || 'Failed to rewrite draft.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportMarkdown = () => {
    if (!isHumanVerified) {
      toast.error('You must tick "Human verified" before exporting AI-generated documentation.');
      return;
    }

    const contentToExport = aiDraft || originalText;
    const blob = new Blob([contentToExport], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `verified-doc-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success('Exported human-verified Markdown file successfully.');
  };

  const handleCopyDraft = () => {
    if (!aiDraft) return;
    navigator.clipboard.writeText(aiDraft);
    setCopied(true);
    toast.success('AI draft copied to clipboard.');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#0B1F3A] tracking-tight">
            Rewrite Assistant
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Side-by-side technical document refactoring. Improves clarity, active voice, and step-by-step structure with mandatory human review before export.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            disabled={!isHumanVerified}
            onClick={handleExportMarkdown}
            icon={<Download className="w-4 h-4" />}
            title={!isHumanVerified ? 'Requires "Human verified" checkbox' : 'Export verified markdown'}
          >
            Export Markdown
          </Button>
        </div>
      </div>

      {/* Friendly How this works explainer */}
      <div className="p-3.5 rounded-xl bg-teal-50/60 border border-teal-200 text-xs text-slate-700 space-y-1">
        <div className="font-semibold text-teal-900 flex items-center gap-1.5">
          <span>How to use this tool:</span>
        </div>
        <p className="text-slate-600 leading-relaxed">
          <strong>1. Put original text on the left:</strong> Enter raw developer notes or draft copy.
          <br />
          <strong>2. Generate AI Draft:</strong> Choose your desired tone and click &ldquo;Generate AI Draft&rdquo;. The refactored version appears on the right.
          <br />
          <strong>3. Human Verification:</strong> Carefully review the right column. Once you tick the <strong>&ldquo;Human verified&rdquo;</strong> checkbox at the bottom, the <strong>&ldquo;Export Markdown&rdquo;</strong> button unlocks so you can download the clean file.
        </p>
      </div>

      {/* Style & Goal Controls Bar */}
      <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] shadow-xs grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
        <div>
          <label className="text-xs font-semibold text-slate-600 block mb-1">
            Target Tone
          </label>
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            className="w-full h-9 px-3 rounded-md border border-[#E2E8F0] text-xs text-slate-800 bg-white focus:outline-none focus:border-[#00A3A1]"
          >
            <option value="Concise & Developer-focused">Concise & Developer-focused</option>
            <option value="Step-by-Step Procedural">Step-by-Step Procedural</option>
            <option value="Executive API Overview">Executive API Overview</option>
            <option value="Beginner-friendly Tutorial">Beginner-friendly Tutorial</option>
            <option value="SDK Reference Standard">SDK Reference Standard</option>
          </select>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-600 block mb-1">
            Refactoring Goal
          </label>
          <input
            type="text"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="e.g. Active voice, clear steps, remove jargon"
            className="w-full h-9 px-3 rounded-md border border-[#E2E8F0] text-xs text-slate-800 bg-white focus:outline-none focus:border-[#00A3A1]"
          />
        </div>

        <div className="flex items-end justify-end gap-2 pt-4 md:pt-0">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setOriginalText(SAMPLE_ORIGINAL);
              setAiDraft('');
              setIsHumanVerified(false);
            }}
            icon={<RotateCcw className="w-3.5 h-3.5" />}
          >
            Reset
          </Button>
          <Button
            size="md"
            variant="primary"
            isLoading={isLoading}
            onClick={handleGenerateRewrite}
            icon={<Sparkles className="w-4 h-4" />}
            className="w-full sm:w-auto"
          >
            Generate AI Draft
          </Button>
        </div>
      </div>

      {/* Two-Column Side-by-Side View */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Original */}
        <Card
          padding="md"
          title={
            <div className="flex items-center justify-between w-full">
              <span>Original Draft</span>
              <Badge variant="outline" size="sm">
                Source Document
              </Badge>
            </div>
          }
          subtitle={`${originalText.trim().split(/\s+/).filter(Boolean).length} words`}
        >
          <textarea
            value={originalText}
            onChange={(e) => setOriginalText(e.target.value)}
            rows={16}
            className="w-full p-3 font-mono text-xs leading-relaxed rounded-lg border border-[#E2E8F0] bg-slate-50/50 text-slate-800 focus:outline-none focus:border-[#00A3A1] resize-y"
            placeholder="Enter original draft here..."
          />
        </Card>

        {/* Right Column: AI Draft */}
        <Card
          padding="md"
          borderVariant={aiDraft ? 'teal' : 'default'}
          title={
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-[#00A3A1]" />
                <span>AI Draft</span>
              </div>
              {aiDraft && (
                <div className="flex items-center gap-2">
                  <Badge variant="accent" size="sm">
                    {aiDraft.trim().split(/\s+/).filter(Boolean).length} words
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCopyDraft}
                    icon={copied ? <Check className="w-3 h-3 text-[#2E9E6B]" /> : <Copy className="w-3 h-3" />}
                  >
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                </div>
              )}
            </div>
          }
          subtitle={aiDraft ? 'Review and edit before approving' : 'Pending AI generation'}
        >
          {aiDraft ? (
            <textarea
              value={aiDraft}
              onChange={(e) => {
                setAiDraft(e.target.value);
                // When edited, encourage re-verification
              }}
              rows={16}
              className="w-full p-3 font-mono text-xs leading-relaxed rounded-lg border border-teal-200 bg-white text-slate-900 focus:outline-none focus:border-[#00A3A1] focus:ring-2 focus:ring-[#00A3A1]/20 resize-y"
            />
          ) : (
            <div className="h-64 border-2 border-dashed border-[#E2E8F0] rounded-lg flex flex-col items-center justify-center p-6 text-center text-slate-400">
              <FileEdit className="w-8 h-8 mb-2 text-slate-300" />
              <p className="text-xs">
                Click &ldquo;Generate AI Draft&rdquo; to refactor the original text using active voice and imperative guidelines.
              </p>
            </div>
          )}
        </Card>
      </div>

      {/* Mandatory Human Verification Card */}
      <Card
        padding="md"
        borderVariant={isHumanVerified ? 'success' : 'default'}
        className={`transition-all duration-200 ${
          isHumanVerified ? 'bg-emerald-50/30 border-emerald-300' : 'bg-slate-50/60'
        }`}
      >
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                  isHumanVerified
                    ? 'bg-emerald-100 text-[#2E9E6B]'
                    : 'bg-slate-200 text-slate-500'
                }`}
              >
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-[#0B1F3A]">
                  Human-in-the-Loop Verification Protocol
                </h3>
                <p className="text-xs text-slate-500">
                  Per DocPilot policy, no AI-generated documentation may be exported to staging or production without technical writer sign-off.
                </p>
              </div>
            </div>

            <Badge variant={isHumanVerified ? 'success' : 'outline'} size="sm">
              {isHumanVerified ? 'Verified & Approved' : 'Verification Required'}
            </Badge>
          </div>

          {/* Sub-checks to make it high-trust */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 text-xs text-slate-700">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={checkedAccuracy}
                onChange={(e) => setCheckedAccuracy(e.target.checked)}
                className="w-4 h-4 text-[#00A3A1] rounded border-slate-300 focus:ring-[#00A3A1]"
              />
              <span>I confirmed technical accuracy against API specifications</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={checkedCode}
                onChange={(e) => setCheckedCode(e.target.checked)}
                className="w-4 h-4 text-[#00A3A1] rounded border-slate-300 focus:ring-[#00A3A1]"
              />
              <span>I tested or verified all code/header snippets</span>
            </label>
          </div>

          {/* Master "Human verified" Checkbox */}
          <div className="pt-3 border-t border-slate-200/80 flex items-center justify-between">
            <label className="flex items-center gap-3 cursor-pointer select-none group">
              <input
                type="checkbox"
                checked={isHumanVerified}
                onChange={(e) => {
                  const val = e.target.checked;
                  setIsHumanVerified(val);
                  if (val) {
                    setCheckedCode(true);
                    setCheckedAccuracy(true);
                    toast.success('Human verification confirmed. Export button enabled.');
                  }
                }}
                disabled={!aiDraft}
                className="w-5 h-5 text-[#00A3A1] rounded border-slate-300 focus:ring-[#00A3A1] cursor-pointer disabled:opacity-40"
              />
              <span className="text-sm font-semibold text-[#0B1F3A] group-hover:text-[#00A3A1] transition-colors">
                Human verified (Ready for documentation release)
              </span>
            </label>

            <Button
              size="sm"
              variant={isHumanVerified ? 'primary' : 'outline'}
              disabled={!isHumanVerified}
              onClick={handleExportMarkdown}
              icon={<Download className="w-3.5 h-3.5" />}
            >
              Export Markdown
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

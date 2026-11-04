/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Sparkles,
  AlertOctagon,
  AlertTriangle,
  Info,
  CheckCircle2,
  ArrowRight,
  RotateCcw,
  Copy,
  Check,
} from 'lucide-react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { useToast } from '../components/Toast';
import { lintDocumentation, LintIssue, Severity } from '../lib/rules';

const SAMPLE_WITH_ISSUES = `# Configuring Webhook Subscriptions

To simply receive real-time webhook events, please click here to open the dashboard.

## Security Whitelist & Denylist
All event payloads are verified by the edge proxy before dispatching to your server.
You must whitelist our static outbound IP addresses:
- 198.51.100.1
- 198.51.100.2

If an unauthorized origin sends a request, it is immediately dropped by the firewall.

## Step-by-Step Setup
1. You should navigate to Settings > Webhooks in your workspace.
2. The user will select "Create New Endpoint".
3. Entering your destination HTTPS URL in the target field is required.
4. Obviously, test the connection using the ping tool.`;

export const StyleLinter: React.FC = () => {
  const toast = useToast();

  const [text, setText] = useState(SAMPLE_WITH_ISSUES);
  const [issues, setIssues] = useState<LintIssue[]>([]);
  const [hasLinted, setHasLinted] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [copiedAi, setCopiedAi] = useState(false);

  const handleLint = () => {
    if (!text.trim()) {
      toast.warning('Please enter some text to lint.');
      return;
    }

    const foundIssues = lintDocumentation(text);
    setIssues(foundIssues);
    setHasLinted(true);

    if (foundIssues.length === 0) {
      toast.success('No style guide violations found! Clean documentation.');
    } else {
      toast.info(
        `Found ${foundIssues.length} style issue${foundIssues.length > 1 ? 's' : ''} across terminology, voice, and step structure.`
      );
    }
  };

  const handleGenerateAiFix = async () => {
    if (!text.trim()) {
      toast.warning('Textarea is empty.');
      return;
    }

    setIsGeneratingAi(true);
    setAiSuggestion(null);

    try {
      const issuesSummary = issues
        .map(
          (issue) =>
            `- Line ${issue.line} [${issue.severity.toUpperCase()} / ${issue.category}]: "${issue.matchedText}" -> ${issue.message}`
        )
        .join('\n');

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'lint_suggest',
          text,
          issuesSummary: issuesSummary || 'General style review for technical documentation.',
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to generate style fix suggestion from AI');
      }

      const data = await res.json();
      setAiSuggestion(data.suggestion);
      toast.success('Generated AI style suggestions.');
    } catch (err: any) {
      console.error('AI Fix error:', err);
      toast.error(err.message || 'Failed to generate AI style suggestion.');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const applyCorrection = (correctedText: string) => {
    // Extract correction markdown block if AI formatted it with headers
    let extracted = correctedText;
    const match = correctedText.match(/### Suggested Correction\s*\n([\s\S]*?)(?=### Explanation|$)/i);
    if (match && match[1]) {
      extracted = match[1].trim();
    }
    setText(extracted);
    setIssues(lintDocumentation(extracted));
    toast.success('Applied AI suggestion to editor.');
  };

  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warnCount = issues.filter((i) => i.severity === 'warn').length;
  const infoCount = issues.filter((i) => i.severity === 'info').length;

  return (
    <div className="space-y-6">
      {/* Intro Header */}
      <div>
        <h1 className="text-2xl font-semibold text-[#0B1F3A] tracking-tight">
          Style Linter
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Automated rule checks against Google and Microsoft technical documentation style guides.
          Catches deprecated terminology, passive voice, and non-imperative procedural steps.
        </p>
      </div>

      {/* Friendly How this works explainer */}
      <div className="p-3.5 rounded-xl bg-teal-50/60 border border-teal-200 text-xs text-slate-700 space-y-1">
        <div className="font-semibold text-teal-900 flex items-center gap-1.5">
          <span>How to use this tool:</span>
        </div>
        <p className="text-slate-600 leading-relaxed">
          <strong>1. Paste your draft:</strong> Paste your documentation text in the box below, or click &ldquo;Reset Sample&rdquo; to test with an example draft.
          <br />
          <strong>2. Click &ldquo;Lint Content&rdquo;:</strong> DocPilot scans every line for non-inclusive terms, passive voice, and procedural step issues.
          <br />
          <strong>3. AI Suggestions:</strong> Click &ldquo;Generate AI Fix&rdquo; to get a fully corrected draft and apply it straight into your editor.
        </p>
      </div>

      {/* Editor & Actions */}
      <Card
        padding="md"
        title="Draft Content to Lint"
        subtitle="Paste your Markdown documentation draft below"
        headerAction={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setText(SAMPLE_WITH_ISSUES);
                setIssues([]);
                setHasLinted(false);
                setAiSuggestion(null);
              }}
              icon={<RotateCcw className="w-3.5 h-3.5" />}
            >
              Reset Sample
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={handleLint}
              icon={<Sparkles className="w-3.5 h-3.5" />}
            >
              Lint Content
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={12}
            className="w-full p-4 font-mono text-xs leading-relaxed rounded-lg border border-[#E2E8F0] focus:outline-none focus:border-[#00A3A1] focus:ring-2 focus:ring-[#00A3A1]/20 bg-slate-50/50 text-[#1B2733]"
            placeholder="Type or paste markdown documentation here..."
          />

          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>
              {text.trim().split(/\s+/).filter(Boolean).length} words &bull;{' '}
              {text.split('\n').length} lines
            </span>
            <span className="font-mono text-slate-400">
              Rules: Terminology &bull; Passive Voice &bull; Step Structure
            </span>
          </div>
        </div>
      </Card>

      {/* Results Section */}
      {hasLinted && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Severity Counters Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-[#E2E8F0] flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Total Issues
                </div>
                <div className="text-2xl font-bold text-[#0B1F3A] mt-0.5">
                  {issues.length}
                </div>
              </div>
              <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                <AlertOctagon className="w-4 h-4" />
              </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-red-200 bg-red-50/20 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-red-700 uppercase tracking-wider">
                  Errors (Terms)
                </div>
                <div className="text-2xl font-bold text-[#D64545] mt-0.5">
                  {errorCount}
                </div>
              </div>
              <Badge variant="error" size="sm">
                High
              </Badge>
            </div>

            <div className="bg-white p-4 rounded-xl border border-amber-200 bg-amber-50/20 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-amber-700 uppercase tracking-wider">
                  Warnings (Passive)
                </div>
                <div className="text-2xl font-bold text-[#b07b00] mt-0.5">
                  {warnCount}
                </div>
              </div>
              <Badge variant="warning" size="sm">
                Medium
              </Badge>
            </div>

            <div className="bg-white p-4 rounded-xl border border-sky-200 bg-sky-50/20 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-sky-700 uppercase tracking-wider">
                  Info (Steps)
                </div>
                <div className="text-2xl font-bold text-sky-700 mt-0.5">
                  {infoCount}
                </div>
              </div>
              <Badge variant="info" size="sm">
                Style
              </Badge>
            </div>
          </div>

          {/* Detailed Issues List */}
          <Card
            padding="none"
            title={`Detected Lint Violations (${issues.length})`}
            subtitle="Review each issue and recommended technical phrasing"
            headerAction={
              <Button
                size="sm"
                variant="primary"
                isLoading={isGeneratingAi}
                onClick={handleGenerateAiFix}
                icon={<Sparkles className="w-3.5 h-3.5" />}
              >
                Generate AI Fix
              </Button>
            }
          >
            {issues.length === 0 ? (
              <div className="py-12 text-center text-slate-600">
                <CheckCircle2 className="w-10 h-10 text-[#2E9E6B] mx-auto mb-2" />
                <h4 className="font-semibold text-sm text-[#0B1F3A]">
                  All style checks passed!
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  Draft conforms to standard active voice, inclusive terms, and imperative steps.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#E2E8F0]">
                {issues.map((issue) => {
                  const badgeVariant: Record<Severity, any> = {
                    error: 'error',
                    warn: 'warning',
                    info: 'info',
                  };

                  return (
                    <div
                      key={issue.id}
                      className="p-4 hover:bg-slate-50/60 transition-colors flex flex-col sm:flex-row sm:items-start justify-between gap-4"
                    >
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant={badgeVariant[issue.severity]} size="sm">
                            {issue.severity.toUpperCase()}
                          </Badge>
                          <span className="text-xs font-semibold text-[#0B1F3A]">
                            {issue.category}
                          </span>
                          <span className="text-xs font-mono text-slate-400">
                            Line {issue.line}:{issue.column}
                          </span>
                        </div>

                        <div className="text-xs text-slate-800">
                          Matched:{' '}
                          <code className="bg-red-50 text-red-700 px-1.5 py-0.5 rounded font-mono border border-red-200">
                            {issue.matchedText}
                          </code>
                        </div>

                        <p className="text-xs text-slate-600 leading-relaxed">
                          {issue.message}
                        </p>
                      </div>

                      <div className="sm:max-w-xs w-full bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-xs">
                        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                          Suggested Replacement:
                        </span>
                        <div className="text-[#00A3A1] font-medium font-mono text-xs">
                          {issue.suggestion}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* AI Suggestions Panel */}
          {aiSuggestion && (
            <Card
              borderVariant="teal"
              padding="md"
              title={
                <div className="flex items-center gap-2 text-[#00A3A1]">
                  <Sparkles className="w-4 h-4" />
                  <span>AI Rewrite Suggestion</span>
                </div>
              }
              headerAction={
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(aiSuggestion);
                      setCopiedAi(true);
                      setTimeout(() => setCopiedAi(false), 2000);
                      toast.success('Suggestion copied');
                    }}
                    icon={copiedAi ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  >
                    {copiedAi ? 'Copied' : 'Copy'}
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => applyCorrection(aiSuggestion)}
                    icon={<ArrowRight className="w-3.5 h-3.5" />}
                  >
                    Apply to Editor
                  </Button>
                </div>
              }
            >
              <div className="prose prose-slate max-w-none text-xs leading-relaxed whitespace-pre-wrap font-mono bg-slate-50 p-4 rounded-lg border border-slate-200">
                {aiSuggestion}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

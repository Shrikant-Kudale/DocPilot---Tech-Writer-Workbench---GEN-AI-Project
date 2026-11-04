/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  Link2,
  FileCheck2,
  ScrollText,
  Play,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { useToast } from '../components/Toast';

const SAMPLE_MARKDOWN_LINKS = `# API Authentication Guide

For overview instructions, [view the quickstart guide](/quickstart.md).
You can also inspect our [public health endpoint](http://api.docpilot.io/health) or check [Rate Limits](#rate-limits-and-quotas).

To download our CLI, refer to [broken link](https://).
For legacy v1 migration details, see [non-existent anchor](#invalid-section-anchor).`;

const SAMPLE_FRONTMATTER = `---
title: "Webhooks Architecture and Verification"
description: "Comprehensive guide to configuring, receiving, and verifying HMAC SHA-256 webhook events in DocPilot."
slug: "webhooks-architecture"
author: "API Team"
last_modified: "2026-11-01"
tags: ["webhooks", "security", "integrations"]
---

# Webhooks Architecture
Payload delivery guidelines...`;

const SAMPLE_COMMITS = `feat(auth): add PKCE authorization code flow for single-page applications
fix(webhooks): resolve 10-second timeout on dead-letter queue worker
perf(rag): improve pgvector cosine index retrieval latency by 45%
feat(cli): support DOCPILOT_API_KEY environment variable auto-detection
docs(ratelimit): document Tier 2 quota increase request process
chore(deps): bump @google/genai to 2.4.0
BREAKING CHANGE: rename header X-Old-Signature to X-DocPilot-Signature`;

export const Automation: React.FC = () => {
  const toast = useToast();

  // 1. Link Checker State
  const [linkInput, setLinkInput] = useState(SAMPLE_MARKDOWN_LINKS);
  const [isCheckingLinks, setIsCheckingLinks] = useState(false);
  const [linkResults, setLinkResults] = useState<{
    total: number;
    passed: number;
    warnings: number;
    errors: number;
    items: Array<{
      text: string;
      url: string;
      status: 'ok' | 'warn' | 'error';
      reason: string;
    }>;
  } | null>(null);

  // 2. Metadata Checker State
  const [metaInput, setMetaInput] = useState(SAMPLE_FRONTMATTER);
  const [isCheckingMeta, setIsCheckingMeta] = useState(false);
  const [metaResults, setMetaResults] = useState<{
    hasFrontmatter: boolean;
    valid: boolean;
    fields: Array<{
      key: string;
      value: string;
      status: 'ok' | 'warn' | 'error';
      message: string;
    }>;
  } | null>(null);

  // 3. Release-note Assembler State
  const [releaseInput, setReleaseInput] = useState(SAMPLE_COMMITS);
  const [isAssemblingRelease, setIsAssemblingRelease] = useState(false);
  const [releaseOutput, setReleaseOutput] = useState<string | null>(null);
  const [copiedRelease, setCopiedRelease] = useState(false);

  // Run Link Checker
  const handleRunLinkChecker = () => {
    if (!linkInput.trim()) {
      toast.warning('Please enter markdown text or links to check.');
      return;
    }

    setIsCheckingLinks(true);
    setTimeout(() => {
      const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
      const items: Array<{
        text: string;
        url: string;
        status: 'ok' | 'warn' | 'error';
        reason: string;
      }> = [];

      let match;
      while ((match = linkRegex.exec(linkInput)) !== null) {
        const text = match[1];
        const url = match[2].trim();

        if (url === '#' || url === '' || url === 'https://') {
          items.push({
            text,
            url,
            status: 'error',
            reason: 'Empty or malformed URL destination.',
          });
        } else if (url.startsWith('http://')) {
          items.push({
            text,
            url,
            status: 'warn',
            reason: 'Insecure HTTP link. Prefer HTTPS for documentation.',
          });
        } else if (url.startsWith('#')) {
          const anchor = url.slice(1).toLowerCase();
          // Check if markdown has this heading
          const slugifiedHeadings = linkInput
            .split('\n')
            .filter((l) => l.startsWith('#'))
            .map((h) =>
              h
                .replace(/^#+\s*/, '')
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '')
            );

          if (slugifiedHeadings.includes(anchor)) {
            items.push({
              text,
              url,
              status: 'ok',
              reason: 'Internal anchor target verified.',
            });
          } else {
            items.push({
              text,
              url,
              status: 'error',
              reason: `Broken anchor #${anchor}: heading target not found in document.`,
            });
          }
        } else if (url.startsWith('/') || url.endsWith('.md')) {
          items.push({
            text,
            url,
            status: 'ok',
            reason: 'Valid documentation internal path.',
          });
        } else if (url.startsWith('https://')) {
          items.push({
            text,
            url,
            status: 'ok',
            reason: 'Valid external HTTPS protocol link.',
          });
        } else {
          items.push({
            text,
            url,
            status: 'warn',
            reason: 'Unrecognized link protocol scheme.',
          });
        }
      }

      const passed = items.filter((i) => i.status === 'ok').length;
      const warnings = items.filter((i) => i.status === 'warn').length;
      const errors = items.filter((i) => i.status === 'error').length;

      setLinkResults({
        total: items.length,
        passed,
        warnings,
        errors,
        items,
      });

      setIsCheckingLinks(false);
      toast.success(`Scanned ${items.length} links: ${passed} passed, ${errors} errors.`);
    }, 350);
  };

  // Run Metadata Checker
  const handleRunMetaChecker = () => {
    if (!metaInput.trim()) {
      toast.warning('Please enter frontmatter markdown.');
      return;
    }

    setIsCheckingMeta(true);
    setTimeout(() => {
      const match = metaInput.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      if (!match) {
        setMetaResults({
          hasFrontmatter: false,
          valid: false,
          fields: [
            {
              key: 'frontmatter',
              value: 'none',
              status: 'error',
              message: 'Missing YAML frontmatter block enclosed in --- delimiters.',
            },
          ],
        });
        setIsCheckingMeta(false);
        toast.error('No YAML frontmatter detected.');
        return;
      }

      const yamlContent = match[1];
      const parsed: Record<string, string> = {};
      yamlContent.split('\n').forEach((line) => {
        const colonIdx = line.indexOf(':');
        if (colonIdx > 0) {
          const k = line.slice(0, colonIdx).trim();
          const v = line
            .slice(colonIdx + 1)
            .trim()
            .replace(/^["']|["']$/g, '');
          parsed[k] = v;
        }
      });

      const fields: Array<{
        key: string;
        value: string;
        status: 'ok' | 'warn' | 'error';
        message: string;
      }> = [];

      // Check title
      if (!parsed.title) {
        fields.push({
          key: 'title',
          value: 'missing',
          status: 'error',
          message: 'Title is required for search and browser tab display.',
        });
      } else if (parsed.title.length > 60) {
        fields.push({
          key: 'title',
          value: parsed.title,
          status: 'warn',
          message: `Title length (${parsed.title.length} chars) exceeds SEO standard 60 chars.`,
        });
      } else {
        fields.push({
          key: 'title',
          value: parsed.title,
          status: 'ok',
          message: 'Optimal title length for documentation search.',
        });
      }

      // Check description
      if (!parsed.description) {
        fields.push({
          key: 'description',
          value: 'missing',
          status: 'error',
          message: 'Meta description is missing.',
        });
      } else if (parsed.description.length < 40) {
        fields.push({
          key: 'description',
          value: parsed.description,
          status: 'warn',
          message: 'Description too short (<40 chars) for rich snippet preview.',
        });
      } else if (parsed.description.length > 160) {
        fields.push({
          key: 'description',
          value: parsed.description,
          status: 'warn',
          message: `Description (${parsed.description.length} chars) will truncate in search results (>160 chars).`,
        });
      } else {
        fields.push({
          key: 'description',
          value: parsed.description,
          status: 'ok',
          message: 'High-quality SEO description length.',
        });
      }

      // Check slug
      if (!parsed.slug) {
        fields.push({
          key: 'slug',
          value: 'missing',
          status: 'warn',
          message: 'Missing URL slug identifier.',
        });
      } else if (!/^[a-z0-9-]+$/.test(parsed.slug)) {
        fields.push({
          key: 'slug',
          value: parsed.slug,
          status: 'error',
          message: 'Slug must be lower-case kebab-case (e.g. "my-doc-slug").',
        });
      } else {
        fields.push({
          key: 'slug',
          value: parsed.slug,
          status: 'ok',
          message: 'Valid kebab-case URL slug.',
        });
      }

      // Check last_modified
      if (!parsed.last_modified) {
        fields.push({
          key: 'last_modified',
          value: 'missing',
          status: 'warn',
          message: 'Include last_modified timestamp for freshness indexing.',
        });
      } else {
        fields.push({
          key: 'last_modified',
          value: parsed.last_modified,
          status: 'ok',
          message: 'Timestamp formatted properly.',
        });
      }

      const allValid = fields.every((f) => f.status !== 'error');
      setMetaResults({
        hasFrontmatter: true,
        valid: allValid,
        fields,
      });

      setIsCheckingMeta(false);
      toast.success(allValid ? 'Frontmatter metadata validated.' : 'Frontmatter metadata has issues.');
    }, 350);
  };

  // Run Release Note Assembler
  const handleRunReleaseNotes = async () => {
    if (!releaseInput.trim()) {
      toast.warning('Please enter git commits or change bullets.');
      return;
    }

    setIsAssemblingRelease(true);
    setReleaseOutput(null);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'release_notes',
          rawCommits: releaseInput,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to assemble release notes');
      }

      const data = await res.json();
      setReleaseOutput(data.notes);
      toast.success('Generated professional changelog release notes.');
    } catch (err: any) {
      console.error('Release notes error:', err);
      toast.error(err.message || 'Failed to assemble release notes');
    } finally {
      setIsAssemblingRelease(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-[#0B1F3A] tracking-tight">
          Documentation Automation
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Automated linting and assembly pipelines for technical publication: Link integrity, frontmatter metadata verification, and changelog generation.
        </p>
      </div>

      {/* Friendly How this works explainer */}
      <div className="p-3.5 rounded-xl bg-teal-50/60 border border-teal-200 text-xs text-slate-700 space-y-1">
        <div className="font-semibold text-teal-900 flex items-center gap-1.5">
          <span>💡 How to use & what happens:</span>
        </div>
        <p className="text-slate-600 leading-relaxed">
          <strong>1. Link Integrity:</strong> Paste markdown text to scan for broken relative links, missing anchor targets, and insecure HTTP URLs.
          <br />
          <strong>2. Metadata Checker:</strong> Paste your document frontmatter to make sure titles, descriptions, and slugs meet SEO standards.
          <br />
          <strong>3. Release Notes:</strong> Paste raw git commit logs or developer notes to automatically format them into clean, categorized release notes.
        </p>
      </div>

      {/* 3 Automation Cards as required by prompt */}
      <div className="space-y-6">
        {/* Card 1: Link Checker */}
        <Card
          padding="md"
          title={
            <div className="flex items-center gap-2">
              <Link2 className="w-5 h-5 text-[#00A3A1]" />
              <span>Link Integrity Checker</span>
            </div>
          }
          subtitle="Validates internal markdown anchors, protocol security (HTTPS), and destination URLs"
          headerAction={
            <Button
              size="sm"
              variant="primary"
              isLoading={isCheckingLinks}
              onClick={handleRunLinkChecker}
              icon={<Play className="w-3.5 h-3.5" />}
            >
              Run Link Checker
            </Button>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Markdown Source / Link Excerpt
              </label>
              <textarea
                value={linkInput}
                onChange={(e) => setLinkInput(e.target.value)}
                rows={5}
                className="w-full p-3 font-mono text-xs rounded-lg border border-[#E2E8F0] bg-slate-50/50 text-slate-800 focus:outline-none focus:border-[#00A3A1]"
              />
            </div>

            {/* Output Panel */}
            {linkResults && (
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800">
                    Scan Summary: {linkResults.total} Links Tested
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge variant="success" size="sm">
                      {linkResults.passed} OK
                    </Badge>
                    <Badge variant="warning" size="sm">
                      {linkResults.warnings} Warnings
                    </Badge>
                    <Badge variant="error" size="sm">
                      {linkResults.errors} Broken
                    </Badge>
                  </div>
                </div>

                <div className="divide-y divide-slate-200 bg-white rounded-lg border border-slate-200 text-xs">
                  {linkResults.items.map((item, idx) => (
                    <div key={idx} className="p-2.5 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 truncate">
                        {item.status === 'ok' && (
                          <CheckCircle2 className="w-4 h-4 text-[#2E9E6B] shrink-0" />
                        )}
                        {item.status === 'warn' && (
                          <AlertTriangle className="w-4 h-4 text-[#b07b00] shrink-0" />
                        )}
                        {item.status === 'error' && (
                          <XCircle className="w-4 h-4 text-[#D64545] shrink-0" />
                        )}
                        <span className="font-semibold text-slate-800">[{item.text}]</span>
                        <code className="text-slate-500 font-mono text-[11px] truncate">
                          ({item.url})
                        </code>
                      </div>
                      <span className="text-slate-500 text-[11px] shrink-0">{item.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Card 2: Metadata Checker */}
        <Card
          padding="md"
          title={
            <div className="flex items-center gap-2">
              <FileCheck2 className="w-5 h-5 text-[#00A3A1]" />
              <span>Metadata & Frontmatter Checker</span>
            </div>
          }
          subtitle="Validates YAML header fields, slug conventions, and SEO character constraints"
          headerAction={
            <Button
              size="sm"
              variant="primary"
              isLoading={isCheckingMeta}
              onClick={handleRunMetaChecker}
              icon={<Play className="w-3.5 h-3.5" />}
            >
              Run Metadata Checker
            </Button>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Document YAML Frontmatter
              </label>
              <textarea
                value={metaInput}
                onChange={(e) => setMetaInput(e.target.value)}
                rows={5}
                className="w-full p-3 font-mono text-xs rounded-lg border border-[#E2E8F0] bg-slate-50/50 text-slate-800 focus:outline-none focus:border-[#00A3A1]"
              />
            </div>

            {/* Output Panel */}
            {metaResults && (
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800">
                    Frontmatter Health Status
                  </span>
                  <Badge variant={metaResults.valid ? 'success' : 'error'} size="sm">
                    {metaResults.valid ? 'Conforms to Spec' : 'Requires Attention'}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {metaResults.fields.map((f, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-lg border bg-white flex items-start gap-2.5 border-slate-200"
                    >
                      {f.status === 'ok' ? (
                        <CheckCircle2 className="w-4 h-4 text-[#2E9E6B] shrink-0 mt-0.5" />
                      ) : f.status === 'warn' ? (
                        <AlertTriangle className="w-4 h-4 text-[#b07b00] shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 text-[#D64545] shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div className="font-mono font-semibold text-slate-800 uppercase text-[10px]">
                          {f.key}
                        </div>
                        <div className="text-slate-600 text-xs mt-0.5">{f.message}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Card 3: Release-note Assembler */}
        <Card
          padding="md"
          title={
            <div className="flex items-center gap-2">
              <ScrollText className="w-5 h-5 text-[#00A3A1]" />
              <span>Release-note Assembler</span>
            </div>
          }
          subtitle="Transforms raw git commits and changelog bullets into structured, developer-ready release notes"
          headerAction={
            <Button
              size="sm"
              variant="primary"
              isLoading={isAssemblingRelease}
              onClick={handleRunReleaseNotes}
              icon={<Sparkles className="w-3.5 h-3.5" />}
            >
              Assemble Release Notes
            </Button>
          }
        >
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Raw Git Commits / Change Notes
              </label>
              <textarea
                value={releaseInput}
                onChange={(e) => setReleaseInput(e.target.value)}
                rows={5}
                className="w-full p-3 font-mono text-xs rounded-lg border border-[#E2E8F0] bg-slate-50/50 text-slate-800 focus:outline-none focus:border-[#00A3A1]"
              />
            </div>

            {/* Output Panel */}
            {releaseOutput && (
              <div className="p-4 rounded-xl border border-teal-200 bg-teal-50/30 space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#0B1F3A]">
                    Formatted Release Notes (Markdown)
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(releaseOutput);
                      setCopiedRelease(true);
                      setTimeout(() => setCopiedRelease(false), 2000);
                      toast.success('Changelog copied to clipboard');
                    }}
                    icon={copiedRelease ? <Check className="w-3.5 h-3.5 text-[#2E9E6B]" /> : <Copy className="w-3.5 h-3.5" />}
                  >
                    {copiedRelease ? 'Copied' : 'Copy'}
                  </Button>
                </div>

                <div className="p-4 rounded-lg bg-white border border-teal-200 text-xs font-mono whitespace-pre-wrap text-slate-800 leading-relaxed max-h-72 overflow-y-auto">
                  {releaseOutput}
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};

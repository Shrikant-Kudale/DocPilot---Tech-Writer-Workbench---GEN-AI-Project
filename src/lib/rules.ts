/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import terminologyData from '../../data/terminology.json';

export type Severity = 'error' | 'warn' | 'info';

export interface LintIssue {
  id: string;
  line: number;
  column: number;
  matchedText: string;
  severity: Severity;
  category: 'Terminology' | 'Passive Voice' | 'Step Structure' | 'Clarity';
  message: string;
  suggestion: string;
}

// Common past participles and passive patterns
const PASSIVE_PARTICIPLES = new Set([
  'processed', 'configured', 'deleted', 'executed', 'created', 'updated',
  'handled', 'sent', 'received', 'stored', 'called', 'invoked', 'terminated',
  'triggered', 'compiled', 'generated', 'rendered', 'loaded', 'authenticated',
  'validated', 'assigned', 'routed', 'dropped', 'modified', 'retrieved',
  'written', 'done', 'built', 'run', 'made', 'seen', 'found', 'taken'
]);

// Imperative verbs expected at start of procedure steps
const IMPERATIVE_VERBS = new Set([
  'click', 'enter', 'select', 'choose', 'type', 'run', 'execute', 'navigate',
  'open', 'close', 'verify', 'confirm', 'download', 'install', 'configure',
  'set', 'add', 'remove', 'delete', 'copy', 'paste', 'specify', 'toggle',
  'drag', 'drop', 'inspect', 'test', 'review', 'ensure', 'create', 'update',
  'send', 'view', 'check', 'enable', 'disable', 'press', 'save', 'restart'
]);

export function lintDocumentation(text: string): LintIssue[] {
  if (!text || !text.trim()) return [];

  const issues: LintIssue[] = [];
  const lines = text.split('\n');

  lines.forEach((lineText, lineIdx) => {
    const lineNum = lineIdx + 1;
    const trimmed = lineText.trim();
    if (!trimmed) return;

    // 1. Terminology checks
    terminologyData.forEach((rule) => {
      const regex = new RegExp(`\\b${escapeRegex(rule.term)}\\b`, 'gi');
      let match: RegExpExecArray | null;
      while ((match = regex.exec(lineText)) !== null) {
        issues.push({
          id: `term-${lineNum}-${match.index}`,
          line: lineNum,
          column: match.index + 1,
          matchedText: match[0],
          severity: rule.severity as Severity,
          category: 'Terminology',
          message: rule.reason,
          suggestion: rule.replacement,
        });
      }
    });

    // 2. Passive voice detection (e.g., "is processed by", "was deleted", "were configured")
    const passiveRegex = /\b(am|is|are|was|were|been|being|be)\s+([a-z]+ed|[a-z]+en|written|done|built|run|made|seen|found|taken)(\s+by\s+[a-z]+)?\b/gi;
    let pMatch: RegExpExecArray | null;
    while ((pMatch = passiveRegex.exec(lineText)) !== null) {
      const verbWord = pMatch[2].toLowerCase();
      if (PASSIVE_PARTICIPLES.has(verbWord) || verbWord.endsWith('ed')) {
        issues.push({
          id: `passive-${lineNum}-${pMatch.index}`,
          line: lineNum,
          column: pMatch.index + 1,
          matchedText: pMatch[0],
          severity: 'warn',
          category: 'Passive Voice',
          message: 'Passive construction obscures who or what performs the action.',
          suggestion: `Rephrase in active voice using an explicit subject (e.g. 'The server processes' or 'DocPilot deletes')`,
        });
      }
    }

    // 3. Step structure check: numbered or bullet lists in procedures
    // Checks for patterns like "1. You should click", "2. The user must configure", "Step 1: Clicking the button"
    const stepMatch = lineText.match(/^(\s*(?:\d+[\.\)]|[-*]|\bStep\s+\d+[:\.]?)\s+)(.+)$/i);
    if (stepMatch) {
      const prefix = stepMatch[1];
      const stepBody = stepMatch[2].trim();
      const firstWordMatch = stepBody.match(/^([a-zA-Z]+)/);

      if (firstWordMatch) {
        const firstWord = firstWordMatch[1];
        const lowerFirstWord = firstWord.toLowerCase();

        // Check if starts with conversational pronoun or modal
        const weakStarters = ['you', 'the', 'please', 'in', 'if', 'after', 'when', 'to', 'first', 'next', 'then'];
        if (weakStarters.includes(lowerFirstWord)) {
          issues.push({
            id: `step-${lineNum}-${prefix.length}`,
            line: lineNum,
            column: prefix.length + 1,
            matchedText: `${prefix}${firstWord}`,
            severity: 'info',
            category: 'Step Structure',
            message: `Procedural steps should start directly with an imperative verb rather than '${firstWord}'.`,
            suggestion: `Begin with an action verb such as 'Click', 'Select', 'Configure', or 'Enter'.`,
          });
        } else if (lowerFirstWord.endsWith('ing')) {
          issues.push({
            id: `step-ing-${lineNum}-${prefix.length}`,
            line: lineNum,
            column: prefix.length + 1,
            matchedText: firstWord,
            severity: 'info',
            category: 'Step Structure',
            message: `Gerund ('${firstWord}') found at start of step. Use base imperative verb form.`,
            suggestion: `Change '${firstWord}' to its imperative base form (e.g., '${firstWord.replace(/ing$/, '')}').`,
          });
        } else if (!IMPERATIVE_VERBS.has(lowerFirstWord) && !lowerFirstWord.endsWith('e') && !lowerFirstWord.endsWith('t')) {
          // Additional soft check
        }
      }
    }
  });

  return issues;
}

function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

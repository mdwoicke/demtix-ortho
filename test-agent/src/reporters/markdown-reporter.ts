/**
 * Markdown Reporter
 * Generates detailed markdown reports from test results
 */

import * as fs from 'fs';
import * as path from 'path';
import { TestRun, TestResult } from '../storage/database';
import { Recommendation } from '../analysis/recommendation-engine';
import { config } from '../config/config';

export class MarkdownReporter {
  /**
   * Generate a complete markdown report
   */
  generateReport(run: TestRun, results: TestResult[], recommendations: Recommendation[]): string {
    const lines: string[] = [];

    // Header
    lines.push('# E2E Test Report');
    lines.push('');
    lines.push(`**Generated:** ${new Date().toISOString()}`);
    lines.push(`**Run ID:** ${run.runId}`);
    lines.push(`**Duration:** ${run.completedAt ? this.formatDuration(run.startedAt, run.completedAt) : 'In Progress'}`);
    lines.push('');

    // Summary
    lines.push('## Summary');
    lines.push('');
    lines.push('| Metric | Count |');
    lines.push('|--------|-------|');
    lines.push(`| Total Tests | ${run.totalTests} |`);
    lines.push(`| Passed | ${run.passed} |`);
    lines.push(`| Failed | ${run.failed} |`);
    lines.push(`| Skipped | ${run.skipped} |`);
    lines.push(`| Pass Rate | ${run.totalTests > 0 ? ((run.passed / run.totalTests) * 100).toFixed(1) : 0}% |`);
    lines.push('');

    // Status badge
    if (run.failed === 0) {
      lines.push('> **Status:** All tests passed! ');
    } else {
      lines.push(`> **Status:** ${run.failed} test(s) failed. See recommendations below. `);
    }
    lines.push('');

    // Results by category
    lines.push('## Results by Category');
    lines.push('');

    const categories = ['happy-path', 'edge-case', 'error-handling'];
    for (const category of categories) {
      const categoryResults = results.filter(r => r.category === category);
      if (categoryResults.length === 0) continue;

      lines.push(`### ${this.formatCategory(category)}`);
      lines.push('');
      lines.push('| Test ID | Name | Status | Duration |');
      lines.push('|---------|------|--------|----------|');

      for (const result of categoryResults) {
        const statusEmoji = this.getStatusEmoji(result.status);
        lines.push(`| ${result.testId} | ${result.testName} | ${statusEmoji} ${result.status} | ${result.durationMs}ms |`);
      }
      lines.push('');
    }

    // Failed Tests Details
    const failedResults = results.filter(r => r.status === 'failed' || r.status === 'error');
    if (failedResults.length > 0) {
      lines.push('## Failed Test Details');
      lines.push('');

      for (const result of failedResults) {
        lines.push(`### ${result.testId}: ${result.testName}`);
        lines.push('');
        lines.push(`**Status:** ${result.status}`);
        if (result.errorMessage) {
          lines.push(`**Error:** ${result.errorMessage}`);
        }
        lines.push('');

        if (result.findings.length > 0) {
          lines.push('**Findings:**');
          for (const finding of result.findings) {
            lines.push(`- **[${finding.severity.toUpperCase()}]** ${finding.title}`);
            lines.push(`  - ${finding.description}`);
            if (finding.recommendation) {
              lines.push(`  - *Recommendation:* ${finding.recommendation}`);
            }
          }
        }
        lines.push('');
      }
    }

    // Recommendations
    if (recommendations.length > 0) {
      lines.push('## Recommendations');
      lines.push('');
      lines.push('The following changes are recommended based on test failures:');
      lines.push('');

      for (const rec of recommendations) {
        lines.push(`### ${rec.title}`);
        lines.push('');
        lines.push(`**Priority:** ${rec.priority}/10`);
        lines.push(`**Type:** ${rec.type}`);
        lines.push(`**Affected Tests:** ${rec.affectedTests.join(', ')}`);
        lines.push('');
        lines.push('#### Problem');
        lines.push(rec.problem);
        lines.push('');
        lines.push('#### Solution');
        lines.push(rec.solution);
        lines.push('');

        if (rec.promptSuggestion) {
          lines.push('#### Flowise Prompt Update');
          lines.push('');
          lines.push(`**Location:** ${rec.promptSuggestion.location}`);
          lines.push(`**Change Type:** ${rec.promptSuggestion.changeType}`);
          lines.push('');
          lines.push('```text');
          lines.push(rec.promptSuggestion.suggestedText);
          lines.push('```');
          lines.push('');
        }

        if (rec.toolSuggestion) {
          lines.push('#### Function Tool Fix');
          lines.push('');
          lines.push(`**Tool:** ${rec.toolSuggestion.toolName}`);
          lines.push(`**Issue:** ${rec.toolSuggestion.issue}`);
          lines.push(`**Fix:** ${rec.toolSuggestion.fix}`);
          lines.push('');
        }

        lines.push('---');
        lines.push('');
      }
    }

    // Footer
    lines.push('---');
    lines.push('');
    lines.push('*Report generated by E2E Test Agent*');

    return lines.join('\n');
  }

  /**
   * Save report to file
   */
  saveReport(content: string, filename?: string): string {
    const dir = path.resolve(process.cwd(), config.output.reportsDir);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const name = filename || `report-${new Date().toISOString().slice(0, 10)}.md`;
    const filepath = path.join(dir, name);

    fs.writeFileSync(filepath, content, 'utf-8');

    return filepath;
  }

  /**
   * Generate transcript markdown
   */
  generateTranscriptMarkdown(testId: string, transcript: { role: string; content: string; timestamp: string; responseTimeMs?: number }[]): string {
    const lines: string[] = [];

    lines.push(`# Conversation Transcript: ${testId}`);
    lines.push('');
    lines.push(`**Generated:** ${new Date().toISOString()}`);
    lines.push('');
    lines.push('---');
    lines.push('');

    for (const turn of transcript) {
      const time = new Date(turn.timestamp).toLocaleTimeString();
      const role = turn.role === 'user' ? 'User' : 'AI';

      lines.push(`### ${role} (${time})`);
      lines.push('');
      lines.push(turn.content);
      lines.push('');

      if (turn.responseTimeMs && turn.role === 'assistant') {
        lines.push(`*Response time: ${turn.responseTimeMs}ms*`);
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  // Helpers

  private formatDuration(start: string, end: string): string {
    const ms = new Date(end).getTime() - new Date(start).getTime();
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  }

  private formatCategory(category: string): string {
    return category
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private getStatusEmoji(status: string): string {
    switch (status) {
      case 'passed': return '';
      case 'failed': return '';
      case 'error': return '';
      case 'skipped': return '';
      default: return '';
    }
  }
}

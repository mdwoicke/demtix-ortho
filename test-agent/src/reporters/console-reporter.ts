/**
 * Console Reporter
 * Displays test results in the terminal with colors
 */

import chalk from 'chalk';
import { TestCase } from '../tests/test-case';
import { TestResult, TestRun } from '../storage/database';
import { Recommendation } from '../analysis/recommendation-engine';

export class ConsoleReporter {
  /**
   * Print test start
   */
  printTestStart(testCase: TestCase): void {
    console.log(chalk.cyan(`\nRunning: ${testCase.id} - ${testCase.name}`));
    console.log(chalk.gray(`  Category: ${testCase.category}`));
    console.log(chalk.gray(`  Steps: ${testCase.steps.length}`));
  }

  /**
   * Print test result
   */
  printTestResult(result: TestResult): void {
    const statusIcon = this.getStatusIcon(result.status);
    const statusColor = this.getStatusColor(result.status);

    console.log(statusColor(`${statusIcon} ${result.testId}: ${result.testName}`));
    console.log(chalk.gray(`  Duration: ${result.durationMs}ms`));

    if (result.errorMessage) {
      console.log(chalk.red(`  Error: ${result.errorMessage}`));
    }

    if (result.findings.length > 0) {
      console.log(chalk.yellow(`  Findings: ${result.findings.length}`));
      for (const finding of result.findings.slice(0, 3)) {
        console.log(chalk.yellow(`    - [${finding.severity}] ${finding.title}`));
      }
      if (result.findings.length > 3) {
        console.log(chalk.yellow(`    ... and ${result.findings.length - 3} more`));
      }
    }
  }

  /**
   * Print test suite summary
   */
  printSummary(summary: { runId: string; totalTests: number; passed: number; failed: number; skipped: number; duration: number }): void {
    console.log('\n' + chalk.bold('═'.repeat(50)));
    console.log(chalk.bold('Test Summary'));
    console.log('═'.repeat(50));

    console.log(`Run ID: ${summary.runId}`);
    console.log(`Duration: ${(summary.duration / 1000).toFixed(2)}s`);
    console.log('');

    const passedPct = summary.totalTests > 0 ? ((summary.passed / summary.totalTests) * 100).toFixed(1) : 0;

    console.log(chalk.green(`  Passed:  ${summary.passed}`));
    console.log(chalk.red(`  Failed:  ${summary.failed}`));
    if (summary.skipped > 0) {
      console.log(chalk.yellow(`  Skipped: ${summary.skipped}`));
    }
    console.log(chalk.bold(`  Total:   ${summary.totalTests} (${passedPct}% pass rate)`));

    console.log('');

    if (summary.failed === 0) {
      console.log(chalk.green.bold('All tests passed!'));
    } else {
      console.log(chalk.red.bold(`${summary.failed} test(s) failed.`));
      console.log(chalk.yellow('Run "npx ts-node src/index.ts recommendations" to see suggested fixes.'));
    }

    console.log('═'.repeat(50) + '\n');
  }

  /**
   * Print recommendations
   */
  printRecommendations(recommendations: Recommendation[]): void {
    if (recommendations.length === 0) {
      console.log(chalk.green('\nNo recommendations - all tests passed!'));
      return;
    }

    console.log('\n' + chalk.bold.yellow('═'.repeat(50)));
    console.log(chalk.bold.yellow('Recommendations'));
    console.log(chalk.yellow('═'.repeat(50)));

    for (const rec of recommendations) {
      const priorityColor = rec.priority >= 8 ? chalk.red : rec.priority >= 5 ? chalk.yellow : chalk.blue;

      console.log('');
      console.log(priorityColor(`[Priority ${rec.priority}/10] ${rec.title}`));
      console.log(chalk.gray(`  Type: ${rec.type}`));
      console.log(chalk.gray(`  Affected: ${rec.affectedTests.join(', ')}`));
      console.log('');
      console.log(chalk.white(`  Problem: ${rec.problem}`));
      console.log(chalk.green(`  Solution: ${rec.solution}`));

      if (rec.promptSuggestion) {
        console.log('');
        console.log(chalk.cyan(`  Flowise Update (${rec.promptSuggestion.location}):`));
        console.log(chalk.gray('  ' + '-'.repeat(40)));
        const lines = rec.promptSuggestion.suggestedText.split('\n');
        for (const line of lines) {
          console.log(chalk.white(`  ${line}`));
        }
        console.log(chalk.gray('  ' + '-'.repeat(40)));
      }
    }

    console.log(chalk.yellow('\n' + '═'.repeat(50)));
    console.log(chalk.yellow(`Total: ${recommendations.length} recommendation(s)`));
    console.log(chalk.gray('Run "npx ts-node src/index.ts report --format markdown" for detailed report.'));
    console.log('');
  }

  /**
   * Print transcript
   */
  printTranscript(testId: string, transcript: { role: string; content: string; timestamp: string; responseTimeMs?: number }[]): void {
    console.log('\n' + chalk.bold(`Transcript for ${testId}`));
    console.log('─'.repeat(50));

    for (const turn of transcript) {
      const time = new Date(turn.timestamp).toLocaleTimeString();
      const roleColor = turn.role === 'user' ? chalk.blue : chalk.green;
      const roleLabel = turn.role === 'user' ? 'USER' : 'AI';

      console.log('');
      console.log(roleColor.bold(`[${time}] ${roleLabel}:`));

      // Wrap content at 70 chars
      const words = turn.content.split(' ');
      let line = '';
      for (const word of words) {
        if (line.length + word.length > 70) {
          console.log(chalk.white(`  ${line}`));
          line = word;
        } else {
          line = line ? `${line} ${word}` : word;
        }
      }
      if (line) {
        console.log(chalk.white(`  ${line}`));
      }

      if (turn.responseTimeMs && turn.role === 'assistant') {
        console.log(chalk.gray(`  (${turn.responseTimeMs}ms)`));
      }
    }

    console.log('\n' + '─'.repeat(50));
  }

  /**
   * Print progress during test run
   */
  printProgress(current: number, total: number, testId: string): void {
    const pct = Math.round((current / total) * 100);
    const bar = '█'.repeat(Math.round(pct / 5)) + '░'.repeat(20 - Math.round(pct / 5));
    process.stdout.write(`\r${chalk.cyan(`[${bar}]`)} ${pct}% - ${testId}`);
  }

  /**
   * Print error
   */
  printError(message: string): void {
    console.error(chalk.red.bold(`\nError: ${message}\n`));
  }

  /**
   * Print info
   */
  printInfo(message: string): void {
    console.log(chalk.blue(`Info: ${message}`));
  }

  /**
   * Print success
   */
  printSuccess(message: string): void {
    console.log(chalk.green.bold(`Success: ${message}`));
  }

  // Helpers

  private getStatusIcon(status: string): string {
    switch (status) {
      case 'passed': return '✓';
      case 'failed': return '✗';
      case 'error': return '!';
      case 'skipped': return '○';
      default: return '?';
    }
  }

  private getStatusColor(status: string): (text: string) => string {
    switch (status) {
      case 'passed': return (t) => chalk.green(t);
      case 'failed': return (t) => chalk.red(t);
      case 'error': return (t) => chalk.red.bold(t);
      case 'skipped': return (t) => chalk.yellow(t);
      default: return (t) => chalk.gray(t);
    }
  }
}

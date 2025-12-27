"use strict";
/**
 * Console Reporter
 * Displays test results in the terminal with colors
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsoleReporter = void 0;
const chalk_1 = __importDefault(require("chalk"));
class ConsoleReporter {
    /**
     * Print test start
     */
    printTestStart(testCase) {
        console.log(chalk_1.default.cyan(`\nRunning: ${testCase.id} - ${testCase.name}`));
        console.log(chalk_1.default.gray(`  Category: ${testCase.category}`));
        console.log(chalk_1.default.gray(`  Steps: ${testCase.steps.length}`));
    }
    /**
     * Print test result
     */
    printTestResult(result) {
        const statusIcon = this.getStatusIcon(result.status);
        const statusColor = this.getStatusColor(result.status);
        console.log(statusColor(`${statusIcon} ${result.testId}: ${result.testName}`));
        console.log(chalk_1.default.gray(`  Duration: ${result.durationMs}ms`));
        if (result.errorMessage) {
            console.log(chalk_1.default.red(`  Error: ${result.errorMessage}`));
        }
        if (result.findings.length > 0) {
            console.log(chalk_1.default.yellow(`  Findings: ${result.findings.length}`));
            for (const finding of result.findings.slice(0, 3)) {
                console.log(chalk_1.default.yellow(`    - [${finding.severity}] ${finding.title}`));
            }
            if (result.findings.length > 3) {
                console.log(chalk_1.default.yellow(`    ... and ${result.findings.length - 3} more`));
            }
        }
    }
    /**
     * Print test suite summary
     */
    printSummary(summary) {
        console.log('\n' + chalk_1.default.bold('═'.repeat(50)));
        console.log(chalk_1.default.bold('Test Summary'));
        console.log('═'.repeat(50));
        console.log(`Run ID: ${summary.runId}`);
        console.log(`Duration: ${(summary.duration / 1000).toFixed(2)}s`);
        console.log('');
        const passedPct = summary.totalTests > 0 ? ((summary.passed / summary.totalTests) * 100).toFixed(1) : 0;
        console.log(chalk_1.default.green(`  Passed:  ${summary.passed}`));
        console.log(chalk_1.default.red(`  Failed:  ${summary.failed}`));
        if (summary.skipped > 0) {
            console.log(chalk_1.default.yellow(`  Skipped: ${summary.skipped}`));
        }
        console.log(chalk_1.default.bold(`  Total:   ${summary.totalTests} (${passedPct}% pass rate)`));
        console.log('');
        if (summary.failed === 0) {
            console.log(chalk_1.default.green.bold('All tests passed!'));
        }
        else {
            console.log(chalk_1.default.red.bold(`${summary.failed} test(s) failed.`));
            console.log(chalk_1.default.yellow('Run "npx ts-node src/index.ts recommendations" to see suggested fixes.'));
        }
        console.log('═'.repeat(50) + '\n');
    }
    /**
     * Print recommendations
     */
    printRecommendations(recommendations) {
        if (recommendations.length === 0) {
            console.log(chalk_1.default.green('\nNo recommendations - all tests passed!'));
            return;
        }
        console.log('\n' + chalk_1.default.bold.yellow('═'.repeat(50)));
        console.log(chalk_1.default.bold.yellow('Recommendations'));
        console.log(chalk_1.default.yellow('═'.repeat(50)));
        for (const rec of recommendations) {
            const priorityColor = rec.priority >= 8 ? chalk_1.default.red : rec.priority >= 5 ? chalk_1.default.yellow : chalk_1.default.blue;
            console.log('');
            console.log(priorityColor(`[Priority ${rec.priority}/10] ${rec.title}`));
            console.log(chalk_1.default.gray(`  Type: ${rec.type}`));
            console.log(chalk_1.default.gray(`  Affected: ${rec.affectedTests.join(', ')}`));
            console.log('');
            console.log(chalk_1.default.white(`  Problem: ${rec.problem}`));
            console.log(chalk_1.default.green(`  Solution: ${rec.solution}`));
            if (rec.promptSuggestion) {
                console.log('');
                console.log(chalk_1.default.cyan(`  Flowise Update (${rec.promptSuggestion.location}):`));
                console.log(chalk_1.default.gray('  ' + '-'.repeat(40)));
                const lines = rec.promptSuggestion.suggestedText.split('\n');
                for (const line of lines) {
                    console.log(chalk_1.default.white(`  ${line}`));
                }
                console.log(chalk_1.default.gray('  ' + '-'.repeat(40)));
            }
        }
        console.log(chalk_1.default.yellow('\n' + '═'.repeat(50)));
        console.log(chalk_1.default.yellow(`Total: ${recommendations.length} recommendation(s)`));
        console.log(chalk_1.default.gray('Run "npx ts-node src/index.ts report --format markdown" for detailed report.'));
        console.log('');
    }
    /**
     * Print transcript
     */
    printTranscript(testId, transcript) {
        console.log('\n' + chalk_1.default.bold(`Transcript for ${testId}`));
        console.log('─'.repeat(50));
        for (const turn of transcript) {
            const time = new Date(turn.timestamp).toLocaleTimeString();
            const roleColor = turn.role === 'user' ? chalk_1.default.blue : chalk_1.default.green;
            const roleLabel = turn.role === 'user' ? 'USER' : 'AI';
            console.log('');
            console.log(roleColor.bold(`[${time}] ${roleLabel}:`));
            // Wrap content at 70 chars
            const words = turn.content.split(' ');
            let line = '';
            for (const word of words) {
                if (line.length + word.length > 70) {
                    console.log(chalk_1.default.white(`  ${line}`));
                    line = word;
                }
                else {
                    line = line ? `${line} ${word}` : word;
                }
            }
            if (line) {
                console.log(chalk_1.default.white(`  ${line}`));
            }
            if (turn.responseTimeMs && turn.role === 'assistant') {
                console.log(chalk_1.default.gray(`  (${turn.responseTimeMs}ms)`));
            }
        }
        console.log('\n' + '─'.repeat(50));
    }
    /**
     * Print progress during test run
     */
    printProgress(current, total, testId) {
        const pct = Math.round((current / total) * 100);
        const bar = '█'.repeat(Math.round(pct / 5)) + '░'.repeat(20 - Math.round(pct / 5));
        process.stdout.write(`\r${chalk_1.default.cyan(`[${bar}]`)} ${pct}% - ${testId}`);
    }
    /**
     * Print error
     */
    printError(message) {
        console.error(chalk_1.default.red.bold(`\nError: ${message}\n`));
    }
    /**
     * Print info
     */
    printInfo(message) {
        console.log(chalk_1.default.blue(`Info: ${message}`));
    }
    /**
     * Print success
     */
    printSuccess(message) {
        console.log(chalk_1.default.green.bold(`Success: ${message}`));
    }
    // Helpers
    getStatusIcon(status) {
        switch (status) {
            case 'passed': return '✓';
            case 'failed': return '✗';
            case 'error': return '!';
            case 'skipped': return '○';
            default: return '?';
        }
    }
    getStatusColor(status) {
        switch (status) {
            case 'passed': return (t) => chalk_1.default.green(t);
            case 'failed': return (t) => chalk_1.default.red(t);
            case 'error': return (t) => chalk_1.default.red.bold(t);
            case 'skipped': return (t) => chalk_1.default.yellow(t);
            default: return (t) => chalk_1.default.gray(t);
        }
    }
}
exports.ConsoleReporter = ConsoleReporter;
//# sourceMappingURL=console-reporter.js.map
/**
 * Agent Failure Analyzer
 * Analyzes test failures to determine root cause and generate fixes
 * Uses LLM Analysis Service for deep analysis
 */

import { v4 as uuidv4 } from 'uuid';
import { Database, TestResult, GeneratedFix, ApiCall } from '../storage/database';
import { ConversationTurn, Finding, ConversationStep } from '../tests/test-case';
import {
  LLMAnalysisService,
  FailureContext,
  AnalysisResult,
  PromptFix,
  ToolFix,
  llmAnalysisService,
} from '../services/llm-analysis-service';

// ============================================================================
// Types
// ============================================================================

export interface FailedTest {
  testId: string;
  testName: string;
  category: string;
  failedStep: ConversationStep;
  errorMessage: string;
  transcript: ConversationTurn[];
  apiCalls: ApiCall[];
  findings: Finding[];
}

export interface AnalyzerOptions {
  useLLM?: boolean;           // Use LLM analysis (default: true if available)
  maxConcurrent?: number;     // Max concurrent LLM calls (default: 3)
  saveToDatabase?: boolean;   // Save results to database (default: true)
}

export interface AnalysisReport {
  runId: string;
  analyzedAt: string;
  totalFailures: number;
  analyzedCount: number;
  generatedFixes: GeneratedFix[];
  summary: {
    promptFixes: number;
    toolFixes: number;
    highConfidenceFixes: number;
    rootCauseBreakdown: Record<string, number>;
  };
}

// ============================================================================
// Agent Failure Analyzer
// ============================================================================

export class AgentFailureAnalyzer {
  private db: Database;
  private llmService: LLMAnalysisService;

  constructor(db: Database) {
    this.db = db;
    this.llmService = llmAnalysisService;
  }

  /**
   * Analyze all failures from a test run
   */
  async analyzeRun(runId: string, options: AnalyzerOptions = {}): Promise<AnalysisReport> {
    const {
      useLLM = this.llmService.isAvailable(),
      maxConcurrent = 3,
      saveToDatabase = true,
    } = options;

    console.log(`\n[AgentFailureAnalyzer] Analyzing run: ${runId}`);
    console.log(`  LLM Analysis: ${useLLM ? 'ENABLED' : 'DISABLED (rule-based only)'}`);

    // Get failed tests
    const failedTestIds = this.db.getFailedTestIds(runId);
    const testResults = this.db.getTestResults(runId);

    if (failedTestIds.length === 0) {
      console.log('  No failures to analyze');
      return this.createEmptyReport(runId);
    }

    console.log(`  Found ${failedTestIds.length} failed test(s)`);

    // Build failure contexts
    const failureContexts = await this.buildFailureContexts(runId, failedTestIds, testResults);

    // Analyze failures
    const allFixes: GeneratedFix[] = [];
    const rootCauseBreakdown: Record<string, number> = {};
    let analyzedCount = 0;

    for (const context of failureContexts) {
      try {
        console.log(`  Analyzing: ${context.testId} - ${context.stepId}`);

        let result: AnalysisResult;

        if (useLLM) {
          result = await this.llmService.analyzeFailure(context);
        } else {
          result = this.llmService.generateRuleBasedAnalysis(context);
        }

        // Track root cause
        const causeType = result.rootCause.type;
        rootCauseBreakdown[causeType] = (rootCauseBreakdown[causeType] || 0) + 1;

        // Convert fixes to GeneratedFix format
        const generatedFixes = this.convertToGeneratedFixes(
          result.fixes,
          runId,
          context.testId,
          result.rootCause
        );

        allFixes.push(...generatedFixes);
        analyzedCount++;

        console.log(`    Root cause: ${causeType} (confidence: ${(result.rootCause.confidence * 100).toFixed(0)}%)`);
        console.log(`    Generated ${generatedFixes.length} fix(es)`);

      } catch (error) {
        console.error(`  Failed to analyze ${context.testId}:`, error);
      }
    }

    // Deduplicate fixes
    const deduplicatedFixes = this.deduplicateFixes(allFixes);

    // Save to database if requested
    if (saveToDatabase && deduplicatedFixes.length > 0) {
      this.db.saveGeneratedFixes(deduplicatedFixes);
      console.log(`\n  Saved ${deduplicatedFixes.length} fix(es) to database`);
    }

    // Build report
    const report: AnalysisReport = {
      runId,
      analyzedAt: new Date().toISOString(),
      totalFailures: failedTestIds.length,
      analyzedCount,
      generatedFixes: deduplicatedFixes,
      summary: {
        promptFixes: deduplicatedFixes.filter(f => f.type === 'prompt').length,
        toolFixes: deduplicatedFixes.filter(f => f.type === 'tool').length,
        highConfidenceFixes: deduplicatedFixes.filter(f => f.confidence >= 0.8).length,
        rootCauseBreakdown,
      },
    };

    return report;
  }

  /**
   * Analyze a single failed test
   */
  async analyzeTest(
    runId: string,
    testId: string,
    options: AnalyzerOptions = {}
  ): Promise<GeneratedFix[]> {
    const { useLLM = this.llmService.isAvailable() } = options;

    const testResults = this.db.getTestResults(runId);
    const testResult = testResults.find(r => r.testId === testId);

    if (!testResult) {
      throw new Error(`Test ${testId} not found in run ${runId}`);
    }

    const contexts = await this.buildFailureContexts(runId, [testId], testResults);
    if (contexts.length === 0) {
      return [];
    }

    const context = contexts[0];
    let result: AnalysisResult;

    if (useLLM) {
      result = await this.llmService.analyzeFailure(context);
    } else {
      result = this.llmService.generateRuleBasedAnalysis(context);
    }

    return this.convertToGeneratedFixes(
      result.fixes,
      runId,
      testId,
      result.rootCause
    );
  }

  private async buildFailureContexts(
    runId: string,
    failedTestIds: string[],
    testResults: TestResult[]
  ): Promise<FailureContext[]> {
    const contexts: FailureContext[] = [];

    for (const testId of failedTestIds) {
      const result = testResults.find(r => r.testId === testId);
      if (!result) continue;

      // Get transcript
      const transcript = this.db.getTranscript(testId, runId);

      // Get API calls
      const apiCalls = this.db.getApiCalls(testId, runId);

      // Get findings
      const findings = this.db.getFindings(runId).filter(
        (f: any) => f.testId === testId || !f.testId
      );

      // Find the failed step from the error message
      const stepMatch = result.errorMessage?.match(/step[- ]?(\d+|[a-z-]+)/i);
      const failedStepId = stepMatch ? stepMatch[0].replace(/\s+/g, '-').toLowerCase() : 'unknown';

      // Extract expected pattern from error
      const patternMatch = result.errorMessage?.match(/patterns?:\s*(.+)/i);
      const expectedPattern = patternMatch ? patternMatch[1] : 'unknown';

      contexts.push({
        testId,
        testName: result.testName,
        stepId: failedStepId,
        stepDescription: result.errorMessage || '',
        expectedPattern,
        transcript,
        apiCalls,
        errorMessage: result.errorMessage,
        findings: findings as Finding[],
      });
    }

    return contexts;
  }

  private convertToGeneratedFixes(
    fixes: (PromptFix | ToolFix)[],
    runId: string,
    testId: string,
    rootCause: { type: string; evidence: string[] }
  ): GeneratedFix[] {
    return fixes.map(fix => ({
      fixId: `fix-${uuidv4().slice(0, 8)}`,
      runId,
      type: fix.type,
      targetFile: fix.targetFile,
      changeDescription: fix.changeDescription,
      changeCode: fix.changeCode,
      location: fix.location,
      priority: fix.priority,
      confidence: fix.confidence,
      affectedTests: [testId],
      rootCause: {
        type: rootCause.type,
        evidence: rootCause.evidence,
      },
      status: 'pending' as const,
      createdAt: new Date().toISOString(),
    }));
  }

  private deduplicateFixes(fixes: GeneratedFix[]): GeneratedFix[] {
    const seen = new Map<string, GeneratedFix>();

    for (const fix of fixes) {
      const key = `${fix.targetFile}:${fix.changeDescription}`;
      const existing = seen.get(key);

      if (!existing) {
        seen.set(key, fix);
      } else {
        // Merge affected tests
        const mergedTests = [...new Set([...existing.affectedTests, ...fix.affectedTests])];
        existing.affectedTests = mergedTests;

        // Keep higher confidence
        if (fix.confidence > existing.confidence) {
          existing.confidence = fix.confidence;
          existing.changeCode = fix.changeCode;
        }
      }
    }

    // Sort by priority then confidence
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return Array.from(seen.values()).sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return b.confidence - a.confidence;
    });
  }

  private createEmptyReport(runId: string): AnalysisReport {
    return {
      runId,
      analyzedAt: new Date().toISOString(),
      totalFailures: 0,
      analyzedCount: 0,
      generatedFixes: [],
      summary: {
        promptFixes: 0,
        toolFixes: 0,
        highConfidenceFixes: 0,
        rootCauseBreakdown: {},
      },
    };
  }

  /**
   * Get pending fixes for review
   */
  getPendingFixes(runId?: string): GeneratedFix[] {
    return this.db.getGeneratedFixes(runId, 'pending');
  }

  /**
   * Get all fixes grouped by type
   */
  getFixesByType(runId?: string): { prompt: GeneratedFix[]; tool: GeneratedFix[] } {
    const fixes = this.db.getGeneratedFixes(runId);
    return {
      prompt: fixes.filter(f => f.type === 'prompt'),
      tool: fixes.filter(f => f.type === 'tool'),
    };
  }

  /**
   * Mark a fix as applied
   */
  markFixApplied(fixId: string): void {
    this.db.updateFixStatus(fixId, 'applied');
  }

  /**
   * Mark a fix as rejected
   */
  markFixRejected(fixId: string): void {
    this.db.updateFixStatus(fixId, 'rejected');
  }

  /**
   * Record the outcome of an applied fix
   */
  recordFixOutcome(
    fixId: string,
    testsBefore: string[],
    testsAfter: string[],
    notes?: string
  ): void {
    const effective = testsAfter.length < testsBefore.length;

    this.db.saveFixOutcome({
      fixId,
      appliedAt: new Date().toISOString(),
      testsBefore,
      testsAfter,
      effective,
      notes,
    });

    // Update fix status based on outcome
    if (effective) {
      this.db.updateFixStatus(fixId, 'verified');
    }
  }
}

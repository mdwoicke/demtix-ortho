"use strict";
/**
 * Agent Failure Analyzer
 * Analyzes test failures to determine root cause and generate fixes
 * Uses LLM Analysis Service for deep analysis
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentFailureAnalyzer = void 0;
const uuid_1 = require("uuid");
const llm_analysis_service_1 = require("../services/llm-analysis-service");
// ============================================================================
// Agent Failure Analyzer
// ============================================================================
class AgentFailureAnalyzer {
    constructor(db) {
        this.db = db;
        this.llmService = llm_analysis_service_1.llmAnalysisService;
    }
    /**
     * Analyze all failures from a test run
     */
    async analyzeRun(runId, options = {}) {
        const { useLLM = this.llmService.isAvailable(), maxConcurrent = 3, saveToDatabase = true, } = options;
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
        const allFixes = [];
        const rootCauseBreakdown = {};
        let analyzedCount = 0;
        for (const context of failureContexts) {
            try {
                console.log(`  Analyzing: ${context.testId} - ${context.stepId}`);
                let result;
                if (useLLM) {
                    result = await this.llmService.analyzeFailure(context);
                }
                else {
                    result = this.llmService.generateRuleBasedAnalysis(context);
                }
                // Track root cause
                const causeType = result.rootCause.type;
                rootCauseBreakdown[causeType] = (rootCauseBreakdown[causeType] || 0) + 1;
                // Convert fixes to GeneratedFix format
                const generatedFixes = this.convertToGeneratedFixes(result.fixes, runId, context.testId, result.rootCause);
                allFixes.push(...generatedFixes);
                analyzedCount++;
                console.log(`    Root cause: ${causeType} (confidence: ${(result.rootCause.confidence * 100).toFixed(0)}%)`);
                console.log(`    Generated ${generatedFixes.length} fix(es)`);
            }
            catch (error) {
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
        const report = {
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
    async analyzeTest(runId, testId, options = {}) {
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
        let result;
        if (useLLM) {
            result = await this.llmService.analyzeFailure(context);
        }
        else {
            result = this.llmService.generateRuleBasedAnalysis(context);
        }
        return this.convertToGeneratedFixes(result.fixes, runId, testId, result.rootCause);
    }
    async buildFailureContexts(runId, failedTestIds, testResults) {
        const contexts = [];
        for (const testId of failedTestIds) {
            const result = testResults.find(r => r.testId === testId);
            if (!result)
                continue;
            // Get transcript
            const transcript = this.db.getTranscript(testId, runId);
            // Get API calls
            const apiCalls = this.db.getApiCalls(testId, runId);
            // Get findings
            const findings = this.db.getFindings(runId).filter((f) => f.testId === testId || !f.testId);
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
                findings: findings,
            });
        }
        return contexts;
    }
    convertToGeneratedFixes(fixes, runId, testId, rootCause) {
        return fixes.map(fix => ({
            fixId: `fix-${(0, uuid_1.v4)().slice(0, 8)}`,
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
            status: 'pending',
            createdAt: new Date().toISOString(),
        }));
    }
    deduplicateFixes(fixes) {
        if (fixes.length === 0)
            return [];
        // Group fixes by target file first
        const byFile = new Map();
        for (const fix of fixes) {
            const existing = byFile.get(fix.targetFile) || [];
            existing.push(fix);
            byFile.set(fix.targetFile, existing);
        }
        const deduplicatedFixes = [];
        // Process each file group
        for (const [_targetFile, fileFixes] of byFile) {
            const merged = this.mergeOverlappingFixes(fileFixes);
            deduplicatedFixes.push(...merged);
        }
        // Sort by priority then confidence
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return deduplicatedFixes.sort((a, b) => {
            const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
            if (priorityDiff !== 0)
                return priorityDiff;
            return b.confidence - a.confidence;
        });
    }
    /**
     * Merge fixes that semantically overlap (address the same issue)
     * Uses key phrase extraction and similarity scoring
     */
    mergeOverlappingFixes(fixes) {
        if (fixes.length <= 1)
            return fixes;
        // Extract key phrases from each fix
        const fixesWithPhrases = fixes.map(fix => ({
            fix,
            phrases: this.extractKeyPhrases(fix.changeDescription),
            codeSignature: this.extractCodeSignature(fix.changeCode),
        }));
        // Find groups of similar fixes
        const groups = [];
        const used = new Set();
        for (let i = 0; i < fixesWithPhrases.length; i++) {
            if (used.has(i))
                continue;
            const group = [fixesWithPhrases[i].fix];
            used.add(i);
            for (let j = i + 1; j < fixesWithPhrases.length; j++) {
                if (used.has(j))
                    continue;
                const similarity = this.calculateFixSimilarity(fixesWithPhrases[i], fixesWithPhrases[j]);
                // If similarity is above threshold, they're addressing the same issue
                if (similarity >= 0.4) {
                    group.push(fixesWithPhrases[j].fix);
                    used.add(j);
                    console.log(`    [Dedup] Merging overlapping fixes (similarity: ${(similarity * 100).toFixed(0)}%):`);
                    console.log(`      - "${fixesWithPhrases[i].fix.changeDescription.slice(0, 60)}..."`);
                    console.log(`      - "${fixesWithPhrases[j].fix.changeDescription.slice(0, 60)}..."`);
                }
            }
            groups.push(group);
        }
        // For each group, keep the best fix and merge affected tests
        return groups.map(group => this.selectBestFix(group));
    }
    /**
     * Extract key phrases from a fix description for comparison
     */
    extractKeyPhrases(description) {
        const phrases = new Set();
        const text = description.toLowerCase();
        // Extract quoted phrases (e.g., 'anything else', 'Yes')
        const quotedMatches = text.match(/['"]([^'"]+)['"]/g) || [];
        quotedMatches.forEach(m => phrases.add(m.replace(/['"]/g, '').trim()));
        // Extract key concept words (filtering out common words)
        const stopWords = new Set([
            'add', 'for', 'to', 'the', 'a', 'an', 'in', 'of', 'and', 'or', 'with',
            'when', 'that', 'this', 'is', 'are', 'be', 'been', 'being', 'have', 'has',
            'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may',
            'might', 'must', 'shall', 'can', 'need', 'explicit', 'new', 'handling',
            'handle', 'rule', 'exception', 'context', 'response', 'responses',
        ]);
        // Extract meaningful words
        const words = text
            .replace(/['"]/g, ' ')
            .split(/\s+/)
            .filter(w => w.length > 2 && !stopWords.has(w));
        words.forEach(w => phrases.add(w));
        // Extract bigrams (two-word phrases) for better matching
        for (let i = 0; i < words.length - 1; i++) {
            phrases.add(`${words[i]} ${words[i + 1]}`);
        }
        return phrases;
    }
    /**
     * Extract a signature from the code change for comparison
     */
    extractCodeSignature(code) {
        const signature = new Set();
        const text = code.toLowerCase();
        // Extract XML section names
        const sectionMatches = text.match(/<([a-z_]+)[^>]*>/gi) || [];
        sectionMatches.forEach(m => {
            const name = m.replace(/<\/?|\s.*|>/g, '');
            if (name)
                signature.add(`section:${name}`);
        });
        // Extract function names
        const funcMatches = text.match(/function\s+(\w+)/gi) || [];
        funcMatches.forEach(m => {
            const name = m.replace(/function\s+/i, '');
            if (name)
                signature.add(`func:${name}`);
        });
        // Extract case statements
        const caseMatches = text.match(/case\s+['"]([^'"]+)['"]/gi) || [];
        caseMatches.forEach(m => {
            const name = m.replace(/case\s+['"]/i, '').replace(/['"]$/, '');
            if (name)
                signature.add(`case:${name}`);
        });
        // Extract quoted strings that might be key identifiers
        const quotedMatches = text.match(/['"]([^'"]{3,30})['"]/g) || [];
        quotedMatches.forEach(m => {
            const content = m.replace(/['"]/g, '').trim();
            if (content && !content.includes(' ')) {
                signature.add(`id:${content}`);
            }
        });
        return signature;
    }
    /**
     * Calculate similarity between two fixes
     * Returns a score from 0 to 1
     */
    calculateFixSimilarity(fix1, fix2) {
        // Must be same type (prompt/tool) to be considered similar
        if (fix1.fix.type !== fix2.fix.type)
            return 0;
        // Calculate phrase overlap (Jaccard similarity)
        const phraseIntersection = new Set([...fix1.phrases].filter(x => fix2.phrases.has(x)));
        const phraseUnion = new Set([...fix1.phrases, ...fix2.phrases]);
        const phraseSimilarity = phraseUnion.size > 0
            ? phraseIntersection.size / phraseUnion.size
            : 0;
        // Calculate code signature overlap
        const codeIntersection = new Set([...fix1.codeSignature].filter(x => fix2.codeSignature.has(x)));
        const codeUnion = new Set([...fix1.codeSignature, ...fix2.codeSignature]);
        const codeSimilarity = codeUnion.size > 0
            ? codeIntersection.size / codeUnion.size
            : 0;
        // Check for same location (section/function)
        let locationMatch = 0;
        if (fix1.fix.location && fix2.fix.location) {
            if (fix1.fix.location.section && fix1.fix.location.section === fix2.fix.location.section) {
                locationMatch = 0.3;
            }
            if (fix1.fix.location.function && fix1.fix.location.function === fix2.fix.location.function) {
                locationMatch = 0.3;
            }
        }
        // Weighted combination
        // Phrase similarity is most important for detecting semantic overlap
        const similarity = (phraseSimilarity * 0.5) + (codeSimilarity * 0.3) + locationMatch;
        return Math.min(similarity, 1);
    }
    /**
     * Select the best fix from a group of similar fixes
     * Merges affected tests from all fixes
     */
    selectBestFix(group) {
        if (group.length === 1)
            return group[0];
        // Sort by priority (critical first) then confidence (highest first)
        const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        const sorted = [...group].sort((a, b) => {
            const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
            if (priorityDiff !== 0)
                return priorityDiff;
            return b.confidence - a.confidence;
        });
        // Take the best one
        const best = { ...sorted[0] };
        // Merge affected tests from all fixes in the group
        const allAffectedTests = new Set();
        for (const fix of group) {
            fix.affectedTests.forEach(t => allAffectedTests.add(t));
        }
        best.affectedTests = Array.from(allAffectedTests);
        // Slightly boost confidence when multiple similar fixes were generated
        // (suggests higher agreement on the issue)
        if (group.length > 1) {
            best.confidence = Math.min(best.confidence + 0.05, 1);
        }
        return best;
    }
    createEmptyReport(runId) {
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
    getPendingFixes(runId) {
        return this.db.getGeneratedFixes(runId, 'pending');
    }
    /**
     * Get all fixes grouped by type
     */
    getFixesByType(runId) {
        const fixes = this.db.getGeneratedFixes(runId);
        return {
            prompt: fixes.filter(f => f.type === 'prompt'),
            tool: fixes.filter(f => f.type === 'tool'),
        };
    }
    /**
     * Mark a fix as applied
     */
    markFixApplied(fixId) {
        this.db.updateFixStatus(fixId, 'applied');
    }
    /**
     * Mark a fix as rejected
     */
    markFixRejected(fixId) {
        this.db.updateFixStatus(fixId, 'rejected');
    }
    /**
     * Record the outcome of an applied fix
     */
    recordFixOutcome(fixId, testsBefore, testsAfter, notes) {
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
exports.AgentFailureAnalyzer = AgentFailureAnalyzer;
//# sourceMappingURL=agent-failure-analyzer.js.map
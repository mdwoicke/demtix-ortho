"use strict";
/**
 * LLM Analysis Service
 * Uses Claude API to analyze test failures and generate fix recommendations
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.llmAnalysisService = exports.LLMAnalysisService = void 0;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const config_1 = require("../config/config");
// ============================================================================
// LLM Analysis Service
// ============================================================================
class LLMAnalysisService {
    constructor() {
        this.client = null;
        this.systemPromptContent = '';
        this.schedulingToolContent = '';
        this.patientToolContent = '';
        this.initializeClient();
        this.loadSourceFiles();
    }
    initializeClient() {
        // Try multiple token sources
        const token = process.env.CLAUDE_CODE_OAUTH_TOKEN ||
            process.env.ANTHROPIC_API_KEY;
        if (token) {
            this.client = new sdk_1.default({ apiKey: token });
            const source = process.env.CLAUDE_CODE_OAUTH_TOKEN ? 'CLAUDE_CODE_OAUTH_TOKEN' : 'ANTHROPIC_API_KEY';
            console.log(`[LLMAnalysisService] Initialized with ${source}`);
        }
        else {
            console.log('[LLMAnalysisService] No API token found (tried CLAUDE_CODE_OAUTH_TOKEN, ANTHROPIC_API_KEY)');
            console.log('[LLMAnalysisService] LLM analysis disabled - using rule-based analysis only');
        }
    }
    loadSourceFiles() {
        const baseDir = path.resolve(__dirname, '../..');
        try {
            const promptPath = path.resolve(baseDir, config_1.config.agentTuning.systemPromptPath);
            if (fs.existsSync(promptPath)) {
                this.systemPromptContent = fs.readFileSync(promptPath, 'utf-8');
            }
        }
        catch (e) {
            console.warn('Could not load system prompt file');
        }
        try {
            const schedulingPath = path.resolve(baseDir, config_1.config.agentTuning.schedulingToolPath);
            if (fs.existsSync(schedulingPath)) {
                this.schedulingToolContent = fs.readFileSync(schedulingPath, 'utf-8');
            }
        }
        catch (e) {
            console.warn('Could not load scheduling tool file');
        }
        try {
            const patientPath = path.resolve(baseDir, config_1.config.agentTuning.patientToolPath);
            if (fs.existsSync(patientPath)) {
                this.patientToolContent = fs.readFileSync(patientPath, 'utf-8');
            }
        }
        catch (e) {
            console.warn('Could not load patient tool file');
        }
    }
    /**
     * Check if the service is available (API key configured)
     */
    isAvailable() {
        return this.client !== null;
    }
    /**
     * Analyze a test failure and generate fix recommendations
     */
    async analyzeFailure(context) {
        if (!this.client) {
            throw new Error('LLM Analysis Service not available - set CLAUDE_CODE_OAUTH_TOKEN or ANTHROPIC_API_KEY');
        }
        const prompt = this.buildAnalysisPrompt(context);
        try {
            const response = await this.client.messages.create({
                model: config_1.config.llmAnalysis.model,
                max_tokens: config_1.config.llmAnalysis.maxTokens,
                temperature: config_1.config.llmAnalysis.temperature,
                messages: [
                    {
                        role: 'user',
                        content: prompt,
                    },
                ],
            }, {
                timeout: config_1.config.llmAnalysis.timeout, // 2 minute timeout
            });
            const responseText = response.content[0].type === 'text'
                ? response.content[0].text
                : '';
            return this.parseAnalysisResponse(responseText, context);
        }
        catch (error) {
            // Handle timeout specifically
            if (error.name === 'APIConnectionTimeoutError' || error.message?.includes('timeout')) {
                console.error(`LLM Analysis timed out after ${config_1.config.llmAnalysis.timeout}ms - falling back to rule-based analysis`);
                return this.generateRuleBasedAnalysis(context);
            }
            console.error('LLM Analysis failed:', error);
            throw error;
        }
    }
    /**
     * Analyze multiple failures and deduplicate fixes
     */
    async analyzeMultipleFailures(contexts) {
        const analyses = new Map();
        const allFixes = [];
        for (const context of contexts) {
            try {
                const result = await this.analyzeFailure(context);
                analyses.set(context.testId, result);
                allFixes.push(...result.fixes);
            }
            catch (error) {
                console.error(`Failed to analyze ${context.testId}:`, error);
            }
        }
        // Deduplicate fixes based on target file and change description
        const deduplicatedFixes = this.deduplicateFixes(allFixes);
        return { analyses, deduplicatedFixes };
    }
    buildAnalysisPrompt(context) {
        const transcriptSummary = context.transcript
            .slice(-10) // Last 10 turns
            .map(t => `[${t.role}]: ${t.content.substring(0, 500)}${t.content.length > 500 ? '...' : ''}`)
            .join('\n\n');
        const apiCallsSummary = context.apiCalls
            .slice(-5) // Last 5 API calls
            .map(call => {
            const req = call.requestPayload ? JSON.parse(call.requestPayload) : null;
            const res = call.responsePayload ? JSON.parse(call.responsePayload) : null;
            return `Tool: ${call.toolName}\nRequest: ${JSON.stringify(req, null, 2)?.substring(0, 300)}\nResponse: ${JSON.stringify(res, null, 2)?.substring(0, 300)}`;
        })
            .join('\n---\n');
        const findingsSummary = context.findings
            .map(f => `[${f.severity}] ${f.title}: ${f.description}`)
            .join('\n');
        return `You are an expert at debugging AI chatbot failures. You are analyzing a test failure for "Allie IVA", an orthodontic appointment scheduling chatbot.

## SYSTEM PROMPT BEING TESTED (excerpt - key sections)
${this.systemPromptContent.substring(0, 8000)}
${this.systemPromptContent.length > 8000 ? '\n... [truncated]' : ''}

## SCHEDULING TOOL CODE (excerpt)
${this.schedulingToolContent.substring(0, 4000)}
${this.schedulingToolContent.length > 4000 ? '\n... [truncated]' : ''}

## PATIENT TOOL CODE (excerpt)
${this.patientToolContent.substring(0, 4000)}
${this.patientToolContent.length > 4000 ? '\n... [truncated]' : ''}

---

## TEST FAILURE DETAILS

**Test:** ${context.testId} - ${context.testName}
**Failed Step:** ${context.stepId} - ${context.stepDescription}
**Error:** ${context.errorMessage || 'Pattern mismatch'}

**Expected Pattern:** ${context.expectedPattern}
${context.unexpectedPatterns ? `**Unexpected Patterns Found:** ${context.unexpectedPatterns.join(', ')}` : ''}

## CONVERSATION TRANSCRIPT (last 10 turns)
${transcriptSummary}

## API/TOOL CALLS MADE
${apiCallsSummary || 'No API calls recorded'}

## EXISTING FINDINGS
${findingsSummary || 'No findings recorded'}

---

## YOUR TASK

1. **Identify the ROOT CAUSE** of this failure. Categorize it as one of:
   - \`prompt-gap\`: Missing instruction in the system prompt
   - \`prompt-conflict\`: Conflicting instructions in the system prompt
   - \`tool-bug\`: Bug in the tool code (missing default, wrong parsing, etc.)
   - \`tool-missing-default\`: Tool needs a default value for a parameter
   - \`llm-hallucination\`: LLM generated unexpected response despite correct instructions
   - \`test-issue\`: The test expectation is wrong, not the agent

2. **Generate SPECIFIC FIXES** with:
   - Target file (system prompt or tool file)
   - Exact location (section name, function name, or line to insert after)
   - Complete replacement/addition code
   - Confidence score (0.0 to 1.0)
   - Priority (critical, high, medium, low)

3. Respond in this exact JSON format:
\`\`\`json
{
  "rootCause": {
    "type": "prompt-gap|prompt-conflict|tool-bug|tool-missing-default|llm-hallucination|test-issue",
    "evidence": ["evidence 1", "evidence 2"],
    "confidence": 0.85,
    "explanation": "Brief explanation of why this is the root cause"
  },
  "fixes": [
    {
      "type": "prompt",
      "fixType": "add-rule|add-example|clarify-instruction|ban-word|add-phase-step|fix-format-spec",
      "targetFile": "docs/Chord_Cloud9_SystemPrompt.md",
      "location": {
        "section": "Phase 7: Scheduling",
        "afterLine": "ALWAYS check availability before offering times"
      },
      "changeDescription": "Add rule to always mention checking availability",
      "changeCode": "- ALWAYS say 'Let me check availability for you' before calling the slots API",
      "priority": "high",
      "confidence": 0.9,
      "reasoning": "The agent skipped the availability check language"
    }
  ],
  "summary": "One sentence summary of the issue and fix"
}
\`\`\`

Be specific and actionable. Generate complete code that can be directly applied.`;
    }
    parseAnalysisResponse(responseText, context) {
        // Extract JSON from response (handle markdown code blocks)
        const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) ||
            responseText.match(/\{[\s\S]*"rootCause"[\s\S]*\}/);
        if (!jsonMatch) {
            // Return a fallback result if parsing fails
            return this.createFallbackResult(context, responseText);
        }
        try {
            const jsonStr = jsonMatch[1] || jsonMatch[0];
            const parsed = JSON.parse(jsonStr);
            // Validate and normalize the parsed result
            const rootCause = {
                type: parsed.rootCause?.type || 'prompt-gap',
                evidence: parsed.rootCause?.evidence || [],
                confidence: parsed.rootCause?.confidence || 0.5,
                explanation: parsed.rootCause?.explanation || 'Unknown',
            };
            const fixes = (parsed.fixes || []).map((fix) => {
                if (fix.type === 'prompt') {
                    return {
                        type: 'prompt',
                        fixType: fix.fixType || 'add-rule',
                        targetFile: fix.targetFile || 'docs/Chord_Cloud9_SystemPrompt.md',
                        location: fix.location || { section: 'Unknown' },
                        changeDescription: fix.changeDescription || '',
                        changeCode: fix.changeCode || '',
                        priority: fix.priority || 'medium',
                        confidence: fix.confidence || 0.5,
                        reasoning: fix.reasoning || '',
                    };
                }
                else {
                    return {
                        type: 'tool',
                        fixType: fix.fixType || 'add-default',
                        targetFile: fix.targetFile || 'docs/chord_dso_scheduling-StepwiseSearch.js',
                        location: fix.location || {},
                        changeDescription: fix.changeDescription || '',
                        changeCode: fix.changeCode || '',
                        priority: fix.priority || 'medium',
                        confidence: fix.confidence || 0.5,
                        reasoning: fix.reasoning || '',
                    };
                }
            });
            return {
                rootCause,
                fixes,
                summary: parsed.summary || 'Analysis complete',
            };
        }
        catch (error) {
            return this.createFallbackResult(context, responseText);
        }
    }
    createFallbackResult(context, responseText) {
        return {
            rootCause: {
                type: 'prompt-gap',
                evidence: ['Unable to parse LLM response'],
                confidence: 0.3,
                explanation: `Analysis failed to parse. Raw response excerpt: ${responseText.substring(0, 500)}`,
            },
            fixes: [],
            summary: 'Analysis failed - manual review required',
        };
    }
    deduplicateFixes(fixes) {
        const seen = new Map();
        for (const fix of fixes) {
            const key = `${fix.targetFile}:${fix.changeDescription}`;
            const existing = seen.get(key);
            if (!existing || fix.confidence > existing.confidence) {
                seen.set(key, fix);
            }
        }
        // Sort by confidence descending
        return Array.from(seen.values()).sort((a, b) => b.confidence - a.confidence);
    }
    /**
     * Generate a quick analysis without full LLM call (for testing/fallback)
     */
    generateRuleBasedAnalysis(context) {
        const fixes = [];
        let rootCauseType = 'prompt-gap';
        const evidence = [];
        // Check for common patterns
        const lastAssistantMessage = context.transcript
            .filter(t => t.role === 'assistant')
            .pop()?.content || '';
        // Check for banned words
        const bannedWords = ['sorry', 'error', 'problem', 'unable', 'cannot', 'failed'];
        for (const word of bannedWords) {
            if (lastAssistantMessage.toLowerCase().includes(word)) {
                evidence.push(`Agent used banned word: "${word}"`);
                fixes.push({
                    type: 'prompt',
                    fixType: 'ban-word',
                    targetFile: 'docs/Chord_Cloud9_SystemPrompt.md',
                    location: { section: 'Positive_Language_Rule' },
                    changeDescription: `Add explicit ban for "${word}"`,
                    changeCode: `- NEVER say "${word}" - use positive alternatives instead`,
                    priority: 'high',
                    confidence: 0.9,
                    reasoning: `Agent used banned word "${word}" in response`,
                });
            }
        }
        // Check for tool issues in API calls
        for (const call of context.apiCalls) {
            if (call.responsePayload?.includes('error') || call.status === 'error') {
                rootCauseType = 'tool-bug';
                evidence.push(`Tool call ${call.toolName} returned error`);
                // Check for common parameter issues
                const request = call.requestPayload ? JSON.parse(call.requestPayload) : {};
                if (request.appointmentTypeGUID === '' || request.appointmentTypeGUID === null) {
                    fixes.push({
                        type: 'tool',
                        fixType: 'add-default',
                        targetFile: 'docs/chord_dso_scheduling-StepwiseSearch.js',
                        location: { function: 'book_child' },
                        changeDescription: 'Add default appointmentTypeGUID',
                        changeCode: `const appointmentTypeGUID = params.appointmentTypeGUID || CLOUD9.defaultApptTypeGUID;`,
                        priority: 'critical',
                        confidence: 0.95,
                        reasoning: 'Empty appointmentTypeGUID causing booking failure',
                    });
                }
            }
        }
        return {
            rootCause: {
                type: rootCauseType,
                evidence,
                confidence: evidence.length > 0 ? 0.7 : 0.3,
                explanation: evidence.length > 0
                    ? evidence.join('; ')
                    : 'No specific pattern detected - manual review needed',
            },
            fixes,
            summary: fixes.length > 0
                ? `Found ${fixes.length} potential fix(es) based on pattern analysis`
                : 'No automatic fixes generated - LLM analysis recommended',
        };
    }
}
exports.LLMAnalysisService = LLMAnalysisService;
// Singleton instance
exports.llmAnalysisService = new LLMAnalysisService();
//# sourceMappingURL=llm-analysis-service.js.map
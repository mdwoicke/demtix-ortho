"use strict";
/**
 * LLM Analysis Service
 * Uses Claude API or CLI to analyze test failures and generate fix recommendations
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.llmAnalysisService = exports.LLMAnalysisService = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const config_1 = require("../config/config");
const llm_provider_1 = require("../../../shared/services/llm-provider");
const llm_config_1 = require("../../../shared/config/llm-config");
// ============================================================================
// LLM Analysis Service
// ============================================================================
class LLMAnalysisService {
    constructor() {
        this.systemPromptContent = '';
        this.schedulingToolContent = '';
        this.patientToolContent = '';
        this.llmProvider = (0, llm_provider_1.getLLMProvider)();
        this.loadSourceFiles();
        this.logInitialization();
    }
    async logInitialization() {
        const mode = (0, llm_config_1.isClaudeCliEnabled)() ? 'CLI' : 'API';
        const status = await this.llmProvider.checkAvailability();
        if (status.available) {
            console.log(`[LLMAnalysisService] Initialized with ${mode} mode (provider: ${status.provider})`);
        }
        else {
            console.log(`[LLMAnalysisService] ${mode} mode configured but not available: ${status.error}`);
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
     * Check if the service is available (API key or CLI configured)
     */
    isAvailable() {
        return this.llmProvider.isAvailable();
    }
    /**
     * Analyze a test failure and generate fix recommendations
     */
    async analyzeFailure(context) {
        const status = await this.llmProvider.checkAvailability();
        if (!status.available) {
            throw new Error(`LLM Analysis Service not available: ${status.error}`);
        }
        const prompt = this.buildAnalysisPrompt(context);
        try {
            const response = await this.llmProvider.execute({
                prompt,
                model: config_1.config.llmAnalysis.model,
                maxTokens: config_1.config.llmAnalysis.maxTokens,
                temperature: config_1.config.llmAnalysis.temperature,
                timeout: config_1.config.llmAnalysis.timeout,
            });
            if (!response.success) {
                // Handle timeout or other errors
                if (response.error?.includes('timeout')) {
                    console.error(`LLM Analysis timed out after ${config_1.config.llmAnalysis.timeout}ms - falling back to rule-based analysis`);
                    return this.generateRuleBasedAnalysis(context);
                }
                throw new Error(response.error || 'LLM Analysis failed');
            }
            const responseText = response.content || '';
            console.log(`[LLMAnalysisService] Analysis completed via ${response.provider} in ${response.durationMs}ms`);
            return this.parseAnalysisResponse(responseText, context);
        }
        catch (error) {
            // Handle timeout specifically
            if (error.message?.includes('timeout')) {
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

### Step 0: DECISION FRAMEWORK CLASSIFICATION (Critical First Step!)

Before analyzing the root cause, you MUST classify this failure using the "Golden Rule":

**Answer these two questions:**
1. **Would a REAL USER say what the test agent said?**
   - Look at the user messages in the transcript
   - Would an actual parent calling to schedule an appointment respond this way?
   - Consider if the user response is natural, realistic, and what you'd expect from a real caller

2. **Did the BOT respond appropriately to the user's input?**
   - Given what the user said, is the bot's response reasonable?
   - Did the bot understand the user's intent?
   - Did the bot guide the conversation properly?

**Classification Rules:**
- **Bot Issue** (fix the Flowise prompt): Real user WOULD say this, but bot responded WRONG
- **Test Agent Issue** (fix the test agent): Test agent behavior is UNREALISTIC
- **Both** (fix bot FIRST): Both have problems, but bot fix takes priority

### Step 1: IDENTIFY ROOT CAUSE

Categorize as one of:
   - \`prompt-gap\`: Missing instruction in the system prompt
   - \`prompt-conflict\`: Conflicting instructions in the system prompt
   - \`tool-bug\`: Bug in the tool code (missing default, wrong parsing, etc.)
   - \`tool-missing-default\`: Tool needs a default value for a parameter
   - \`llm-hallucination\`: LLM generated unexpected response despite correct instructions
   - \`test-issue\`: The test expectation is wrong, not the agent

### Step 2: GENERATE SPECIFIC FIXES with:
   - Target file (system prompt or tool file)
   - Exact location (section name, function name, or line to insert after)
   - Complete replacement/addition code
   - Confidence score (0.0 to 1.0)
   - Priority (critical, high, medium, low)

### Step 3: Respond in this exact JSON format:
\`\`\`json
{
  "classification": {
    "issueLocation": "bot|test-agent|both",
    "confidence": 0.9,
    "reasoning": "Brief explanation of why this classification",
    "userBehaviorRealistic": true,
    "botResponseAppropriate": false
  },
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

**IMPORTANT:** The classification field is REQUIRED. Always assess user behavior realism and bot response appropriateness before generating fixes.

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
            // Parse classification (new Decision Framework field)
            const classification = parsed.classification ? {
                issueLocation: parsed.classification.issueLocation || 'bot',
                confidence: parsed.classification.confidence || 0.5,
                reasoning: parsed.classification.reasoning || 'No reasoning provided',
                userBehaviorRealistic: parsed.classification.userBehaviorRealistic ?? true,
                botResponseAppropriate: parsed.classification.botResponseAppropriate ?? false,
            } : undefined;
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
                classification,
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
        // Default classification for rule-based analysis: assume bot issue
        // since we can't assess user behavior realism without LLM
        // Note: rootCauseType can only be 'prompt-gap' or 'tool-bug', never 'test-issue'
        const classification = {
            issueLocation: 'bot', // Rule-based analysis always assumes bot issue
            confidence: 0.6,
            reasoning: 'Rule-based classification - LLM analysis recommended for accurate assessment',
            userBehaviorRealistic: true, // Assume user behavior is OK in rule-based
            botResponseAppropriate: false, // Assume bot has issue since test failed
        };
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
            classification,
        };
    }
}
exports.LLMAnalysisService = LLMAnalysisService;
// Singleton instance
exports.llmAnalysisService = new LLMAnalysisService();
//# sourceMappingURL=llm-analysis-service.js.map
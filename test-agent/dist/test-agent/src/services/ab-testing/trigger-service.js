"use strict";
/**
 * Trigger Service for A/B Testing
 *
 * Implements selective triggering logic to determine when fixes should be A/B tested.
 * Not every change warrants testing - this service assesses impact and recommends
 * which fixes should go through the A/B testing process.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.TriggerService = void 0;
/**
 * Core sections in system prompts that warrant A/B testing when modified
 */
const CORE_PROMPT_SECTIONS = [
    'conversation_flow',
    'conversation flow',
    'tool_usage',
    'tool usage',
    'response_format',
    'response format',
    'transfer_guidelines',
    'transfer',
    'core_objectives',
    'core objectives',
    'greeting',
    'booking',
    'scheduling',
    'patient_identification',
    'patient identification',
    'error_handling',
    'error handling',
];
/**
 * Critical functions in tool files that warrant A/B testing
 */
const CRITICAL_TOOL_FUNCTIONS = [
    'executeRequest',
    'book_child',
    'bookAppointment',
    'create',
    'createPatient',
    'slots',
    'grouped_slots',
    'getAvailableSlots',
    'search',
    'lookup',
    'lookupPatient',
];
/**
 * Flow categories for impact assessment
 */
const FLOW_MAPPINGS = {
    'booking': ['booking', 'scheduling', 'appointment', 'slots', 'book_child'],
    'data-collection': ['patient', 'information', 'caller', 'identification', 'name', 'phone'],
    'transfer': ['transfer', 'live_agent', 'handoff', 'escalation'],
    'insurance': ['insurance', 'verification', 'coverage', 'policy'],
    'greeting': ['greeting', 'welcome', 'introduction', 'opening'],
    'confirmation': ['confirmation', 'summary', 'recap', 'details'],
};
class TriggerService {
    constructor(db) {
        this.db = db;
    }
    /**
     * Assess whether a fix warrants A/B testing
     * This is the main selective triggering logic
     */
    assessFixImpact(fix) {
        const assessment = {
            shouldTest: false,
            impactLevel: 'minimal',
            reason: '',
            affectedTests: fix.affectedTests || [],
            affectedFlows: [],
            suggestedMinSampleSize: 10,
        };
        // HIGH IMPACT: System prompt changes to core behavior
        if (this.isPromptFile(fix.targetFile)) {
            const coreSection = this.isCorePromptSection(fix);
            if (coreSection) {
                assessment.impactLevel = 'high';
                assessment.shouldTest = true;
                assessment.reason = `Core system prompt section modified: ${coreSection}`;
                assessment.affectedFlows = this.getAffectedFlows(coreSection);
                assessment.suggestedMinSampleSize = 20;
                return assessment;
            }
        }
        // HIGH IMPACT: Tool logic changes to critical functions
        if (fix.type === 'tool') {
            const criticalFunction = this.isCriticalToolFunction(fix);
            if (criticalFunction) {
                assessment.impactLevel = 'high';
                assessment.shouldTest = true;
                assessment.reason = `Critical function modified: ${criticalFunction}`;
                assessment.affectedFlows = this.getAffectedFlowsFromFunction(criticalFunction);
                assessment.suggestedMinSampleSize = 20;
                return assessment;
            }
        }
        // MEDIUM IMPACT: Model or temperature changes (config type)
        if (fix.type === 'tool' && this.isConfigChange(fix)) {
            assessment.impactLevel = 'medium';
            assessment.shouldTest = true;
            assessment.reason = 'Configuration parameter changed';
            assessment.suggestedMinSampleSize = 15;
            return assessment;
        }
        // MEDIUM IMPACT: Non-core sections with high confidence
        if (this.isPromptFile(fix.targetFile) && fix.confidence >= 0.7) {
            assessment.impactLevel = 'medium';
            assessment.shouldTest = true;
            assessment.reason = 'Prompt modification with high confidence';
            assessment.suggestedMinSampleSize = 15;
            return assessment;
        }
        // LOW IMPACT: Cosmetic/wording changes with very high confidence
        if (this.isCosmeticChange(fix)) {
            if (fix.confidence >= 0.8) {
                assessment.impactLevel = 'low';
                assessment.shouldTest = true;
                assessment.reason = 'Minor wording/clarification change with high confidence';
                assessment.suggestedMinSampleSize = 10;
                return assessment;
            }
            else {
                assessment.impactLevel = 'minimal';
                assessment.shouldTest = false;
                assessment.reason = 'Low confidence cosmetic change - skip A/B testing';
                return assessment;
            }
        }
        // MINIMAL IMPACT: Single test affected + low confidence
        if (fix.affectedTests.length <= 1 && fix.confidence < 0.6) {
            assessment.impactLevel = 'minimal';
            assessment.shouldTest = false;
            assessment.reason = 'Low confidence fix affecting single test - skip A/B testing';
            return assessment;
        }
        // Default: Test medium+ confidence fixes affecting multiple tests
        if (fix.confidence >= 0.5 && fix.affectedTests.length >= 2) {
            assessment.impactLevel = 'medium';
            assessment.shouldTest = true;
            assessment.reason = 'Moderate confidence fix affecting multiple tests';
            assessment.suggestedMinSampleSize = 15;
        }
        else {
            assessment.impactLevel = 'low';
            assessment.shouldTest = false;
            assessment.reason = 'Low impact change - skip A/B testing';
        }
        return assessment;
    }
    /**
     * Generate A/B test recommendation for a fix
     */
    generateABRecommendation(fix) {
        const impact = this.assessFixImpact(fix);
        if (!impact.shouldTest) {
            return null;
        }
        return {
            fix,
            impactLevel: impact.impactLevel,
            reason: impact.reason,
            suggestedExperiment: {
                name: this.generateExperimentName(fix),
                hypothesis: this.generateHypothesis(fix, impact),
                testIds: impact.affectedTests.length > 0 ? impact.affectedTests : this.getDefaultTestIds(fix),
                minSampleSize: impact.suggestedMinSampleSize,
            },
        };
    }
    /**
     * Generate A/B recommendations for multiple fixes
     */
    generateABRecommendations(fixes) {
        const recommendations = [];
        for (const fix of fixes) {
            const recommendation = this.generateABRecommendation(fix);
            if (recommendation) {
                recommendations.push(recommendation);
            }
        }
        // Sort by impact level (high first)
        const impactOrder = {
            'high': 0,
            'medium': 1,
            'low': 2,
            'minimal': 3,
        };
        return recommendations.sort((a, b) => impactOrder[a.impactLevel] - impactOrder[b.impactLevel]);
    }
    /**
     * Check if pass rate has dropped significantly
     */
    checkPassRateDrop(threshold = 0.1) {
        const alerts = [];
        const recentRuns = this.db.getRecentRuns(10);
        if (recentRuns.length < 2) {
            return alerts;
        }
        // Compare latest run to previous runs average
        const [latest, ...previous] = recentRuns;
        const previousRates = previous
            .filter(r => r.totalTests > 0)
            .map(r => r.passed / r.totalTests);
        if (previousRates.length === 0) {
            return alerts;
        }
        const avgPreviousRate = previousRates.reduce((a, b) => a + b, 0) / previousRates.length;
        const currentRate = latest.totalTests > 0 ? latest.passed / latest.totalTests : 0;
        const drop = avgPreviousRate - currentRate;
        if (drop >= threshold) {
            alerts.push({
                runId: latest.runId,
                previousRate: avgPreviousRate,
                currentRate,
                dropPercentage: drop * 100,
                severity: drop >= 0.2 ? 'high' : 'medium',
            });
        }
        return alerts;
    }
    // ============================================================================
    // PRIVATE HELPER METHODS
    // ============================================================================
    isPromptFile(targetFile) {
        return (targetFile.endsWith('.md') ||
            targetFile.includes('SystemPrompt') ||
            targetFile.includes('Prompt'));
    }
    isCorePromptSection(fix) {
        const section = fix.location?.section?.toLowerCase() || '';
        const description = fix.changeDescription.toLowerCase();
        const code = fix.changeCode.toLowerCase();
        for (const coreSection of CORE_PROMPT_SECTIONS) {
            if (section.includes(coreSection) ||
                description.includes(coreSection) ||
                code.includes(coreSection)) {
                return coreSection;
            }
        }
        return null;
    }
    isCriticalToolFunction(fix) {
        const fn = fix.location?.function || '';
        const description = fix.changeDescription.toLowerCase();
        for (const criticalFn of CRITICAL_TOOL_FUNCTIONS) {
            if (fn === criticalFn || description.includes(criticalFn.toLowerCase())) {
                return criticalFn;
            }
        }
        return null;
    }
    isConfigChange(fix) {
        const description = fix.changeDescription.toLowerCase();
        const code = fix.changeCode.toLowerCase();
        const configIndicators = [
            'temperature',
            'model',
            'max_tokens',
            'timeout',
            'retry',
            'config',
            'parameter',
        ];
        return configIndicators.some(indicator => description.includes(indicator) || code.includes(indicator));
    }
    isCosmeticChange(fix) {
        const description = fix.changeDescription.toLowerCase();
        const cosmeticIndicators = [
            'clarify',
            'wording',
            'typo',
            'formatting',
            'capitalization',
            'punctuation',
            'grammar',
            'spelling',
            'rephrase',
            'reword',
        ];
        return cosmeticIndicators.some(indicator => description.includes(indicator));
    }
    getAffectedFlows(section) {
        const flows = [];
        const sectionLower = section.toLowerCase();
        for (const [flow, keywords] of Object.entries(FLOW_MAPPINGS)) {
            if (keywords.some(keyword => sectionLower.includes(keyword))) {
                flows.push(flow);
            }
        }
        return flows;
    }
    getAffectedFlowsFromFunction(fn) {
        const flows = [];
        const fnLower = fn.toLowerCase();
        for (const [flow, keywords] of Object.entries(FLOW_MAPPINGS)) {
            if (keywords.some(keyword => fnLower.includes(keyword))) {
                flows.push(flow);
            }
        }
        return flows.length > 0 ? flows : ['booking']; // Default to booking for tool functions
    }
    getDefaultTestIds(fix) {
        // If no affected tests provided, suggest running all goal tests
        // This could be enhanced to select tests based on affected flows
        const affectedFlows = this.getAffectedFlows(fix.location?.section || fix.changeDescription);
        // Map flows to likely test IDs
        const testIdPatterns = {
            'booking': ['GOAL-HAPPY-001', 'GOAL-HAPPY-002'],
            'data-collection': ['GOAL-HAPPY-001', 'GOAL-EDGE-001'],
            'transfer': ['GOAL-ERR-001'],
            'greeting': ['GOAL-HAPPY-001'],
        };
        const testIds = new Set();
        for (const flow of affectedFlows) {
            const ids = testIdPatterns[flow] || [];
            ids.forEach(id => testIds.add(id));
        }
        return testIds.size > 0 ? Array.from(testIds) : ['GOAL-HAPPY-001'];
    }
    generateExperimentName(fix) {
        const type = fix.type.charAt(0).toUpperCase() + fix.type.slice(1);
        const shortDesc = fix.changeDescription.substring(0, 30).replace(/[^a-zA-Z0-9 ]/g, '');
        return `${type} Fix: ${shortDesc}`;
    }
    generateHypothesis(fix, impact) {
        const action = fix.type === 'prompt' ? 'updating the prompt' : 'modifying the tool logic';
        if (impact.affectedFlows.length > 0) {
            return `By ${action}, we expect to improve pass rate for ${impact.affectedFlows.join(', ')} related tests.`;
        }
        return `By ${action}, we expect to improve pass rate for affected tests.`;
    }
}
exports.TriggerService = TriggerService;
//# sourceMappingURL=trigger-service.js.map
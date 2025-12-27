"use strict";
/**
 * Recommendation Engine
 * Generates actionable recommendations from test results
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecommendationEngine = void 0;
class RecommendationEngine {
    constructor() {
        this.recommendations = [];
    }
    /**
     * Generate recommendations from test results
     */
    generateFromResults(results) {
        this.recommendations = [];
        // Group findings by type and similarity
        const findingGroups = this.groupFindings(results);
        // Generate recommendations for each group
        for (const group of findingGroups) {
            const recommendation = this.createRecommendation(group);
            if (recommendation) {
                this.recommendations.push(recommendation);
            }
        }
        // Sort by priority
        this.recommendations.sort((a, b) => b.priority - a.priority);
        return this.recommendations;
    }
    /**
     * Group similar findings together
     */
    groupFindings(results) {
        const groups = new Map();
        for (const result of results) {
            if (result.status !== 'failed' && result.status !== 'error')
                continue;
            for (const finding of result.findings) {
                const key = this.getFindingGroupKey(finding);
                if (!groups.has(key)) {
                    groups.set(key, {
                        type: finding.type,
                        severity: finding.severity,
                        findings: [],
                        affectedTests: [],
                    });
                }
                const group = groups.get(key);
                group.findings.push(finding);
                if (!group.affectedTests.includes(result.testId)) {
                    group.affectedTests.push(result.testId);
                }
            }
        }
        return Array.from(groups.values());
    }
    /**
     * Create a grouping key for a finding
     */
    getFindingGroupKey(finding) {
        // Group by type and a simplified description
        const simplifiedDesc = finding.title
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .split(/\s+/)
            .slice(0, 5)
            .join('-');
        return `${finding.type}:${simplifiedDesc}`;
    }
    /**
     * Create a recommendation from a group of findings
     */
    createRecommendation(group) {
        const primaryFinding = group.findings[0];
        const id = `REC-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
        // Determine recommendation type
        const recType = this.determineRecommendationType(primaryFinding);
        // Build evidence
        const evidence = group.findings.map(f => ({
            testId: group.affectedTests[0] || 'unknown',
            stepId: f.affectedStep,
            expected: f.expectedBehavior || 'Expected behavior not specified',
            actual: f.actualBehavior || 'Actual behavior not specified',
        }));
        // Calculate priority based on severity and frequency
        const priority = this.calculatePriority(group);
        // Generate solution based on finding type
        const solution = this.generateSolution(group, recType);
        const recommendation = {
            id,
            type: recType,
            priority,
            title: this.generateTitle(group),
            problem: primaryFinding.description,
            solution: solution.text,
            affectedTests: group.affectedTests,
            evidence,
        };
        // Add specific suggestions
        if (recType === 'flowise-prompt' && solution.promptSuggestion) {
            recommendation.promptSuggestion = solution.promptSuggestion;
        }
        if (recType === 'function-tool' && solution.toolSuggestion) {
            recommendation.toolSuggestion = solution.toolSuggestion;
        }
        return recommendation;
    }
    /**
     * Determine what type of fix is needed
     */
    determineRecommendationType(finding) {
        switch (finding.type) {
            case 'prompt-issue':
                return 'flowise-prompt';
            case 'tool-issue':
                return 'function-tool';
            case 'bug':
                // Could be prompt or backend
                if (finding.description.includes('API') || finding.description.includes('timeout')) {
                    return 'backend';
                }
                return 'flowise-prompt';
            default:
                return 'flowise-prompt';
        }
    }
    /**
     * Calculate priority score
     */
    calculatePriority(group) {
        let priority = 5; // Base priority
        // Adjust for severity
        switch (group.severity) {
            case 'critical':
                priority += 4;
                break;
            case 'high':
                priority += 3;
                break;
            case 'medium':
                priority += 1;
                break;
            case 'low':
                priority -= 1;
                break;
        }
        // Adjust for frequency
        if (group.affectedTests.length > 3)
            priority += 2;
        else if (group.affectedTests.length > 1)
            priority += 1;
        return Math.min(10, Math.max(1, priority));
    }
    /**
     * Generate a title for the recommendation
     */
    generateTitle(group) {
        const finding = group.findings[0];
        if (finding.title) {
            return finding.title;
        }
        // Generate based on type
        switch (group.type) {
            case 'prompt-issue':
                return 'Update Chatbot Response Behavior';
            case 'tool-issue':
                return 'Fix Function Tool Implementation';
            case 'bug':
                return 'Address Conversation Flow Issue';
            default:
                return 'Improve Chatbot Behavior';
        }
    }
    /**
     * Generate solution text and suggestions
     */
    generateSolution(group, recType) {
        const finding = group.findings[0];
        if (recType === 'flowise-prompt') {
            const suggestion = this.generatePromptSuggestion(finding);
            return {
                text: finding.recommendation || 'Update the system prompt to handle this case.',
                promptSuggestion: suggestion,
            };
        }
        if (recType === 'function-tool') {
            const suggestion = this.generateToolSuggestion(finding);
            return {
                text: finding.recommendation || 'Update the function tool implementation.',
                toolSuggestion: suggestion,
            };
        }
        return {
            text: finding.recommendation || 'Review and update the relevant component.',
        };
    }
    /**
     * Generate Flowise prompt suggestion
     */
    generatePromptSuggestion(finding) {
        // Analyze the finding to generate appropriate prompt update
        let location = 'System Prompt';
        let changeType = 'append';
        let suggestedText = '';
        // Pattern matching for common issues
        if (finding.description.includes('not found') || finding.description.includes('no results')) {
            location = 'Patient Search Agent > System Prompt';
            suggestedText = `
When searching for patients:
- Use fuzzy matching for partial names
- If no exact match found, show closest matches
- Ask user to clarify if multiple similar names exist
- Never just say "not found" without offering alternatives`;
        }
        else if (finding.description.includes('disambiguation') || finding.description.includes('multiple')) {
            location = 'Patient Search Agent > System Prompt';
            suggestedText = `
When multiple patients match the search:
- List all matching patients with distinguishing information (DOB, last visit)
- Ask user to select by number or provide more details
- Format the list clearly for easy selection`;
        }
        else if (finding.description.includes('confirm') || finding.description.includes('confirmation')) {
            location = 'Appointment Booking Agent > System Prompt';
            suggestedText = `
IMPORTANT: Before booking any appointment:
1. Always summarize: patient name, date/time, location, appointment type
2. Ask explicitly: "Should I book this appointment?"
3. Wait for clear confirmation before proceeding
4. Never book without explicit user confirmation`;
        }
        else if (finding.description.includes('cancel')) {
            location = 'Main Agent > System Prompt';
            suggestedText = `
Handle cancellation requests:
- Recognize keywords: cancel, stop, nevermind, forget it, start over
- Confirm cancellation: "Are you sure you want to cancel?"
- Reset conversation state when confirmed
- Offer to help with something else`;
        }
        else {
            // Generic suggestion
            suggestedText = finding.recommendation || 'Add specific handling for this scenario.';
        }
        return {
            location,
            currentBehavior: finding.actualBehavior || 'Current behavior not documented',
            suggestedText: suggestedText.trim(),
            changeType,
        };
    }
    /**
     * Generate function tool suggestion
     */
    generateToolSuggestion(finding) {
        let toolName = 'Unknown Tool';
        let issue = finding.description;
        let fix = finding.recommendation || 'Review tool implementation';
        // Try to identify the tool from the finding
        if (finding.affectedStep?.includes('search') || finding.description.includes('search')) {
            toolName = 'searchPatients';
            fix = 'Ensure the search function handles partial matches and returns helpful results even when exact match not found.';
        }
        else if (finding.affectedStep?.includes('location') || finding.description.includes('location')) {
            toolName = 'getLocations';
            fix = 'Verify location data is being returned correctly and formatted for display.';
        }
        else if (finding.affectedStep?.includes('book') || finding.description.includes('appointment')) {
            toolName = 'createAppointment';
            fix = 'Check that all required parameters are validated before attempting to create appointment.';
        }
        return { toolName, issue, fix };
    }
    /**
     * Format recommendations for display
     */
    formatForDisplay(recommendations) {
        let output = '# Recommendations Report\n\n';
        for (const rec of recommendations) {
            output += `## ${rec.title}\n\n`;
            output += `**Priority:** ${rec.priority}/10\n`;
            output += `**Type:** ${rec.type}\n`;
            output += `**Affected Tests:** ${rec.affectedTests.join(', ')}\n\n`;
            output += `### Problem\n${rec.problem}\n\n`;
            output += `### Solution\n${rec.solution}\n\n`;
            if (rec.promptSuggestion) {
                output += `### Flowise Prompt Update\n`;
                output += `**Location:** ${rec.promptSuggestion.location}\n`;
                output += `**Change Type:** ${rec.promptSuggestion.changeType}\n\n`;
                output += '```\n' + rec.promptSuggestion.suggestedText + '\n```\n\n';
            }
            if (rec.toolSuggestion) {
                output += `### Tool Fix\n`;
                output += `**Tool:** ${rec.toolSuggestion.toolName}\n`;
                output += `**Issue:** ${rec.toolSuggestion.issue}\n`;
                output += `**Fix:** ${rec.toolSuggestion.fix}\n\n`;
            }
            output += '---\n\n';
        }
        return output;
    }
}
exports.RecommendationEngine = RecommendationEngine;
//# sourceMappingURL=recommendation-engine.js.map
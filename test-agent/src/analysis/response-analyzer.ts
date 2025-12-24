/**
 * Response Analyzer
 * Analyzes chatbot responses for issues and quality
 */

import { ConversationTurn, Finding } from '../tests/test-case';

export interface AnalysisResult {
  score: number; // 0-100
  issues: Issue[];
  suggestions: string[];
}

export interface Issue {
  type: 'missing-context' | 'wrong-step' | 'hallucination' | 'tool-error' | 'timeout' | 'unclear' | 'unhelpful';
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  location?: string;
  suggestion?: string;
}

export class ResponseAnalyzer {
  private knownIssuePatterns: { pattern: RegExp; type: Issue['type']; severity: Issue['severity']; description: string }[] = [
    {
      pattern: /error|exception|failed to/i,
      type: 'tool-error',
      severity: 'high',
      description: 'Error message in response',
    },
    {
      pattern: /i don't know|i'm not sure|i cannot|i can't determine/i,
      type: 'unclear',
      severity: 'medium',
      description: 'Uncertain or unclear response',
    },
    {
      pattern: /timeout|timed out|took too long/i,
      type: 'timeout',
      severity: 'high',
      description: 'Operation timeout',
    },
    {
      pattern: /null|undefined|NaN/i,
      type: 'tool-error',
      severity: 'critical',
      description: 'Programming error leaked into response',
    },
  ];

  /**
   * Analyze a single response
   */
  analyzeResponse(response: string, context?: any): AnalysisResult {
    const issues: Issue[] = [];
    const suggestions: string[] = [];
    let score = 100;

    // Check for known issue patterns
    for (const knownIssue of this.knownIssuePatterns) {
      if (knownIssue.pattern.test(response)) {
        issues.push({
          type: knownIssue.type,
          severity: knownIssue.severity,
          description: knownIssue.description,
        });
        score -= this.getSeverityPenalty(knownIssue.severity);
      }
    }

    // Check response length
    if (response.length < 10) {
      issues.push({
        type: 'unhelpful',
        severity: 'medium',
        description: 'Response too short to be helpful',
        suggestion: 'Ensure prompts generate substantive responses',
      });
      score -= 10;
    }

    if (response.length > 2000) {
      issues.push({
        type: 'unclear',
        severity: 'low',
        description: 'Response very long, may overwhelm user',
        suggestion: 'Consider breaking into shorter, more focused responses',
      });
      score -= 5;
    }

    // Check for conversational quality
    if (!this.hasProperGreeting(response) && !context?.conversationStarted) {
      suggestions.push('Consider adding a friendly greeting to start conversations');
    }

    // Ensure score stays in bounds
    score = Math.max(0, Math.min(100, score));

    return { score, issues, suggestions };
  }

  /**
   * Analyze a full conversation transcript
   */
  analyzeConversation(transcript: ConversationTurn[]): AnalysisResult {
    const allIssues: Issue[] = [];
    const allSuggestions: string[] = [];
    let totalScore = 0;
    let responseCount = 0;

    for (const turn of transcript) {
      if (turn.role === 'assistant') {
        const result = this.analyzeResponse(turn.content, {
          conversationStarted: responseCount > 0,
        });
        allIssues.push(...result.issues);
        allSuggestions.push(...result.suggestions);
        totalScore += result.score;
        responseCount++;
      }
    }

    // Check conversation flow
    const flowIssues = this.analyzeConversationFlow(transcript);
    allIssues.push(...flowIssues);

    // Average score
    const averageScore = responseCount > 0 ? Math.round(totalScore / responseCount) : 0;

    // Deduplicate suggestions
    const uniqueSuggestions = [...new Set(allSuggestions)];

    return {
      score: averageScore,
      issues: allIssues,
      suggestions: uniqueSuggestions,
    };
  }

  /**
   * Analyze conversation flow for issues
   */
  private analyzeConversationFlow(transcript: ConversationTurn[]): Issue[] {
    const issues: Issue[] = [];

    // Check for repeated questions
    const assistantMessages = transcript
      .filter(t => t.role === 'assistant')
      .map(t => t.content.toLowerCase());

    for (let i = 1; i < assistantMessages.length; i++) {
      const current = assistantMessages[i];
      const previous = assistantMessages[i - 1];

      if (this.areSimilar(current, previous)) {
        issues.push({
          type: 'wrong-step',
          severity: 'medium',
          description: 'Chatbot repeated similar content',
          location: `Turn ${i + 1}`,
          suggestion: 'Check if context is being lost between turns',
        });
      }
    }

    // Check for abrupt topic changes
    // (simplified check - in reality would need more sophisticated analysis)

    return issues;
  }

  /**
   * Check if two responses are similar (potential repetition)
   */
  private areSimilar(a: string, b: string): boolean {
    // Simple check - could be made more sophisticated
    const wordsA = new Set(a.split(/\s+/));
    const wordsB = new Set(b.split(/\s+/));

    let common = 0;
    for (const word of wordsA) {
      if (wordsB.has(word)) common++;
    }

    const similarity = (common * 2) / (wordsA.size + wordsB.size);
    return similarity > 0.8; // 80% similar
  }

  /**
   * Check if response has proper greeting
   */
  private hasProperGreeting(response: string): boolean {
    const greetingPatterns = /^(hi|hello|hey|good\s+(morning|afternoon|evening)|welcome)/i;
    return greetingPatterns.test(response.trim());
  }

  /**
   * Get score penalty for severity level
   */
  private getSeverityPenalty(severity: Issue['severity']): number {
    switch (severity) {
      case 'critical': return 40;
      case 'high': return 25;
      case 'medium': return 15;
      case 'low': return 5;
    }
  }

  /**
   * Detect specific issues from failed tests
   */
  detectIssuesFromFailures(findings: Finding[]): Issue[] {
    return findings.map(f => ({
      type: this.mapFindingTypeToIssueType(f.type),
      severity: f.severity,
      description: f.description,
      location: f.affectedStep,
      suggestion: f.recommendation,
    }));
  }

  private mapFindingTypeToIssueType(findingType: Finding['type']): Issue['type'] {
    switch (findingType) {
      case 'bug': return 'tool-error';
      case 'prompt-issue': return 'unclear';
      case 'tool-issue': return 'tool-error';
      case 'regression': return 'wrong-step';
      default: return 'unclear';
    }
  }
}

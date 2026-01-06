/**
 * Shared Services Export Barrel
 */

// Claude CLI Service
export {
  ClaudeCliService,
  claudeCliService,
  type ClaudeCliRequest,
  type ClaudeCliResponse,
  type ClaudeCliStatus,
} from './claude-cli-service';

// LLM Provider
export {
  LLMProvider,
  getLLMProvider,
  resetLLMProvider,
  type LLMRequest,
  type LLMResponse,
  type LLMProviderStatus,
} from './llm-provider';

// Langfuse Service
export {
  LangfuseService,
  getLangfuseService,
  resetLangfuseService,
  safeLangfuse,
  getErrorSeverity,
  getErrorSeverityScore,
} from './langfuse-service';

// Langfuse Context
export {
  runWithTrace,
  getCurrentTraceContext,
  hasTraceContext,
  updateTraceContext,
  getCurrentTraceId,
  getCurrentRunId,
  getCurrentTestId,
  getCurrentSessionId,
  getCurrentParentObservationId,
  createTraceContext,
  createChildContext,
  withTestContext,
  withParentObservation,
  debugContext,
} from './langfuse-context';

// Langfuse Scorer
export {
  scoreTestResult,
  scoreSemanticEvaluation,
  scoreError,
  scoreAnalysisResult,
  scoreTestRun,
  submitScores,
  createTestPassedScore,
  createSemanticConfidenceScore,
  createErrorSeverityScore,
  createFixConfidenceScore,
  validateScore,
} from './langfuse-scorer';

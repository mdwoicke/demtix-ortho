/**
 * Goal-Oriented Test Case Types
 *
 * Main interface for defining goal-based tests.
 */
import type { UserPersona } from './persona';
import type { ConversationGoal, GoalContext, GoalResult } from './goals';
import type { ProgressState, ProgressIssue } from './progress';
import type { ConversationTurn, DataRequirement, TestContext } from '../test-case';
/**
 * Constraint types for test validation
 */
export type ConstraintType = 'must_happen' | 'must_not_happen' | 'max_turns' | 'max_time' | 'before' | 'after';
/**
 * A constraint on the conversation
 */
export interface TestConstraint {
    /** Type of constraint */
    type: ConstraintType;
    /** Human-readable description */
    description: string;
    /** For must_happen/must_not_happen: condition to check */
    condition?: (context: GoalContext) => boolean;
    /** For max_turns: maximum allowed turns */
    maxTurns?: number;
    /** For max_time: maximum allowed time in ms */
    maxTimeMs?: number;
    /** For before/after: the first event */
    firstEvent?: string;
    /** For before/after: the second event */
    secondEvent?: string;
    /** Severity if constraint is violated */
    severity: 'low' | 'medium' | 'high' | 'critical';
}
/**
 * Constraint violation result
 */
export interface ConstraintViolation {
    constraint: TestConstraint;
    message: string;
    turnNumber?: number;
}
/**
 * Configuration for response generation
 */
export interface ResponseConfig {
    /** Maximum turns before test fails */
    maxTurns: number;
    /** Whether to use LLM for response generation (vs templates) */
    useLlmResponses: boolean;
    /** Delay between responses in ms (simulates typing) */
    responseDelayMs?: number;
    /** How to handle unknown intents from agent */
    handleUnknownIntents: 'fail' | 'clarify' | 'generic';
    /** Temperature for LLM responses (0-1) */
    llmTemperature?: number;
}
/**
 * Default response configuration
 */
export declare const DEFAULT_RESPONSE_CONFIG: ResponseConfig;
/**
 * Goal-Oriented Test Case
 *
 * Replaces sequential ConversationStep[] with goal-based approach.
 */
export interface GoalOrientedTestCase {
    /** Unique identifier (e.g., 'GOAL-HAPPY-001') */
    id: string;
    /** Human-readable name */
    name: string;
    /** Description of what this test validates */
    description: string;
    /** Category for organization */
    category: 'happy-path' | 'edge-case' | 'error-handling';
    /** Tags for filtering */
    tags: string[];
    /** The test user persona */
    persona: UserPersona;
    /** Goals to achieve */
    goals: ConversationGoal[];
    /** Constraints on the conversation */
    constraints: TestConstraint[];
    /** Response generation configuration */
    responseConfig: ResponseConfig;
    /** Initial message to start the conversation */
    initialMessage: string | ((persona: UserPersona) => string);
    /** Data requirements from Cloud 9 (if any) */
    dataRequirements?: DataRequirement[];
    /** Setup function (runs before test) */
    setup?: (context: GoalTestContext) => Promise<void>;
    /** Teardown function (runs after test) */
    teardown?: (context: GoalTestContext) => Promise<void>;
}
/**
 * Extended context for goal-oriented tests
 */
export interface GoalTestContext extends TestContext {
    /** The test persona */
    persona: UserPersona;
    /** Current progress state */
    progress: ProgressState;
}
/**
 * Result of a goal-oriented test
 */
export interface GoalTestResult {
    /** Whether the test passed */
    passed: boolean;
    /** Results for each goal */
    goalResults: GoalResult[];
    /** Any constraint violations */
    constraintViolations: ConstraintViolation[];
    /** Human-readable summary */
    summary: string;
    /** Final progress state */
    progress: ProgressState;
    /** Full conversation transcript */
    transcript: ConversationTurn[];
    /** Number of turns taken */
    turnCount: number;
    /** Total duration in ms */
    durationMs: number;
    /** Issues detected during conversation */
    issues: ProgressIssue[];
    /** Error message if test errored */
    error?: string;
}
/**
 * Preset constraints for common validation needs
 */
export declare const PRESET_CONSTRAINTS: {
    /** No error messages should appear */
    noErrors: () => TestConstraint;
    /** No internal system information should be exposed */
    noInternalExposure: () => TestConstraint;
    /** Agent should not repeat the same question */
    noRepetition: () => TestConstraint;
    /** Maximum turns constraint */
    maxTurns: (turns: number) => TestConstraint;
    /** Maximum time constraint */
    maxTime: (ms: number) => TestConstraint;
};
/**
 * Helper to create a goal-oriented test case with defaults
 */
export declare function createGoalTest(config: Partial<GoalOrientedTestCase> & {
    id: string;
    name: string;
    persona: UserPersona;
    goals: ConversationGoal[];
    initialMessage: string;
}): GoalOrientedTestCase;
//# sourceMappingURL=goal-test.d.ts.map
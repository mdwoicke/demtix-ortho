/**
 * Goal-Oriented Happy Path Test Scenarios
 *
 * These tests define WHAT should be achieved, not the exact sequence.
 * The agent can ask questions in any order - the test adapts dynamically.
 *
 * Benefits over sequential tests:
 * - Tests pass regardless of question order
 * - Focus on outcomes (goals) rather than exact conversation flow
 * - Automatic response generation from persona data
 * - Better alignment with real-world conversation variability
 */
import type { GoalOrientedTestCase } from '../types/goal-test';
/**
 * GOAL-HAPPY-001: New Patient Single Child
 *
 * Goal-based version of HAPPY-001.
 * Instead of 15 fixed steps, this test:
 * - Sends initial message
 * - Responds to whatever the agent asks (in any order)
 * - Passes when all data collection goals are met + booking confirmed
 */
export declare const GOAL_HAPPY_001: GoalOrientedTestCase;
/**
 * GOAL-HAPPY-002: New Patient Two Siblings
 *
 * Goal-based version of HAPPY-002.
 * Tests booking for multiple children.
 */
export declare const GOAL_HAPPY_002: GoalOrientedTestCase;
/**
 * GOAL-HAPPY-003: Quick Info Provider
 *
 * Goal-based version of HAPPY-003.
 * Uses verbose persona that provides extra info upfront.
 */
export declare const GOAL_HAPPY_003: GoalOrientedTestCase;
/**
 * GOAL-HAPPY-004: Special Needs Child
 *
 * Tests handling of special needs information.
 */
export declare const GOAL_HAPPY_004: GoalOrientedTestCase;
/**
 * GOAL-HAPPY-005: Terse User
 *
 * Tests handling of minimal responses.
 */
export declare const GOAL_HAPPY_005: GoalOrientedTestCase;
export declare const goalHappyPathScenarios: GoalOrientedTestCase[];
/**
 * Get a goal test by ID
 */
export declare function getGoalTest(id: string): GoalOrientedTestCase | null;
/**
 * List all goal test IDs
 */
export declare function listGoalTestIds(): string[];
//# sourceMappingURL=goal-happy-path.d.ts.map
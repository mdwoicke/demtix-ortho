/**
 * Test Scenarios Registry
 * Exports all test scenarios
 */
import { TestCase } from '../test-case';
import { happyPathScenarios } from './happy-path';
import { edgeCaseScenarios } from './edge-cases';
import { errorHandlingScenarios } from './error-handling';
export declare const allScenarios: TestCase[];
export declare const scenariosByCategory: {
    'happy-path': TestCase[];
    'edge-case': TestCase[];
    'error-handling': TestCase[];
};
export { happyPathScenarios, edgeCaseScenarios, errorHandlingScenarios };
export declare function getScenarioById(id: string): TestCase | undefined;
export declare function getScenariosByTag(tag: string): TestCase[];
export declare function getScenarioSummary(): {
    total: number;
    byCategory: Record<string, number>;
};
//# sourceMappingURL=index.d.ts.map
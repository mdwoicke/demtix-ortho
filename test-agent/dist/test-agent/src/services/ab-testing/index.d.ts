/**
 * A/B Testing Framework
 *
 * This module provides a selective A/B testing system for comparing variants of:
 * - Prompts (system prompts, analysis prompts)
 * - Tool JSON files (scheduling tool, patient tool)
 * - Configuration parameters (models, temperatures)
 *
 * Key features:
 * - Selective triggering: Only tests high-impact changes
 * - Statistical analysis: Chi-square and t-tests for significance
 * - Semi-automatic workflow: System suggests, user approves
 * - Agile iteration: Analyze → test → iterate
 */
export * from './types';
export { StatisticsService } from './statistics-service';
export { VariantService } from './variant-service';
export { TriggerService, type PassRateAlert } from './trigger-service';
export { ExperimentService, type ExperimentSummary } from './experiment-service';
export type { ABVariant, ABExperiment, ABExperimentRun, ABExperimentTrigger, } from '../../storage/database';
import { Database } from '../../storage/database';
import { StatisticsService } from './statistics-service';
import { VariantService } from './variant-service';
import { TriggerService } from './trigger-service';
import { ExperimentService } from './experiment-service';
export interface ABTestingServices {
    statisticsService: StatisticsService;
    variantService: VariantService;
    triggerService: TriggerService;
    experimentService: ExperimentService;
}
/**
 * Create all A/B testing services with shared database connection
 */
export declare function createABTestingServices(db: Database): ABTestingServices;
export declare function getABTestingServices(db: Database): ABTestingServices;
export declare function resetABTestingServices(): void;
//# sourceMappingURL=index.d.ts.map
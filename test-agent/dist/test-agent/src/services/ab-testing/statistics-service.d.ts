/**
 * Statistics Service for A/B Testing
 *
 * Provides statistical analysis for A/B test results including:
 * - Chi-square test for comparing pass rates
 * - Two-sample t-test for comparing means (turns, duration)
 * - Confidence interval calculations
 * - Effect size (Cohen's d)
 */
import { Database } from '../../storage/database';
import type { VariantStats, ChiSquareResult, TTestResult, ExperimentAnalysis, ConclusionRecommendation } from './types';
export declare class StatisticsService {
    private db;
    constructor(db: Database);
    /**
     * Calculate statistics for a specific variant in an experiment
     */
    calculateVariantStats(experimentId: string, variantId: string): VariantStats;
    /**
     * Chi-square test for comparing pass rates between control and treatment
     */
    performChiSquareTest(control: VariantStats, treatment: VariantStats, significanceThreshold?: number): ChiSquareResult;
    /**
     * Two-sample t-test for comparing means (Welch's t-test)
     */
    performTTest(controlValues: number[], treatmentValues: number[], significanceThreshold?: number): TTestResult;
    /**
     * Calculate confidence interval for a mean
     */
    calculateConfidenceInterval(values: number[], confidence?: number): {
        lower: number;
        upper: number;
    };
    /**
     * Calculate confidence interval for a proportion (Wilson score interval)
     */
    calculateProportionCI(successes: number, total: number, confidence?: number): {
        lower: number;
        upper: number;
    };
    /**
     * Calculate required sample size for detecting a given effect
     */
    calculateRequiredSampleSize(baselineRate: number, minDetectableEffect: number, alpha?: number, power?: number): number;
    /**
     * Comprehensive experiment analysis
     */
    analyzeExperiment(experimentId: string): ExperimentAnalysis;
    /**
     * Recommend whether to conclude an experiment
     */
    shouldConcludeExperiment(experimentId: string): ConclusionRecommendation;
    private mean;
    private median;
    private variance;
    private stdDev;
    private proportionStdDev;
    /**
     * Approximate chi-square p-value using Wilson-Hilferty transformation
     */
    private chiSquarePValue;
    /**
     * Approximate t-test p-value (two-tailed)
     */
    private tTestPValue;
    /**
     * Standard normal CDF approximation (Abramowitz and Stegun)
     */
    private normalCDF;
    /**
     * Incomplete beta function approximation
     */
    private incompleteBeta;
    private betaContinuedFraction;
    private logGamma;
    /**
     * Critical value for t-distribution (two-tailed)
     */
    private tCriticalValue;
    /**
     * Critical value for standard normal (z-score)
     */
    private zCriticalValue;
    /**
     * Interpret Cohen's d effect size
     */
    private interpretEffectSize;
    /**
     * Calculate effect size for pass rate difference (Cohen's h)
     */
    private calculatePassRateEffectSize;
    private emptyStats;
}
//# sourceMappingURL=statistics-service.d.ts.map
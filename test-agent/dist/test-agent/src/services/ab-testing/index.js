"use strict";
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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExperimentService = exports.TriggerService = exports.VariantService = exports.StatisticsService = void 0;
exports.createABTestingServices = createABTestingServices;
exports.getABTestingServices = getABTestingServices;
exports.resetABTestingServices = resetABTestingServices;
// Types
__exportStar(require("./types"), exports);
// Services
var statistics_service_1 = require("./statistics-service");
Object.defineProperty(exports, "StatisticsService", { enumerable: true, get: function () { return statistics_service_1.StatisticsService; } });
var variant_service_1 = require("./variant-service");
Object.defineProperty(exports, "VariantService", { enumerable: true, get: function () { return variant_service_1.VariantService; } });
var trigger_service_1 = require("./trigger-service");
Object.defineProperty(exports, "TriggerService", { enumerable: true, get: function () { return trigger_service_1.TriggerService; } });
var experiment_service_1 = require("./experiment-service");
Object.defineProperty(exports, "ExperimentService", { enumerable: true, get: function () { return experiment_service_1.ExperimentService; } });
const statistics_service_2 = require("./statistics-service");
const variant_service_2 = require("./variant-service");
const trigger_service_2 = require("./trigger-service");
const experiment_service_2 = require("./experiment-service");
/**
 * Create all A/B testing services with shared database connection
 */
function createABTestingServices(db) {
    const variantService = new variant_service_2.VariantService(db);
    const statisticsService = new statistics_service_2.StatisticsService(db);
    const triggerService = new trigger_service_2.TriggerService(db);
    const experimentService = new experiment_service_2.ExperimentService(db, variantService);
    return {
        statisticsService,
        variantService,
        triggerService,
        experimentService,
    };
}
/**
 * Singleton instance for shared access
 */
let abTestingServices = null;
function getABTestingServices(db) {
    if (!abTestingServices) {
        abTestingServices = createABTestingServices(db);
    }
    return abTestingServices;
}
function resetABTestingServices() {
    abTestingServices = null;
}
//# sourceMappingURL=index.js.map
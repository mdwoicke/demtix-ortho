"use strict";
/**
 * Test Scenarios Registry
 * Exports all test scenarios
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandlingScenarios = exports.edgeCaseScenarios = exports.happyPathScenarios = exports.scenariosByCategory = exports.allScenarios = void 0;
exports.getScenarioById = getScenarioById;
exports.getScenariosByTag = getScenariosByTag;
exports.getScenarioSummary = getScenarioSummary;
const happy_path_1 = require("./happy-path");
Object.defineProperty(exports, "happyPathScenarios", { enumerable: true, get: function () { return happy_path_1.happyPathScenarios; } });
const edge_cases_1 = require("./edge-cases");
Object.defineProperty(exports, "edgeCaseScenarios", { enumerable: true, get: function () { return edge_cases_1.edgeCaseScenarios; } });
const error_handling_1 = require("./error-handling");
Object.defineProperty(exports, "errorHandlingScenarios", { enumerable: true, get: function () { return error_handling_1.errorHandlingScenarios; } });
// Combine all scenarios
exports.allScenarios = [
    ...happy_path_1.happyPathScenarios,
    ...edge_cases_1.edgeCaseScenarios,
    ...error_handling_1.errorHandlingScenarios,
];
// Export by category for filtering
exports.scenariosByCategory = {
    'happy-path': happy_path_1.happyPathScenarios,
    'edge-case': edge_cases_1.edgeCaseScenarios,
    'error-handling': error_handling_1.errorHandlingScenarios,
};
// Get scenario by ID
function getScenarioById(id) {
    return exports.allScenarios.find(s => s.id === id);
}
// Get scenarios by tag
function getScenariosByTag(tag) {
    return exports.allScenarios.filter(s => s.tags.includes(tag));
}
// Get scenario summary
function getScenarioSummary() {
    return {
        total: exports.allScenarios.length,
        byCategory: {
            'happy-path': happy_path_1.happyPathScenarios.length,
            'edge-case': edge_cases_1.edgeCaseScenarios.length,
            'error-handling': error_handling_1.errorHandlingScenarios.length,
        },
    };
}
//# sourceMappingURL=index.js.map
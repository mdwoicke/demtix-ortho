"use strict";
/**
 * User Persona Types for Goal-Oriented Testing
 *
 * Defines the "test user" with all data they can provide to the agent.
 * Supports both fixed values and dynamic (randomly generated) fields.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_PERSONA_TRAITS = exports.DEFAULT_CONSTRAINTS = exports.DEFAULT_POOLS = exports.dynamic = exports.hasDynamicFields = exports.isDynamicField = void 0;
exports.createSimplePersona = createSimplePersona;
var dynamic_fields_1 = require("./dynamic-fields");
Object.defineProperty(exports, "isDynamicField", { enumerable: true, get: function () { return dynamic_fields_1.isDynamicField; } });
Object.defineProperty(exports, "hasDynamicFields", { enumerable: true, get: function () { return dynamic_fields_1.hasDynamicFields; } });
Object.defineProperty(exports, "dynamic", { enumerable: true, get: function () { return dynamic_fields_1.dynamic; } });
Object.defineProperty(exports, "DEFAULT_POOLS", { enumerable: true, get: function () { return dynamic_fields_1.DEFAULT_POOLS; } });
Object.defineProperty(exports, "DEFAULT_CONSTRAINTS", { enumerable: true, get: function () { return dynamic_fields_1.DEFAULT_CONSTRAINTS; } });
/**
 * Default traits for a standard test persona
 */
exports.DEFAULT_PERSONA_TRAITS = {
    verbosity: 'normal',
    providesExtraInfo: false,
    makesTypos: false,
    changesAnswer: false,
    asksClarifyingQuestions: false,
};
/**
 * Create a simple persona with minimal configuration
 */
function createSimplePersona(name, inventory) {
    return {
        name,
        inventory: {
            ...inventory,
        },
        traits: exports.DEFAULT_PERSONA_TRAITS,
    };
}
//# sourceMappingURL=persona.js.map
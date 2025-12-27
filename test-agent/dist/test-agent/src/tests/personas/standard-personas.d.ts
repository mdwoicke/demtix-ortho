/**
 * Standard Test Personas
 *
 * Pre-built personas for common test scenarios.
 * These match the data used in existing sequential tests.
 */
import type { UserPersona } from '../types/persona';
/**
 * Sarah Johnson - Standard single child case
 * Matches HAPPY-001 test data
 */
export declare const SARAH_JOHNSON: UserPersona;
/**
 * Michael Davis - Two children case
 * Matches HAPPY-002 test data
 */
export declare const MICHAEL_DAVIS: UserPersona;
/**
 * Jane Smith - Quick info provider
 * Matches HAPPY-003 test data
 * Changed to NORMAL_TRAITS to avoid LLM dependency for verbose responses
 */
export declare const JANE_SMITH: UserPersona;
/**
 * Robert Chen - Returning patient
 */
export declare const ROBERT_CHEN: UserPersona;
/**
 * Maria Garcia - No insurance case
 */
export declare const MARIA_GARCIA: UserPersona;
/**
 * David Wilson - Special needs case
 */
export declare const DAVID_WILSON: UserPersona;
/**
 * Terse Tom - Minimal responses
 */
export declare const TERSE_TOM: UserPersona;
/**
 * All standard personas
 */
export declare const STANDARD_PERSONAS: Record<string, UserPersona>;
/**
 * Get persona by key
 */
export declare function getPersona(key: string): UserPersona | null;
/**
 * List all persona keys
 */
export declare function listPersonaKeys(): string[];
//# sourceMappingURL=standard-personas.d.ts.map
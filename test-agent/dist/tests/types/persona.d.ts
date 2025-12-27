/**
 * User Persona Types for Goal-Oriented Testing
 *
 * Defines the "test user" with all data they can provide to the agent.
 * Supports both fixed values and dynamic (randomly generated) fields.
 */
import type { MaybeDynamic } from './dynamic-fields';
export { isDynamicField, hasDynamicFields, dynamic, DEFAULT_POOLS, DEFAULT_CONSTRAINTS } from './dynamic-fields';
export type { DynamicFieldSpec, DynamicFieldType, FieldConstraints, MaybeDynamic } from './dynamic-fields';
/**
 * Child information in the persona's inventory
 */
export interface ChildData {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    isNewPatient: boolean;
    hadBracesBefore?: boolean;
    specialNeeds?: string;
}
/**
 * Data the test user persona has available to provide
 */
export interface DataInventory {
    parentFirstName: string;
    parentLastName: string;
    parentPhone: string;
    parentEmail?: string;
    children: ChildData[];
    insuranceProvider?: string;
    insuranceId?: string;
    hasInsurance?: boolean;
    preferredLocation?: 'Alleghany' | 'Philadelphia' | string;
    preferredDays?: string[];
    preferredTimeOfDay?: 'morning' | 'afternoon' | 'any';
    preferredDateRange?: {
        start: string;
        end: string;
    };
    previousVisitToOffice?: boolean;
    previousOrthoTreatment?: boolean;
    custom?: Record<string, any>;
}
/**
 * Personality traits that affect response style
 */
export interface PersonaTraits {
    /** How much detail the persona provides */
    verbosity: 'terse' | 'normal' | 'verbose';
    /** Whether persona volunteers unrequested information */
    providesExtraInfo: boolean;
    /** How patient the persona is with the agent */
    patienceLevel?: 'patient' | 'moderate' | 'impatient';
    /** How comfortable with technology */
    techSavviness?: 'low' | 'moderate' | 'high';
    /** Whether persona occasionally makes typos */
    makesTypos?: boolean;
    /** Whether persona sometimes corrects themselves */
    changesAnswer?: boolean;
    /** Whether persona asks clarifying questions back */
    asksClarifyingQuestions?: boolean;
    /** Simulated typing delay in ms */
    responseDelay?: number;
}
/**
 * Complete user persona for a goal-oriented test
 */
export interface UserPersona {
    /** Identifier for this persona */
    name: string;
    /** Optional description of the persona */
    description?: string;
    /** Data inventory - what the persona can provide */
    inventory: DataInventory;
    /** Personality traits affecting response style */
    traits: PersonaTraits;
}
/**
 * Default traits for a standard test persona
 */
export declare const DEFAULT_PERSONA_TRAITS: PersonaTraits;
/**
 * Create a simple persona with minimal configuration
 */
export declare function createSimplePersona(name: string, inventory: Partial<DataInventory> & {
    parentFirstName: string;
    parentLastName: string;
    parentPhone: string;
    children: ChildData[];
}): UserPersona;
/**
 * Child data with optional dynamic fields.
 * Each field can be either a fixed value or a DynamicFieldSpec.
 */
export interface DynamicChildData {
    firstName: MaybeDynamic<string>;
    lastName: MaybeDynamic<string>;
    dateOfBirth: MaybeDynamic<string>;
    isNewPatient: MaybeDynamic<boolean>;
    hadBracesBefore?: MaybeDynamic<boolean>;
    specialNeeds?: MaybeDynamic<string>;
}
/**
 * Data inventory with optional dynamic fields.
 * Each field can be either a fixed value or a DynamicFieldSpec.
 */
export interface DynamicDataInventory {
    parentFirstName: MaybeDynamic<string>;
    parentLastName: MaybeDynamic<string>;
    parentPhone: MaybeDynamic<string>;
    parentEmail?: MaybeDynamic<string>;
    children: DynamicChildData[];
    insuranceProvider?: MaybeDynamic<string>;
    insuranceId?: MaybeDynamic<string>;
    hasInsurance?: MaybeDynamic<boolean>;
    preferredLocation?: MaybeDynamic<'Alleghany' | 'Philadelphia' | string>;
    preferredDays?: MaybeDynamic<string[]>;
    preferredTimeOfDay?: MaybeDynamic<'morning' | 'afternoon' | 'any'>;
    preferredDateRange?: MaybeDynamic<{
        start: string;
        end: string;
    }>;
    previousVisitToOffice?: MaybeDynamic<boolean>;
    previousOrthoTreatment?: MaybeDynamic<boolean>;
    custom?: Record<string, unknown>;
}
/**
 * User persona with dynamic data inventory.
 * Used as a template where fields may be resolved at runtime.
 */
export interface DynamicUserPersona {
    /** Identifier for this persona */
    name: string;
    /** Optional description of the persona */
    description?: string;
    /** Data inventory - may contain dynamic field specs */
    inventory: DynamicDataInventory;
    /** Personality traits affecting response style */
    traits: PersonaTraits;
}
/**
 * Metadata about resolved dynamic fields
 */
export interface ResolutionMetadata {
    /** Seed used for generation (for reproducibility) */
    seed: number;
    /** Timestamp when resolution occurred */
    resolvedAt: string;
    /** List of fields that were dynamically generated */
    dynamicFields: string[];
}
/**
 * A persona that has been resolved (all dynamic fields converted to values)
 */
export interface ResolvedPersona {
    /** The original persona template */
    template: DynamicUserPersona;
    /** The resolved persona with concrete values */
    resolved: UserPersona;
    /** Metadata about the resolution */
    metadata: ResolutionMetadata;
}
//# sourceMappingURL=persona.d.ts.map
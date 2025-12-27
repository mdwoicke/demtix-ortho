/**
 * Data Generator Service
 *
 * Resolves dynamic field specifications to concrete values using Faker.js.
 * Supports seeded generation for reproducibility.
 */
import type { DataInventory, DynamicDataInventory, DynamicUserPersona, ResolvedPersona } from '../tests/types/persona';
/**
 * Service for generating dynamic data using Faker.js
 */
export declare class DataGeneratorService {
    private seed;
    private resolvedFields;
    /**
     * Create a new data generator
     * @param seed - Optional seed for reproducibility. If not provided, generates random seed.
     */
    constructor(seed?: number);
    /**
     * Get the seed used for this generator (for reproducibility)
     */
    getSeed(): number;
    /**
     * Get list of fields that were dynamically resolved
     */
    getResolvedFields(): string[];
    /**
     * Reset the resolved fields tracking
     */
    resetTracking(): void;
    /**
     * Resolve a complete persona with dynamic fields to concrete values
     */
    resolvePersona(persona: DynamicUserPersona): ResolvedPersona;
    /**
     * Resolve a dynamic inventory to concrete values
     */
    resolveInventory(inventory: DynamicDataInventory): DataInventory;
    /**
     * Resolve a single child's data
     */
    private resolveChild;
    /**
     * Resolve a single field (dynamic or static)
     */
    private resolveField;
    /**
     * Generate a value based on field spec
     */
    private generateValue;
    /**
     * Generate first name
     */
    private generateFirstName;
    /**
     * Generate last name
     */
    private generateLastName;
    /**
     * Generate full name
     */
    private generateFullName;
    /**
     * Generate phone number (10-digit format for US)
     */
    private generatePhone;
    /**
     * Generate email address
     */
    private generateEmail;
    /**
     * Generate date within constraints
     */
    private generateDate;
    /**
     * Generate date of birth for an orthodontic patient
     */
    private generateDateOfBirth;
    /**
     * Generate boolean with probability
     */
    private generateBoolean;
    /**
     * Generate value from a pool of options
     */
    private generateFromPool;
    /**
     * Generate insurance ID (alphanumeric format)
     */
    private generateInsuranceId;
    /**
     * Generate special needs (with probability of having any)
     */
    private generateSpecialNeeds;
}
/**
 * Create a data generator with a random seed
 */
export declare function createDataGenerator(seed?: number): DataGeneratorService;
/**
 * Resolve a persona's dynamic fields to concrete values
 *
 * Convenience function that creates a generator, resolves, and returns results.
 */
export declare function resolvePersona(persona: DynamicUserPersona, seed?: number): ResolvedPersona;
/**
 * Check if a persona has any dynamic fields
 */
export declare function personaHasDynamicFields(persona: DynamicUserPersona): boolean;
//# sourceMappingURL=data-generator.d.ts.map
/**
 * Dynamic Field Types for Goal-Oriented Testing
 *
 * Allows persona fields to be either fixed values or dynamically generated
 * at test runtime using Faker.js.
 */
/**
 * Supported dynamic field types for generation
 */
export type DynamicFieldType = 'firstName' | 'lastName' | 'fullName' | 'phone' | 'email' | 'date' | 'dateOfBirth' | 'boolean' | 'insuranceProvider' | 'insuranceId' | 'location' | 'timeOfDay' | 'specialNeeds';
/**
 * Constraints for field generation
 */
export interface FieldConstraints {
    minDate?: string;
    maxDate?: string;
    minAge?: number;
    maxAge?: number;
    phoneFormat?: string;
    options?: string[];
    probability?: number;
    prefix?: string;
    suffix?: string;
}
/**
 * Specification for a dynamically generated field value
 */
export interface DynamicFieldSpec<T = unknown> {
    /** Marker to identify this as a dynamic field */
    _dynamic: true;
    /** Field type for generation */
    fieldType: DynamicFieldType;
    /** Optional constraints for generation */
    constraints?: FieldConstraints;
    /**
     * Optional seed for reproducibility.
     * If provided, this specific field will use this seed.
     * If null/undefined, uses the global generator seed.
     */
    seed?: number | null;
}
/**
 * Type helper: A field that can be either a fixed value or a dynamic spec
 */
export type MaybeDynamic<T> = T | DynamicFieldSpec<T>;
/**
 * Type guard to check if a value is a DynamicFieldSpec
 */
export declare function isDynamicField<T>(value: T | DynamicFieldSpec<T>): value is DynamicFieldSpec<T>;
/**
 * Check if any field in an object contains dynamic specs
 */
export declare function hasDynamicFields(obj: Record<string, unknown>): boolean;
/**
 * Factory functions to create dynamic field specs easily
 */
export declare const dynamic: {
    /**
     * Generate a random first name
     */
    firstName: (constraints?: Partial<FieldConstraints>) => DynamicFieldSpec<string>;
    /**
     * Generate a random last name
     */
    lastName: (constraints?: Partial<FieldConstraints>) => DynamicFieldSpec<string>;
    /**
     * Generate a random full name
     */
    fullName: (constraints?: Partial<FieldConstraints>) => DynamicFieldSpec<string>;
    /**
     * Generate a random phone number
     * @param format - Phone format pattern (default: 10-digit)
     */
    phone: (format?: string) => DynamicFieldSpec<string>;
    /**
     * Generate a random email address
     */
    email: (constraints?: Partial<FieldConstraints>) => DynamicFieldSpec<string>;
    /**
     * Generate a random date within constraints
     * @param minDate - Minimum date (ISO string)
     * @param maxDate - Maximum date (ISO string)
     */
    date: (minDate?: string, maxDate?: string) => DynamicFieldSpec<string>;
    /**
     * Generate a date of birth for an orthodontic patient
     * @param minAge - Minimum age (default: 7)
     * @param maxAge - Maximum age (default: 18)
     */
    dateOfBirth: (minAge?: number, maxAge?: number) => DynamicFieldSpec<string>;
    /**
     * Generate a random boolean
     * @param probability - Probability of true (0-1, default: 0.5)
     */
    boolean: (probability?: number) => DynamicFieldSpec<boolean>;
    /**
     * Generate a random insurance provider from a pool
     * @param options - Custom pool of providers (uses default if not provided)
     */
    insuranceProvider: (options?: string[]) => DynamicFieldSpec<string>;
    /**
     * Generate a random insurance ID
     */
    insuranceId: (constraints?: Partial<FieldConstraints>) => DynamicFieldSpec<string>;
    /**
     * Generate a random location from a pool
     * @param options - Custom pool of locations (uses default if not provided)
     */
    location: (options?: string[]) => DynamicFieldSpec<string>;
    /**
     * Generate a random time of day preference
     */
    timeOfDay: () => DynamicFieldSpec<"morning" | "afternoon" | "any">;
    /**
     * Generate random special needs (or none)
     * @param options - Pool of special needs options
     * @param probability - Probability of having special needs (default: 0.1)
     */
    specialNeeds: (options?: string[], probability?: number) => DynamicFieldSpec<string>;
};
/**
 * Default pools for dynamic generation
 */
export declare const DEFAULT_POOLS: {
    insuranceProviders: string[];
    locations: string[];
    specialNeeds: string[];
};
/**
 * Default constraints for field types
 */
export declare const DEFAULT_CONSTRAINTS: Record<DynamicFieldType, FieldConstraints>;
//# sourceMappingURL=dynamic-fields.d.ts.map
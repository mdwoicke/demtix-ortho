"use strict";
/**
 * Dynamic Field Types for Goal-Oriented Testing
 *
 * Allows persona fields to be either fixed values or dynamically generated
 * at test runtime using Faker.js.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CONSTRAINTS = exports.DEFAULT_POOLS = exports.dynamic = void 0;
exports.isDynamicField = isDynamicField;
exports.hasDynamicFields = hasDynamicFields;
/**
 * Type guard to check if a value is a DynamicFieldSpec
 */
function isDynamicField(value) {
    return (value !== null &&
        typeof value === 'object' &&
        '_dynamic' in value &&
        value._dynamic === true);
}
/**
 * Check if any field in an object contains dynamic specs
 */
function hasDynamicFields(obj) {
    for (const value of Object.values(obj)) {
        if (isDynamicField(value)) {
            return true;
        }
        if (Array.isArray(value)) {
            for (const item of value) {
                if (typeof item === 'object' && item !== null && hasDynamicFields(item)) {
                    return true;
                }
            }
        }
        if (typeof value === 'object' && value !== null && !isDynamicField(value)) {
            if (hasDynamicFields(value)) {
                return true;
            }
        }
    }
    return false;
}
/**
 * Factory functions to create dynamic field specs easily
 */
exports.dynamic = {
    /**
     * Generate a random first name
     */
    firstName: (constraints) => ({
        _dynamic: true,
        fieldType: 'firstName',
        constraints,
    }),
    /**
     * Generate a random last name
     */
    lastName: (constraints) => ({
        _dynamic: true,
        fieldType: 'lastName',
        constraints,
    }),
    /**
     * Generate a random full name
     */
    fullName: (constraints) => ({
        _dynamic: true,
        fieldType: 'fullName',
        constraints,
    }),
    /**
     * Generate a random phone number
     * @param format - Phone format pattern (default: 10-digit)
     */
    phone: (format) => ({
        _dynamic: true,
        fieldType: 'phone',
        constraints: format ? { phoneFormat: format } : undefined,
    }),
    /**
     * Generate a random email address
     */
    email: (constraints) => ({
        _dynamic: true,
        fieldType: 'email',
        constraints,
    }),
    /**
     * Generate a random date within constraints
     * @param minDate - Minimum date (ISO string)
     * @param maxDate - Maximum date (ISO string)
     */
    date: (minDate, maxDate) => ({
        _dynamic: true,
        fieldType: 'date',
        constraints: { minDate, maxDate },
    }),
    /**
     * Generate a date of birth for an orthodontic patient
     * @param minAge - Minimum age (default: 7)
     * @param maxAge - Maximum age (default: 18)
     */
    dateOfBirth: (minAge, maxAge) => ({
        _dynamic: true,
        fieldType: 'dateOfBirth',
        constraints: { minAge, maxAge },
    }),
    /**
     * Generate a random boolean
     * @param probability - Probability of true (0-1, default: 0.5)
     */
    boolean: (probability) => ({
        _dynamic: true,
        fieldType: 'boolean',
        constraints: probability !== undefined ? { probability } : undefined,
    }),
    /**
     * Generate a random insurance provider from a pool
     * @param options - Custom pool of providers (uses default if not provided)
     */
    insuranceProvider: (options) => ({
        _dynamic: true,
        fieldType: 'insuranceProvider',
        constraints: options ? { options } : undefined,
    }),
    /**
     * Generate a random insurance ID
     */
    insuranceId: (constraints) => ({
        _dynamic: true,
        fieldType: 'insuranceId',
        constraints,
    }),
    /**
     * Generate a random location from a pool
     * @param options - Custom pool of locations (uses default if not provided)
     */
    location: (options) => ({
        _dynamic: true,
        fieldType: 'location',
        constraints: options ? { options } : undefined,
    }),
    /**
     * Generate a random time of day preference
     */
    timeOfDay: () => ({
        _dynamic: true,
        fieldType: 'timeOfDay',
        constraints: { options: ['morning', 'afternoon', 'any'] },
    }),
    /**
     * Generate random special needs (or none)
     * @param options - Pool of special needs options
     * @param probability - Probability of having special needs (default: 0.1)
     */
    specialNeeds: (options, probability) => ({
        _dynamic: true,
        fieldType: 'specialNeeds',
        constraints: {
            options: options || ['None', 'Autism', 'ADHD', 'Sensory sensitivity', 'Anxiety'],
            probability: probability ?? 0.1,
        },
    }),
};
/**
 * Default pools for dynamic generation
 */
exports.DEFAULT_POOLS = {
    insuranceProviders: [
        'Keystone First',
        'Aetna Better Health',
        'Blue Cross Blue Shield',
        'United Healthcare',
        'Cigna',
        'AmeriHealth',
        'Highmark',
        'Independence Blue Cross',
        'Geisinger Health Plan',
    ],
    locations: [
        'Alleghany',
        'Philadelphia',
    ],
    specialNeeds: [
        'None',
        'Autism',
        'ADHD',
        'Sensory sensitivity',
        'Anxiety',
        'Down syndrome',
        'Cerebral palsy',
    ],
};
/**
 * Default constraints for field types
 */
exports.DEFAULT_CONSTRAINTS = {
    firstName: {},
    lastName: {},
    fullName: {},
    phone: { phoneFormat: '##########' },
    email: {},
    date: {},
    dateOfBirth: { minAge: 7, maxAge: 18 },
    boolean: { probability: 0.5 },
    insuranceProvider: { options: exports.DEFAULT_POOLS.insuranceProviders },
    insuranceId: {},
    location: { options: exports.DEFAULT_POOLS.locations },
    timeOfDay: { options: ['morning', 'afternoon', 'any'] },
    specialNeeds: { options: exports.DEFAULT_POOLS.specialNeeds, probability: 0.1 },
};
//# sourceMappingURL=dynamic-fields.js.map
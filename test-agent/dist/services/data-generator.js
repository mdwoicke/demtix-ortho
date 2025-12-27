"use strict";
/**
 * Data Generator Service
 *
 * Resolves dynamic field specifications to concrete values using Faker.js.
 * Supports seeded generation for reproducibility.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DataGeneratorService = void 0;
exports.createDataGenerator = createDataGenerator;
exports.resolvePersona = resolvePersona;
exports.personaHasDynamicFields = personaHasDynamicFields;
const faker_1 = require("@faker-js/faker");
const dynamic_fields_1 = require("../tests/types/dynamic-fields");
/**
 * Service for generating dynamic data using Faker.js
 */
class DataGeneratorService {
    /**
     * Create a new data generator
     * @param seed - Optional seed for reproducibility. If not provided, generates random seed.
     */
    constructor(seed) {
        this.resolvedFields = [];
        this.seed = seed ?? Math.floor(Math.random() * 1000000000);
        faker_1.faker.seed(this.seed);
    }
    /**
     * Get the seed used for this generator (for reproducibility)
     */
    getSeed() {
        return this.seed;
    }
    /**
     * Get list of fields that were dynamically resolved
     */
    getResolvedFields() {
        return [...this.resolvedFields];
    }
    /**
     * Reset the resolved fields tracking
     */
    resetTracking() {
        this.resolvedFields = [];
    }
    /**
     * Resolve a complete persona with dynamic fields to concrete values
     */
    resolvePersona(persona) {
        this.resetTracking();
        const resolvedInventory = this.resolveInventory(persona.inventory);
        const resolved = {
            name: persona.name,
            description: persona.description,
            inventory: resolvedInventory,
            traits: persona.traits,
        };
        const metadata = {
            seed: this.seed,
            resolvedAt: new Date().toISOString(),
            dynamicFields: this.getResolvedFields(),
        };
        return {
            template: persona,
            resolved,
            metadata,
        };
    }
    /**
     * Resolve a dynamic inventory to concrete values
     */
    resolveInventory(inventory) {
        return {
            parentFirstName: this.resolveField(inventory.parentFirstName, 'firstName', 'parentFirstName'),
            parentLastName: this.resolveField(inventory.parentLastName, 'lastName', 'parentLastName'),
            parentPhone: this.resolveField(inventory.parentPhone, 'phone', 'parentPhone'),
            parentEmail: inventory.parentEmail !== undefined
                ? this.resolveField(inventory.parentEmail, 'email', 'parentEmail')
                : undefined,
            children: inventory.children.map((child, index) => this.resolveChild(child, index)),
            hasInsurance: inventory.hasInsurance !== undefined
                ? this.resolveField(inventory.hasInsurance, 'boolean', 'hasInsurance')
                : undefined,
            insuranceProvider: inventory.insuranceProvider !== undefined
                ? this.resolveField(inventory.insuranceProvider, 'insuranceProvider', 'insuranceProvider')
                : undefined,
            insuranceId: inventory.insuranceId !== undefined
                ? this.resolveField(inventory.insuranceId, 'insuranceId', 'insuranceId')
                : undefined,
            preferredLocation: inventory.preferredLocation !== undefined
                ? this.resolveField(inventory.preferredLocation, 'location', 'preferredLocation')
                : undefined,
            preferredDays: inventory.preferredDays,
            preferredTimeOfDay: inventory.preferredTimeOfDay !== undefined
                ? this.resolveField(inventory.preferredTimeOfDay, 'timeOfDay', 'preferredTimeOfDay')
                : undefined,
            preferredDateRange: inventory.preferredDateRange,
            previousVisitToOffice: inventory.previousVisitToOffice !== undefined
                ? this.resolveField(inventory.previousVisitToOffice, 'boolean', 'previousVisitToOffice')
                : undefined,
            previousOrthoTreatment: inventory.previousOrthoTreatment !== undefined
                ? this.resolveField(inventory.previousOrthoTreatment, 'boolean', 'previousOrthoTreatment')
                : undefined,
            custom: inventory.custom,
        };
    }
    /**
     * Resolve a single child's data
     */
    resolveChild(child, index) {
        const prefix = `children[${index}]`;
        return {
            firstName: this.resolveField(child.firstName, 'firstName', `${prefix}.firstName`),
            lastName: this.resolveField(child.lastName, 'lastName', `${prefix}.lastName`),
            dateOfBirth: this.resolveField(child.dateOfBirth, 'dateOfBirth', `${prefix}.dateOfBirth`),
            isNewPatient: this.resolveField(child.isNewPatient, 'boolean', `${prefix}.isNewPatient`),
            hadBracesBefore: child.hadBracesBefore !== undefined
                ? this.resolveField(child.hadBracesBefore, 'boolean', `${prefix}.hadBracesBefore`)
                : undefined,
            specialNeeds: child.specialNeeds !== undefined
                ? this.resolveField(child.specialNeeds, 'specialNeeds', `${prefix}.specialNeeds`)
                : undefined,
        };
    }
    /**
     * Resolve a single field (dynamic or static)
     */
    resolveField(value, defaultType, fieldPath) {
        if (!(0, dynamic_fields_1.isDynamicField)(value)) {
            return value;
        }
        // Track that this field was dynamically generated
        this.resolvedFields.push(fieldPath);
        return this.generateValue(value);
    }
    /**
     * Generate a value based on field spec
     */
    generateValue(spec) {
        const constraints = {
            ...dynamic_fields_1.DEFAULT_CONSTRAINTS[spec.fieldType],
            ...spec.constraints,
        };
        switch (spec.fieldType) {
            case 'firstName':
                return this.generateFirstName(constraints);
            case 'lastName':
                return this.generateLastName(constraints);
            case 'fullName':
                return this.generateFullName(constraints);
            case 'phone':
                return this.generatePhone(constraints);
            case 'email':
                return this.generateEmail(constraints);
            case 'date':
                return this.generateDate(constraints);
            case 'dateOfBirth':
                return this.generateDateOfBirth(constraints);
            case 'boolean':
                return this.generateBoolean(constraints);
            case 'insuranceProvider':
                return this.generateFromPool(constraints.options || dynamic_fields_1.DEFAULT_POOLS.insuranceProviders);
            case 'insuranceId':
                return this.generateInsuranceId(constraints);
            case 'location':
                return this.generateFromPool(constraints.options || dynamic_fields_1.DEFAULT_POOLS.locations);
            case 'timeOfDay':
                return this.generateFromPool(constraints.options || ['morning', 'afternoon', 'any']);
            case 'specialNeeds':
                return this.generateSpecialNeeds(constraints);
            default:
                return faker_1.faker.lorem.word();
        }
    }
    /**
     * Generate first name
     */
    generateFirstName(constraints) {
        let name = faker_1.faker.person.firstName();
        if (constraints.prefix)
            name = constraints.prefix + name;
        if (constraints.suffix)
            name = name + constraints.suffix;
        return name;
    }
    /**
     * Generate last name
     */
    generateLastName(constraints) {
        let name = faker_1.faker.person.lastName();
        if (constraints.prefix)
            name = constraints.prefix + name;
        if (constraints.suffix)
            name = name + constraints.suffix;
        return name;
    }
    /**
     * Generate full name
     */
    generateFullName(constraints) {
        let name = faker_1.faker.person.fullName();
        if (constraints.prefix)
            name = constraints.prefix + name;
        if (constraints.suffix)
            name = name + constraints.suffix;
        return name;
    }
    /**
     * Generate phone number (10-digit format for US)
     */
    generatePhone(constraints) {
        const format = constraints.phoneFormat || '##########';
        // Generate based on format
        if (format === '##########') {
            // Generate 10 random digits (avoiding 0 or 1 as first digit)
            const areaCode = faker_1.faker.number.int({ min: 200, max: 999 });
            const exchange = faker_1.faker.number.int({ min: 200, max: 999 });
            const subscriber = faker_1.faker.number.int({ min: 1000, max: 9999 });
            return `${areaCode}${exchange}${subscriber}`;
        }
        else if (format === '###-###-####') {
            const areaCode = faker_1.faker.number.int({ min: 200, max: 999 });
            const exchange = faker_1.faker.number.int({ min: 200, max: 999 });
            const subscriber = faker_1.faker.number.int({ min: 1000, max: 9999 });
            return `${areaCode}-${exchange}-${subscriber}`;
        }
        else {
            // Custom format - replace # with digits
            return format.replace(/#/g, () => faker_1.faker.number.int({ min: 0, max: 9 }).toString());
        }
    }
    /**
     * Generate email address
     */
    generateEmail(constraints) {
        let email = faker_1.faker.internet.email().toLowerCase();
        if (constraints.prefix)
            email = constraints.prefix + email;
        if (constraints.suffix)
            email = email + constraints.suffix;
        return email;
    }
    /**
     * Generate date within constraints
     */
    generateDate(constraints) {
        const from = constraints.minDate
            ? new Date(constraints.minDate)
            : new Date('2026-01-01');
        const to = constraints.maxDate
            ? new Date(constraints.maxDate)
            : new Date('2026-12-31');
        return faker_1.faker.date.between({ from, to }).toISOString().split('T')[0];
    }
    /**
     * Generate date of birth for an orthodontic patient
     */
    generateDateOfBirth(constraints) {
        const minAge = constraints.minAge ?? 7;
        const maxAge = constraints.maxAge ?? 18;
        const today = new Date();
        // Calculate date range based on age
        const maxDate = new Date(today);
        maxDate.setFullYear(maxDate.getFullYear() - minAge);
        const minDate = new Date(today);
        minDate.setFullYear(minDate.getFullYear() - maxAge - 1);
        minDate.setDate(minDate.getDate() + 1); // Ensure max age is not exceeded
        return faker_1.faker.date.between({ from: minDate, to: maxDate }).toISOString().split('T')[0];
    }
    /**
     * Generate boolean with probability
     */
    generateBoolean(constraints) {
        const probability = constraints.probability ?? 0.5;
        return faker_1.faker.number.float({ min: 0, max: 1 }) < probability;
    }
    /**
     * Generate value from a pool of options
     */
    generateFromPool(options) {
        if (options.length === 0) {
            return '';
        }
        return faker_1.faker.helpers.arrayElement(options);
    }
    /**
     * Generate insurance ID (alphanumeric format)
     */
    generateInsuranceId(constraints) {
        const prefix = constraints.prefix || '';
        const suffix = constraints.suffix || '';
        // Generate format like "XYZ123456789"
        const letters = faker_1.faker.string.alpha({ length: 3, casing: 'upper' });
        const numbers = faker_1.faker.string.numeric({ length: 9 });
        return prefix + letters + numbers + suffix;
    }
    /**
     * Generate special needs (with probability of having any)
     */
    generateSpecialNeeds(constraints) {
        const probability = constraints.probability ?? 0.1;
        const options = constraints.options || dynamic_fields_1.DEFAULT_POOLS.specialNeeds;
        // First, determine if the person has special needs
        const hasSpecialNeeds = faker_1.faker.number.float({ min: 0, max: 1 }) < probability;
        if (!hasSpecialNeeds) {
            return 'None';
        }
        // Filter out "None" from options when selecting a special need
        const specialNeedsOptions = options.filter(opt => opt.toLowerCase() !== 'none');
        if (specialNeedsOptions.length === 0) {
            return 'None';
        }
        return faker_1.faker.helpers.arrayElement(specialNeedsOptions);
    }
}
exports.DataGeneratorService = DataGeneratorService;
/**
 * Create a data generator with a random seed
 */
function createDataGenerator(seed) {
    return new DataGeneratorService(seed);
}
/**
 * Resolve a persona's dynamic fields to concrete values
 *
 * Convenience function that creates a generator, resolves, and returns results.
 */
function resolvePersona(persona, seed) {
    const generator = new DataGeneratorService(seed);
    return generator.resolvePersona(persona);
}
/**
 * Check if a persona has any dynamic fields
 */
function personaHasDynamicFields(persona) {
    const inventory = persona.inventory;
    // Check parent fields
    if ((0, dynamic_fields_1.isDynamicField)(inventory.parentFirstName))
        return true;
    if ((0, dynamic_fields_1.isDynamicField)(inventory.parentLastName))
        return true;
    if ((0, dynamic_fields_1.isDynamicField)(inventory.parentPhone))
        return true;
    if (inventory.parentEmail && (0, dynamic_fields_1.isDynamicField)(inventory.parentEmail))
        return true;
    // Check children
    for (const child of inventory.children) {
        if ((0, dynamic_fields_1.isDynamicField)(child.firstName))
            return true;
        if ((0, dynamic_fields_1.isDynamicField)(child.lastName))
            return true;
        if ((0, dynamic_fields_1.isDynamicField)(child.dateOfBirth))
            return true;
        if ((0, dynamic_fields_1.isDynamicField)(child.isNewPatient))
            return true;
        if (child.hadBracesBefore !== undefined && (0, dynamic_fields_1.isDynamicField)(child.hadBracesBefore))
            return true;
        if (child.specialNeeds !== undefined && (0, dynamic_fields_1.isDynamicField)(child.specialNeeds))
            return true;
    }
    // Check insurance
    if (inventory.hasInsurance !== undefined && (0, dynamic_fields_1.isDynamicField)(inventory.hasInsurance))
        return true;
    if (inventory.insuranceProvider !== undefined && (0, dynamic_fields_1.isDynamicField)(inventory.insuranceProvider))
        return true;
    if (inventory.insuranceId !== undefined && (0, dynamic_fields_1.isDynamicField)(inventory.insuranceId))
        return true;
    // Check preferences
    if (inventory.preferredLocation !== undefined && (0, dynamic_fields_1.isDynamicField)(inventory.preferredLocation))
        return true;
    if (inventory.preferredTimeOfDay !== undefined && (0, dynamic_fields_1.isDynamicField)(inventory.preferredTimeOfDay))
        return true;
    // Check history
    if (inventory.previousVisitToOffice !== undefined && (0, dynamic_fields_1.isDynamicField)(inventory.previousVisitToOffice))
        return true;
    if (inventory.previousOrthoTreatment !== undefined && (0, dynamic_fields_1.isDynamicField)(inventory.previousOrthoTreatment))
        return true;
    return false;
}
//# sourceMappingURL=data-generator.js.map
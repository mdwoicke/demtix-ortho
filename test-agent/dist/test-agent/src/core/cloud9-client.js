"use strict";
/**
 * Cloud 9 Sandbox Data Client
 * Fetches test data from the backend API (which connects to Cloud 9 sandbox)
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Cloud9Client = void 0;
const axios_1 = __importDefault(require("axios"));
const config_1 = require("../config/config");
class Cloud9Client {
    constructor() {
        this.client = axios_1.default.create({
            baseURL: config_1.config.backend.baseUrl,
            timeout: config_1.config.backend.timeout,
            headers: {
                'Content-Type': 'application/json',
                'X-Environment': 'sandbox',
            },
        });
        this.cache = { lastFetched: {} };
    }
    /**
     * Search for patients by name
     */
    async searchPatients(query) {
        try {
            const response = await this.client.get('/api/patients/search', {
                params: { query },
            });
            return this.normalizePatients(response.data.data || response.data.patients || []);
        }
        catch (error) {
            console.error('Failed to search patients:', error);
            return [];
        }
    }
    /**
     * Get all locations
     */
    async getLocations(forceRefresh = false) {
        if (this.cache.locations && !forceRefresh) {
            return this.cache.locations;
        }
        try {
            const response = await this.client.get('/api/reference/locations');
            this.cache.locations = this.normalizeLocations(response.data.data || response.data.locations || []);
            this.cache.lastFetched['locations'] = Date.now();
            return this.cache.locations;
        }
        catch (error) {
            console.error('Failed to fetch locations:', error);
            return [];
        }
    }
    /**
     * Get all providers
     */
    async getProviders(forceRefresh = false) {
        if (this.cache.providers && !forceRefresh) {
            return this.cache.providers;
        }
        try {
            const response = await this.client.get('/api/reference/providers');
            this.cache.providers = this.normalizeProviders(response.data.data || response.data.providers || []);
            this.cache.lastFetched['providers'] = Date.now();
            return this.cache.providers;
        }
        catch (error) {
            console.error('Failed to fetch providers:', error);
            return [];
        }
    }
    /**
     * Get all appointment types
     */
    async getAppointmentTypes(forceRefresh = false) {
        if (this.cache.appointmentTypes && !forceRefresh) {
            return this.cache.appointmentTypes;
        }
        try {
            const response = await this.client.get('/api/reference/appointment-types');
            this.cache.appointmentTypes = this.normalizeAppointmentTypes(response.data.data || response.data.appointmentTypes || []);
            this.cache.lastFetched['appointmentTypes'] = Date.now();
            return this.cache.appointmentTypes;
        }
        catch (error) {
            console.error('Failed to fetch appointment types:', error);
            return [];
        }
    }
    /**
     * Get sample test patients for testing
     */
    async getTestPatients() {
        // Search for common test names that might exist in sandbox
        const searchTerms = ['Smith', 'Jones', 'Test', 'Demo'];
        const patients = [];
        for (const term of searchTerms) {
            const results = await this.searchPatients(term);
            patients.push(...results);
            if (patients.length >= 5)
                break;
        }
        return patients.slice(0, 5);
    }
    /**
     * Refresh all cached data
     */
    async refreshAllData() {
        await Promise.all([
            this.getLocations(true),
            this.getProviders(true),
            this.getAppointmentTypes(true),
        ]);
    }
    /**
     * Clear cache
     */
    clearCache() {
        this.cache = { lastFetched: {} };
    }
    // Normalization helpers
    normalizePatients(data) {
        return data.map(p => ({
            patientGuid: p.patientGuid || p.PatientGUID || p.guid,
            firstName: p.firstName || p.FirstName || p.first_name || '',
            lastName: p.lastName || p.LastName || p.last_name || '',
            fullName: p.fullName || p.FullName || `${p.firstName || ''} ${p.lastName || ''}`.trim(),
            birthDate: p.birthDate || p.BirthDate || p.birth_date,
            email: p.email || p.Email,
            phone: p.phone || p.Phone,
        }));
    }
    normalizeLocations(data) {
        return data.map(l => ({
            locationGuid: l.locationGuid || l.LocationGUID || l.guid,
            name: l.name || l.Name || l.locationName || '',
            address: l.address || l.Address,
            city: l.city || l.City,
            state: l.state || l.State,
            zip: l.zip || l.Zip || l.postalCode,
        }));
    }
    normalizeProviders(data) {
        return data.map(p => ({
            providerGuid: p.providerGuid || p.ProviderGUID || p.guid,
            name: p.name || p.Name || p.providerName || `${p.firstName || ''} ${p.lastName || ''}`.trim(),
            firstName: p.firstName || p.FirstName,
            lastName: p.lastName || p.LastName,
            specialty: p.specialty || p.Specialty,
            locationGuid: p.locationGuid || p.LocationGUID,
        }));
    }
    normalizeAppointmentTypes(data) {
        return data.map(t => ({
            appointmentTypeGuid: t.appointmentTypeGuid || t.AppointmentTypeGUID || t.guid,
            code: t.code || t.Code || '',
            description: t.description || t.Description || t.name || '',
            durationMinutes: t.durationMinutes || t.DurationMinutes || t.duration,
        }));
    }
}
exports.Cloud9Client = Cloud9Client;
//# sourceMappingURL=cloud9-client.js.map
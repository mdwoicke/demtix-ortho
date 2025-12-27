/**
 * Cloud 9 Sandbox Data Client
 * Fetches test data from the backend API (which connects to Cloud 9 sandbox)
 */
export interface Patient {
    patientGuid: string;
    firstName: string;
    lastName: string;
    fullName: string;
    birthDate?: string;
    email?: string;
    phone?: string;
}
export interface Location {
    locationGuid: string;
    name: string;
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
}
export interface Provider {
    providerGuid: string;
    name: string;
    firstName?: string;
    lastName?: string;
    specialty?: string;
    locationGuid?: string;
}
export interface AppointmentType {
    appointmentTypeGuid: string;
    code: string;
    description: string;
    durationMinutes?: number;
}
export interface AvailableSlot {
    dateTime: string;
    scheduleViewGuid: string;
    scheduleColumnGuid: string;
    providerGuid: string;
    locationGuid: string;
}
export declare class Cloud9Client {
    private client;
    private cache;
    constructor();
    /**
     * Search for patients by name
     */
    searchPatients(query: string): Promise<Patient[]>;
    /**
     * Get all locations
     */
    getLocations(forceRefresh?: boolean): Promise<Location[]>;
    /**
     * Get all providers
     */
    getProviders(forceRefresh?: boolean): Promise<Provider[]>;
    /**
     * Get all appointment types
     */
    getAppointmentTypes(forceRefresh?: boolean): Promise<AppointmentType[]>;
    /**
     * Get sample test patients for testing
     */
    getTestPatients(): Promise<Patient[]>;
    /**
     * Refresh all cached data
     */
    refreshAllData(): Promise<void>;
    /**
     * Clear cache
     */
    clearCache(): void;
    private normalizePatients;
    private normalizeLocations;
    private normalizeProviders;
    private normalizeAppointmentTypes;
}
//# sourceMappingURL=cloud9-client.d.ts.map
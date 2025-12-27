"use strict";
/**
 * Shared Appointment types
 * Used by both frontend and backend
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppointmentStatus = void 0;
var AppointmentStatus;
(function (AppointmentStatus) {
    AppointmentStatus["SCHEDULED"] = "Scheduled";
    AppointmentStatus["CONFIRMED"] = "Confirmed";
    AppointmentStatus["CANCELED"] = "Canceled";
    AppointmentStatus["COMPLETED"] = "Completed";
    AppointmentStatus["NO_SHOW"] = "No Show";
})(AppointmentStatus || (exports.AppointmentStatus = AppointmentStatus = {}));
//# sourceMappingURL=Appointment.js.map
# V1 Production Files

This directory contains the canonical V1 production files for the Cloud9 Ortho integration.

## Files

| File | Type | Description |
|------|------|-------------|
| `Chord_Cloud9_SystemPrompt.md` | Prompt | Advanced IVA system prompt for Allie scheduling assistant |
| `nodered_Cloud9_flows.json` | Flow | Node Red flow definitions for Cloud9 API integration |
| `chord_dso_patient_Tool.json` | Tool | Flowise tool for patient operations (lookup, create, appointments) |
| `schedule_appointment_dso_Tool.json` | Tool | Flowise tool for appointment scheduling operations |

## Data Flow

```
User input
    ↓
Flowise Prompt (Chord_Cloud9_SystemPrompt.md)
    ↓
Flowise Tool (chord_dso_patient_Tool.json / schedule_appointment_dso_Tool.json)
    ↓
Node Red API (nodered_Cloud9_flows.json)
    ↓
Cloud9 API
```

## File Relationships

1. **System Prompt** (`Chord_Cloud9_SystemPrompt.md`)
   - Defines Allie's personality and behavior
   - Contains FSM (Finite State Machine) for conversation flow
   - References the two Flowise tools

2. **Patient Tool** (`chord_dso_patient_Tool.json`)
   - Actions: lookup, get, create, appointments, clinic_info, edit_insurance, confirm_appointment
   - Calls Node Red endpoints: `/ortho/getPatientByFilter`, `/ortho/getPatient`, etc.

3. **Scheduling Tool** (`schedule_appointment_dso_Tool.json`)
   - Actions: slots, grouped_slots, book_child, cancel
   - Calls Node Red endpoints: `/ortho/getApptSlots`, `/ortho/createAppt`, etc.

4. **Node Red Flows** (`nodered_Cloud9_flows.json`)
   - Translates JSON requests from Flowise tools to Cloud9 XML/SOAP
   - 11 flow groups for different Cloud9 operations
   - Handles authentication and error responses

## API Endpoints

Backend V1 file management endpoints:

- `GET /api/test-monitor/v1-files/status` - Health check for all V1 files
- `GET /api/test-monitor/v1-files` - List all V1 files with metadata
- `GET /api/test-monitor/v1-files/:fileKey` - Get specific V1 file content
- `POST /api/test-monitor/v1-files/:fileKey/validate` - Validate V1 file content
- `POST /api/test-monitor/v1-files/sync` - Sync V1 files to nodered directory

## Versioning

These files are the V1 (first production version) of the Node Red integration architecture. Previous versions are archived in `/docs/archive/`.

## Backup Copies

For backward compatibility, these files are also synced to:
- `/nodered/nodered_Cloud9_flows.json`
- `/nodered/chord_dso_patient_Tool.json`
- `/nodered/schedule_appointment_dso_Tool.json`

The V1 directory (`/docs/v1/`) is the canonical source. The nodered directory copies are kept in sync for test utilities.

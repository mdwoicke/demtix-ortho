---
name: start-and-verify
description: Build, start, and verify all Dentix Ortho services (frontend, backend, APIs)
---

# Start and Verify All Services

**Trigger Hints**: "start services", "start all", "run services", "verify services", "spin up", "start frontend and backend"

## Quick Start Commands

| Task | Command |
|------|---------|
| Build frontend | `cd frontend && npm run build` |
| Build backend | `cd backend && npm run build` |
| Start frontend dev | `cd frontend && npm run dev` |
| Start backend dev | `cd backend && npm run dev` |
| Check port 5174 | `netstat -ano \| findstr :5174` |
| Check port 3001 | `netstat -ano \| findstr :3001` |
| Kill process | `taskkill /PID <pid> /F` |

---

## Full Startup Procedure

### Step 1: Check for Running Services

```bash
# Check if frontend is running (port 5174)
netstat -ano | findstr :5174

# Check if backend is running (port 3001)
netstat -ano | findstr :3001
```

If services are running, ask user if they want to restart them. To kill:
```bash
taskkill /PID <pid> /F
```

### Step 2: Build Both Projects

Run builds in parallel:

```bash
# Terminal 1: Frontend build
cd frontend && npm run build

# Terminal 2: Backend build
cd backend && npm run build
```

**Expected Frontend Output:**
```
✓ 1272 modules transformed
✓ built in ~9s
```

**Expected Backend Output:**
```
> tsc
(no errors = success)
```

### Step 3: Start Backend

```bash
cd backend && npm run dev
```

**Wait for:** `Server running on port 3001` or similar startup message.

**Health check:**
```bash
curl http://localhost:3001/api/health
```

### Step 4: Start Frontend

```bash
cd frontend && npm run dev
```

**Wait for:**
```
VITE v7.x.x  ready in xxx ms

➜  Local:   http://localhost:5174/
➜  Network: http://0.0.0.0:5174/
```

### Step 5: Verify Services

| Service | URL | Expected |
|---------|-----|----------|
| Frontend | http://localhost:5174 | 200 OK, HTML page |
| Backend Health | http://localhost:3001/api/health | 200 OK, JSON |
| Node Red Proxy | http://localhost:5174/FabricWorkflow/api/chord | Proxied to Node Red |
| Cloud9 Proxy | http://localhost:5174/cloud9-api | Proxied to Cloud9 sandbox |

### Step 6: Run API Tests (Optional)

Navigate to http://localhost:5174/test-monitor/api-testing and:
1. Click "Node Red API" toggle
2. Click "Run All Tests"
3. Verify 11/11 pass
4. Click "Cloud9 API" toggle
5. Click "Run All Tests"
6. Verify 11/11 pass

---

## Service Configuration

### Frontend (Vite)
| Setting | Value |
|---------|-------|
| Port | 5174 |
| Host | 0.0.0.0 |
| Config | `frontend/vite.config.ts` |

### Backend (Express)
| Setting | Value |
|---------|-------|
| Port | 3001 |
| Config | `backend/src/config/` |

### Proxy Configuration (vite.config.ts)
```typescript
proxy: {
  '/FabricWorkflow': {
    target: 'http://localhost:3333',  // Node Red
    changeOrigin: true,
  },
  '/cloud9-api': {
    target: 'https://us-ea1-partnertest.cloud9ortho.com',
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/cloud9-api/, ''),
  },
}
```

---

## Quick Links (When Running)

| Page | URL |
|------|-----|
| Dashboard | http://localhost:5174/ |
| Patients | http://localhost:5174/patients |
| Appointments | http://localhost:5174/appointments |
| Test Monitor | http://localhost:5174/test-monitor |
| API Testing | http://localhost:5174/test-monitor/api-testing |
| A/B Sandbox | http://localhost:5174/test-monitor/sandbox |
| AI Prompting | http://localhost:5174/test-monitor/ai-prompting |

---

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| Port 5174 in use | Another process | `netstat -ano \| findstr :5174` then `taskkill /PID <pid> /F` |
| Port 3001 in use | Another process | `netstat -ano \| findstr :3001` then `taskkill /PID <pid> /F` |
| Build fails - unused vars | TypeScript strict mode | Fix or remove unused variables |
| CORS error on Cloud9 | Missing proxy | Ensure vite.config.ts has cloud9-api proxy |
| Node Red connection refused | Node Red not running | Start Node Red or use mock server |
| Frontend blank page | Build error | Check `npm run build` output |

---

## Expected Final Status

```
=== Dentix Ortho Services ===

Build Status:
  ✓ Frontend: Built (1272 modules)
  ✓ Backend:  Built (TypeScript compiled)

Services Running:
  ✓ Frontend: http://localhost:5174
  ✓ Backend:  http://localhost:3001

API Proxies:
  ✓ Node Red: /FabricWorkflow/api/chord
  ✓ Cloud9:   /cloud9-api (sandbox)

All systems operational!
```

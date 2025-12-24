# Dynamic Agent Tuning System

A system that analyzes test failures and generates specific prompt/tool fixes rather than adjusting test patterns.

**Philosophy**: Fix the agent, not the tests.

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [CLI Commands](#cli-commands)
4. [End-to-End Flow](#end-to-end-flow)
5. [Analysis Methods](#analysis-methods)
6. [Fix Types](#fix-types)
7. [Database Schema](#database-schema)
8. [Configuration](#configuration)
9. [File Structure](#file-structure)

---

## Overview

### The Problem

Traditional e2e testing follows a reactive pattern:
- Test fails → Expand regex pattern to match actual behavior
- This leads to tests that describe what the agent does, not what it should do

### The Solution

Dynamic Agent Tuning inverts this:
- Test fails → Analyze WHY the agent responded incorrectly
- Generate specific fixes for the system prompt or tool code
- Tests remain prescriptive (define expected outcomes)

| Before | After |
|--------|-------|
| Test fails → Fix test pattern | Test fails → Fix agent behavior |
| Tests describe reality | Tests prescribe expectations |
| Reactive pattern matching | Proactive agent tuning |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    DYNAMIC AGENT TUNING SYSTEM                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │  Run Tests   │───►│ Capture Data │───►│ Failure Analyzer │  │
│  │  (diagnose)  │    │ - Transcript │    │ - LLM Analysis   │  │
│  │              │    │ - API Calls  │    │ - Rule-based     │  │
│  │              │    │ - Findings   │    │   Fallback       │  │
│  └──────────────┘    └──────────────┘    └────────┬─────────┘  │
│                                                   │             │
│                                                   ▼             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    FIX GENERATOR                         │  │
│  │  ┌─────────────────┐    ┌─────────────────────────────┐  │  │
│  │  │ Prompt Fixes    │    │ Tool Fixes                  │  │  │
│  │  │ - Add rule      │    │ - Add validation            │  │  │
│  │  │ - Add example   │    │ - Fix default value         │  │  │
│  │  │ - Ban word      │    │ - Add error handling        │  │  │
│  │  │ - Clarify phase │    │ - Fix parameter parsing     │  │  │
│  │  └─────────────────┘    └─────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                   │             │
│                                                   ▼             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    DATABASE                              │  │
│  │  - generated_fixes (pending/applied/rejected/verified)   │  │
│  │  - fix_outcomes (before/after test results)              │  │
│  │  - prompt_versions (track prompt evolution)              │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## CLI Commands

### `npm run diagnose`

Runs tests and analyzes failures to generate fix recommendations.

```bash
# Diagnose all test categories
npm run diagnose:all

# Diagnose only happy-path tests
npm run diagnose

# Diagnose without LLM (rule-based only)
npm run diagnose:no-llm
```

**Output:**
```
DYNAMIC AGENT TUNING
════════════════════════════════════════════════════════════

Phase 1: Running Tests...
  ✓ HAPPY-001: Passed
  ✗ HAPPY-002: Failed - Unexpected pattern found

Phase 2: Analyzing Failures...
  Analyzing: HAPPY-002 - step-booking
  Root cause: prompt-gap (confidence: 87%)
  Generated 2 fix(es)

Phase 3: Summary
  Total Failures: 1
  Fixes Generated: 2
  - Prompt fixes: 1
  - Tool fixes: 1
  - High confidence: 2
```

### `npm run fixes`

Lists all pending fixes awaiting review.

```bash
# Show all pending fixes
npm run fixes

# Show only prompt fixes
npm run fixes:prompt

# Show only tool fixes
npm run fixes:tool
```

**Output:**
```
PENDING FIXES (2)
════════════════════════════════════════════════════════════

[fix-abc123] PROMPT | Priority: HIGH | Confidence: 92%
  File: docs/Chord_Cloud9_SystemPrompt.md
  Section: Positive_Language_Rule
  Change: Add explicit ban for "unable"
  Affected Tests: HAPPY-002

[fix-def456] TOOL | Priority: CRITICAL | Confidence: 95%
  File: docs/chord_dso_scheduling-StepwiseSearch.js
  Function: book_child
  Change: Add default appointmentTypeGUID
  Affected Tests: HAPPY-002
```

### `npm run fix-report`

Generates a detailed markdown report of all fixes.

```bash
npm run fix-report
```

**Output:** Creates `data/reports/fix-report-{timestamp}.md`

### `npm run fix-status <fixId>`

Updates the status of a specific fix.

```bash
# Mark fix as applied
npm run fix-status fix-abc123 -- --status applied

# Mark fix as rejected
npm run fix-status fix-abc123 -- --status rejected
```

---

## End-to-End Flow

### Step 1: Run Diagnose Command

```bash
npm run diagnose
```

This triggers the following sequence:

1. **Test Execution** (`src/tests/test-runner.ts`)
   - Runs all test scenarios against the Flowise chatbot
   - Captures conversation transcripts, API calls, and findings
   - Records pass/fail status for each step

2. **Failure Detection** (`src/analysis/agent-failure-analyzer.ts`)
   - Identifies failed tests from the run
   - Builds failure context with transcript, API calls, and error details

3. **Root Cause Analysis** (`src/services/llm-analysis-service.ts`)
   - **LLM Mode**: Sends context to Claude API for deep analysis
   - **Rule-based Mode**: Uses pattern matching for common issues

4. **Fix Generation**
   - Generates specific prompt or tool fixes
   - Assigns confidence scores and priority levels
   - Deduplicates fixes across multiple failures

5. **Database Storage** (`src/storage/database.ts`)
   - Saves fixes to `generated_fixes` table
   - Status set to `pending` for manual review

### Step 2: Review Fixes

```bash
npm run fixes
```

Review the generated fixes:
- Each fix shows target file, location, and exact change
- Confidence score indicates likelihood of fixing the issue
- Priority helps determine which fixes to apply first

### Step 3: Apply Fixes (Manual)

Fixes are designed for **manual review**:
1. Copy the `changeCode` from the fix
2. Apply to the target file in Flowise
3. Update fix status: `npm run fix-status <id> -- --status applied`

### Step 4: Verify Fix

```bash
npm run diagnose
```

Re-run tests to verify the fix worked:
- If tests pass, the system marks the fix as `verified`
- If tests still fail, new analysis generates additional recommendations

---

## Analysis Methods

### LLM-Powered Analysis

When `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN` is set:

```typescript
// Sends structured prompt to Claude API
const prompt = `
You are analyzing a chatbot test failure for Allie IVA.

## System Prompt Being Tested
${systemPromptContent}

## Conversation Transcript
${transcript}

## Failure Details
- Expected: ${expectedPattern}
- Actual: ${actualResponse}

Identify ROOT CAUSE and generate SPECIFIC FIX...
`;
```

**Capabilities:**
- Understands context and conversation flow
- Identifies subtle prompt gaps
- Generates nuanced fixes with reasoning

### Rule-Based Analysis (Fallback)

When no API token is available:

```typescript
// Checks for common failure patterns
const bannedWords = ['sorry', 'error', 'problem', 'unable', 'cannot', 'failed'];

for (const word of bannedWords) {
  if (response.toLowerCase().includes(word)) {
    fixes.push({
      type: 'prompt',
      fixType: 'ban-word',
      changeCode: `- NEVER say "${word}" - use positive alternatives`,
      confidence: 0.9
    });
  }
}
```

**Detects:**
- Banned word usage
- Empty API parameters
- Tool call errors
- Missing required fields

---

## Fix Types

### Prompt Fixes

| Fix Type | Description | Example |
|----------|-------------|---------|
| `add-rule` | Add new behavioral rule | "ALWAYS confirm appointment details before booking" |
| `add-example` | Add example to clarify behavior | Show correct booking confirmation format |
| `clarify-instruction` | Make existing rule clearer | Expand ambiguous phrasing |
| `ban-word` | Explicitly ban problematic word | "NEVER say 'sorry'" |
| `add-phase-step` | Add step to conversation phase | Add availability check before offering times |
| `fix-format-spec` | Fix output format specification | Correct PAYLOAD field naming |

### Tool Fixes

| Fix Type | Description | Example |
|----------|-------------|---------|
| `add-default` | Add default parameter value | `appointmentTypeGUID \|\| defaultGUID` |
| `add-validation` | Add input validation | Check date is not in past |
| `fix-parsing` | Fix response parsing logic | Handle null in API response |
| `add-error-handling` | Add error handling | Catch and handle booking failures |
| `fix-parameter` | Fix parameter construction | Correct field naming in request |

---

## Database Schema

### generated_fixes

Stores all generated fix recommendations.

```sql
CREATE TABLE generated_fixes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fix_id TEXT UNIQUE NOT NULL,        -- e.g., "fix-abc123"
  run_id TEXT NOT NULL,               -- Test run that triggered this
  type TEXT NOT NULL,                 -- 'prompt' or 'tool'
  target_file TEXT NOT NULL,          -- File to modify
  change_description TEXT NOT NULL,   -- Human-readable description
  change_code TEXT NOT NULL,          -- Actual code/text to add
  location_json TEXT,                 -- Where in the file
  priority TEXT DEFAULT 'medium',     -- critical/high/medium/low
  confidence REAL DEFAULT 0.5,        -- 0.0 to 1.0
  affected_tests TEXT,                -- JSON array of test IDs
  root_cause_json TEXT,               -- Root cause analysis
  status TEXT DEFAULT 'pending',      -- pending/applied/rejected/verified
  created_at TEXT
);
```

### fix_outcomes

Tracks effectiveness of applied fixes.

```sql
CREATE TABLE fix_outcomes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fix_id TEXT NOT NULL,
  applied_at TEXT NOT NULL,
  tests_before TEXT,    -- JSON: tests that failed before
  tests_after TEXT,     -- JSON: tests that failed after
  effective INTEGER,    -- 1 if fewer tests fail after
  notes TEXT
);
```

### prompt_versions

Tracks system prompt evolution.

```sql
CREATE TABLE prompt_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  version TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  changes_from_previous TEXT,
  test_pass_rate REAL,
  captured_at TEXT
);
```

---

## Configuration

### config.ts

```typescript
// LLM Analysis Configuration
llmAnalysis: {
  provider: 'anthropic',
  model: 'claude-sonnet-4-20250514',
  maxTokens: 4096,
  temperature: 0.2,  // Low for consistent analysis
  apiKeyEnvVar: 'CLAUDE_CODE_OAUTH_TOKEN',
  timeout: 120000,   // 2 minutes
},

// Agent Tuning Configuration
agentTuning: {
  systemPromptPath: '../docs/Chord_Cloud9_SystemPrompt.md',
  schedulingToolPath: '../docs/chord_dso_scheduling-StepwiseSearch.js',
  patientToolPath: '../docs/chord_dso_patient-FIXED.js',
},
```

### Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `CLAUDE_CODE_OAUTH_TOKEN` | Claude Code OAuth token | No* |
| `ANTHROPIC_API_KEY` | Anthropic API key | No* |

*At least one is required for LLM analysis. If neither is set, falls back to rule-based analysis.

---

## File Structure

```
test-agent/
├── src/
│   ├── analysis/
│   │   └── agent-failure-analyzer.ts   # Orchestrates failure analysis
│   ├── services/
│   │   └── llm-analysis-service.ts     # Claude API integration
│   ├── storage/
│   │   └── database.ts                 # SQLite with fix tables
│   ├── config/
│   │   └── config.ts                   # LLM and tuning config
│   └── index.ts                        # CLI commands
├── data/
│   ├── test-results.db                 # SQLite database
│   └── reports/                        # Generated reports
└── DYNAMIC_AGENT_TUNING.md             # This file
```

---

## Quick Start

```bash
# 1. Run diagnosis (tests + analysis)
npm run diagnose

# 2. Review generated fixes
npm run fixes

# 3. Apply fix manually to Flowise

# 4. Update fix status
npm run fix-status fix-abc123 -- --status applied

# 5. Re-run to verify
npm run diagnose
```

---

## Example Output

### Successful Fix Generation

```
══════════════════════════════════════════════════
 AGENT TUNING RECOMMENDATIONS
══════════════════════════════════════════════════

Test Run: run-2025-12-24-abc123
Failed: 1/3 tests

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FIX #1 [PROMPT] Priority: HIGH | Confidence: 92%
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Problem: Agent used banned word "unable" in booking step
Affected Tests: HAPPY-002

Root Cause: Missing explicit ban in Positive_Language_Rule

Suggested Fix:
  File: docs/Chord_Cloud9_SystemPrompt.md
  Section: <Positive_Language_Rule>
  Action: APPEND

  +  - NEVER say "unable" - instead say "Let me find another option"

══════════════════════════════════════════════════
```

### All Tests Pass

```
DYNAMIC AGENT TUNING
════════════════════════════════════════════════════════════

Phase 1: Running Tests...
  ✓ HAPPY-001: Passed
  ✓ HAPPY-002: Passed
  ✓ HAPPY-003: Passed

All tests passed! No diagnosis needed.
```

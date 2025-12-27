# Claude CLI LLM Service Skill

Use this skill when making LLM calls in the dentix-ortho project. Always use the Claude CLI service instead of direct API calls.

## Overview

The `shared/services/claude-cli-service.ts` provides a reliable way to make LLM calls using the Claude CLI. It handles:
- Temp file creation for prompts (avoids shell escaping issues)
- Model name mapping (opus, sonnet, haiku)
- JSON output parsing
- Error handling and timeouts

## Service Location

```
shared/services/claude-cli-service.ts
```

## Configuration

Set in `.env` file:
```env
USE_CLAUDE_CLI=true
```

The LLM provider (`shared/services/llm-provider.ts`) checks this env var via `shared/config/llm-config.ts`.

## How to Use

### Option 1: Via LLM Provider (Recommended)

```typescript
import { getLLMProvider } from '../../../shared/services/llm-provider';

const llmProvider = getLLMProvider();

// Check availability
const status = await llmProvider.checkAvailability();
if (!status.available) {
  console.error('LLM not available:', status.error);
  return;
}

// Execute request
const response = await llmProvider.execute({
  prompt: 'Your prompt here',
  model: 'sonnet',  // or 'opus', 'haiku'
  maxTokens: 2048,
  temperature: 0.2,
  systemPrompt: 'Optional system prompt',
  timeout: 30000,
});

if (response.success) {
  console.log('Result:', response.content);
} else {
  console.error('Error:', response.error);
}
```

### Option 2: Direct CLI Service Usage

```typescript
import { claudeCliService } from '../../../shared/services/claude-cli-service';

// Check status first
const status = await claudeCliService.checkStatus();
if (!status.installed || !status.authenticated) {
  console.error('CLI not ready:', status.error);
  return;
}

// Execute
const response = await claudeCliService.execute({
  prompt: 'Your prompt here',
  model: 'sonnet',
  timeout: 30000,
});

if (response.success) {
  console.log('Result:', response.result);
  console.log('Usage:', response.usage);
} else {
  console.error('Error:', response.error);
}
```

## How Prompts Are Handled

The CLI service ALWAYS uses temp files to pass prompts. This avoids shell escaping issues on Windows.

### Internal Flow:
1. Prompt is written to a temp file in `os.tmpdir()`
2. File is piped to Claude CLI via stdin: `type "tempfile.txt" | claude --print ...`
3. Temp file is cleaned up after execution

### Temp File Pattern:
```typescript
const tempFile = path.join(os.tmpdir(), `claude-prompt-${Date.now()}-${random}.txt`);
fs.writeFileSync(tempFile, prompt, 'utf8');
```

## Model Name Mapping

The service maps full model names to CLI aliases:

| Full Model Name | CLI Alias |
|-----------------|-----------|
| `claude-opus-4-5-20251101` | `opus` |
| `claude-sonnet-4-5-20250929` | `sonnet` |
| `claude-sonnet-4-20250514` | `sonnet` |
| `claude-haiku-4-5-20251001` | `haiku` |

You can use either the full name or the alias.

## CLI Arguments Used

```bash
claude --print --output-format json --model <model> < prompt.txt
```

- `--print`: Non-interactive mode, outputs result and exits
- `--output-format json`: Returns structured JSON response
- `--model`: Specifies which model to use

## Response Format

### Success Response:
```typescript
{
  success: true,
  result: "The LLM's response text",
  durationMs: 1234,
  usage: {
    inputTokens: 100,
    outputTokens: 50,
    costUsd: 0.001
  }
}
```

### Error Response:
```typescript
{
  success: false,
  error: "Error message",
  durationMs: 1234
}
```

## Example: Structured JSON Output

When you need JSON output from the LLM:

```typescript
const prompt = `Analyze this text and return JSON:

Text: "${userText}"

Return ONLY a JSON object with this structure:
\`\`\`json
{
  "sentiment": "positive" | "negative" | "neutral",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}
\`\`\``;

const response = await llmProvider.execute({
  prompt,
  model: 'haiku',  // Use haiku for simple tasks
  temperature: 0.1,  // Low temp for consistent JSON
});

if (response.success) {
  // Extract JSON from response
  const jsonMatch = response.content?.match(/```json\s*([\s\S]*?)\s*```/) ||
                    response.content?.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    const result = JSON.parse(jsonMatch[1] || jsonMatch[0]);
    console.log('Parsed result:', result);
  }
}
```

## Example: Intent Detection

```typescript
const prompt = `Classify the intent of this chatbot response:

Response: "${botResponse}"

Possible intents:
- greeting: Bot is greeting the user
- asking_name: Bot is asking for user's name
- confirming_booking: Bot confirms an appointment is scheduled
- unknown: Cannot determine intent

Return JSON:
{
  "intent": "<intent>",
  "confidence": 0.0-1.0
}`;

const response = await llmProvider.execute({
  prompt,
  model: 'haiku',
  temperature: 0.1,
});
```

## Error Handling Best Practices

```typescript
async function safeLLMCall(prompt: string): Promise<string | null> {
  const llmProvider = getLLMProvider();

  try {
    // Check availability first
    const status = await llmProvider.checkAvailability();
    if (!status.available) {
      console.warn('[LLM] Not available:', status.error);
      return null;
    }

    const response = await llmProvider.execute({
      prompt,
      model: 'sonnet',
      timeout: 60000,
    });

    if (!response.success) {
      console.error('[LLM] Call failed:', response.error);
      return null;
    }

    return response.content || null;
  } catch (error) {
    console.error('[LLM] Unexpected error:', error);
    return null;
  }
}
```

## Timeouts

Default timeout is 120 seconds. For long-running tasks, increase it:

```typescript
const response = await llmProvider.execute({
  prompt: longPrompt,
  model: 'opus',
  timeout: 300000,  // 5 minutes
});
```

## Testing CLI Availability

```typescript
import { claudeCliService } from '../../../shared/services/claude-cli-service';

async function testCli() {
  const status = await claudeCliService.checkStatus();

  console.log('Installed:', status.installed);
  console.log('Authenticated:', status.authenticated);
  console.log('Version:', status.version);

  if (status.error) {
    console.error('Error:', status.error);
  }
}
```

## Common Issues

### "Input must be provided" Error
This was caused by shell escaping issues. The service now always uses temp files to avoid this.

### CLI Not Found
Ensure Claude CLI is installed and in PATH:
```bash
claude --version
```

### Not Authenticated
Run authentication:
```bash
claude login
```

### Timeout Errors
Increase timeout for complex prompts or use a faster model (haiku).

## Files Reference

| File | Purpose |
|------|---------|
| `shared/services/claude-cli-service.ts` | Core CLI wrapper |
| `shared/services/llm-provider.ts` | Abstraction layer (CLI/API) |
| `shared/config/llm-config.ts` | Configuration helpers |
| `.env` | Environment variables |

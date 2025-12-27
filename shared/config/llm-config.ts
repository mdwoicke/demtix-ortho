/**
 * LLM Configuration
 * Shared configuration for LLM services across backend and test-agent
 */

import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

export interface LLMConfig {
  useClaudeCli: boolean;
  apiKey?: string;
  defaultModel: string;
  timeout: number;
}

/**
 * Check if Claude CLI mode is enabled
 */
export function isClaudeCliEnabled(): boolean {
  return process.env.USE_CLAUDE_CLI === 'true';
}

/**
 * Get the full LLM configuration
 */
export function getLLMConfig(): LLMConfig {
  return {
    useClaudeCli: process.env.USE_CLAUDE_CLI === 'true',
    apiKey: process.env.CLAUDE_CODE_OAUTH_TOKEN || process.env.ANTHROPIC_API_KEY,
    defaultModel: 'claude-sonnet-4-20250514',
    timeout: 120000, // 2 minutes
  };
}

/**
 * Get the API key from environment variables
 * Checks CLAUDE_CODE_OAUTH_TOKEN first, then ANTHROPIC_API_KEY
 */
export function getApiKey(): string | undefined {
  return process.env.CLAUDE_CODE_OAUTH_TOKEN || process.env.ANTHROPIC_API_KEY;
}

/**
 * Check if any LLM provider is available (CLI or API)
 */
export function hasLLMProvider(): boolean {
  if (isClaudeCliEnabled()) {
    // CLI mode - will check availability at runtime
    return true;
  }
  // API mode - check for API key
  return !!getApiKey();
}

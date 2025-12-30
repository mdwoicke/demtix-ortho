/**
 * LLM Configuration
 * Shared configuration for LLM services across backend and test-agent
 */
export interface LLMConfig {
    useClaudeCli: boolean;
    apiKey?: string;
    defaultModel: string;
    timeout: number;
}
/**
 * Get the OAuth access token from Claude credentials file
 */
export declare function getOAuthToken(): string | undefined;
/**
 * Clear the credentials cache (useful for testing or after token refresh)
 */
export declare function clearCredentialsCache(): void;
/**
 * Check if Claude CLI mode is enabled
 */
export declare function isClaudeCliEnabled(): boolean;
/**
 * Get the full LLM configuration
 */
export declare function getLLMConfig(): LLMConfig;
/**
 * Get the API key/token for LLM access
 * Priority:
 * 1. ANTHROPIC_API_KEY env var (direct API key)
 * 2. OAuth token from ~/.claude/.credentials.json
 * 3. CLAUDE_CODE_OAUTH_TOKEN env var (legacy fallback)
 */
export declare function getApiKey(): string | undefined;
/**
 * Check if any LLM provider is available (CLI or API)
 */
export declare function hasLLMProvider(): boolean;
//# sourceMappingURL=llm-config.d.ts.map
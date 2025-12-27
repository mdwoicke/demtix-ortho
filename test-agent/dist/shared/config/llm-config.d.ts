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
 * Check if Claude CLI mode is enabled
 */
export declare function isClaudeCliEnabled(): boolean;
/**
 * Get the full LLM configuration
 */
export declare function getLLMConfig(): LLMConfig;
/**
 * Get the API key from environment variables
 * Checks CLAUDE_CODE_OAUTH_TOKEN first, then ANTHROPIC_API_KEY
 */
export declare function getApiKey(): string | undefined;
/**
 * Check if any LLM provider is available (CLI or API)
 */
export declare function hasLLMProvider(): boolean;
//# sourceMappingURL=llm-config.d.ts.map
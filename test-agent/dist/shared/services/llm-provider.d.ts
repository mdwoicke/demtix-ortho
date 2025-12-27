/**
 * LLM Provider Abstraction
 * Strategy pattern to switch between Claude CLI and Anthropic API
 */
export interface LLMRequest {
    prompt: string;
    model?: string;
    maxTokens?: number;
    temperature?: number;
    systemPrompt?: string;
    timeout?: number;
}
export interface LLMResponse {
    success: boolean;
    content?: string;
    error?: string;
    usage?: {
        inputTokens: number;
        outputTokens: number;
    };
    provider: 'api' | 'cli' | 'none';
    durationMs?: number;
}
export interface LLMProviderStatus {
    available: boolean;
    provider: 'api' | 'cli' | 'none';
    error?: string;
    cliStatus?: {
        installed: boolean;
        authenticated: boolean;
        version?: string;
    };
}
export declare class LLMProvider {
    private anthropicClient;
    private useCliMode;
    constructor();
    /**
     * Initialize the Anthropic API client
     */
    private initializeApiClient;
    /**
     * Check if LLM is available (either via CLI or API)
     */
    checkAvailability(): Promise<LLMProviderStatus>;
    /**
     * Check if the provider is available (sync check based on config)
     */
    isAvailable(): boolean;
    /**
     * Get the current provider mode
     */
    getMode(): 'cli' | 'api';
    /**
     * Execute an LLM request
     */
    execute(request: LLMRequest): Promise<LLMResponse>;
    /**
     * Execute request via Claude CLI
     */
    private executeViaCli;
    /**
     * Execute request via Anthropic API
     */
    private executeViaApi;
}
/**
 * Get the singleton LLM provider instance
 */
export declare function getLLMProvider(): LLMProvider;
/**
 * Reset the provider instance (useful for testing)
 */
export declare function resetLLMProvider(): void;
//# sourceMappingURL=llm-provider.d.ts.map
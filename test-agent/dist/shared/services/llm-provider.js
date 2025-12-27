"use strict";
/**
 * LLM Provider Abstraction
 * Strategy pattern to switch between Claude CLI and Anthropic API
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LLMProvider = void 0;
exports.getLLMProvider = getLLMProvider;
exports.resetLLMProvider = resetLLMProvider;
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const claude_cli_service_1 = require("./claude-cli-service");
const llm_config_1 = require("../config/llm-config");
// ============================================================================
// LLM Provider
// ============================================================================
class LLMProvider {
    constructor() {
        this.anthropicClient = null;
        this.useCliMode = (0, llm_config_1.isClaudeCliEnabled)();
        if (!this.useCliMode) {
            this.initializeApiClient();
        }
    }
    /**
     * Initialize the Anthropic API client
     */
    initializeApiClient() {
        const apiKey = (0, llm_config_1.getApiKey)();
        if (apiKey) {
            this.anthropicClient = new sdk_1.default({ apiKey });
            console.log('[LLMProvider] Initialized with Anthropic API');
        }
        else {
            console.log('[LLMProvider] No API key found');
        }
    }
    /**
     * Check if LLM is available (either via CLI or API)
     */
    async checkAvailability() {
        if (this.useCliMode) {
            const cliStatus = await claude_cli_service_1.claudeCliService.checkStatus();
            if (cliStatus.installed && cliStatus.authenticated) {
                return {
                    available: true,
                    provider: 'cli',
                    cliStatus: {
                        installed: cliStatus.installed,
                        authenticated: cliStatus.authenticated,
                        version: cliStatus.version,
                    },
                };
            }
            // CLI not available, check for API fallback
            if (!this.anthropicClient) {
                this.initializeApiClient();
            }
            if (this.anthropicClient) {
                console.log('[LLMProvider] CLI unavailable, falling back to API');
                return {
                    available: true,
                    provider: 'api',
                    error: cliStatus.error,
                    cliStatus: {
                        installed: cliStatus.installed,
                        authenticated: cliStatus.authenticated,
                        version: cliStatus.version,
                    },
                };
            }
            return {
                available: false,
                provider: 'none',
                error: cliStatus.error || 'Claude CLI not available and no API key configured',
                cliStatus: {
                    installed: cliStatus.installed,
                    authenticated: cliStatus.authenticated,
                    version: cliStatus.version,
                },
            };
        }
        else {
            // API mode
            return {
                available: this.anthropicClient !== null,
                provider: this.anthropicClient ? 'api' : 'none',
                error: this.anthropicClient ? undefined : 'No API key configured (set CLAUDE_CODE_OAUTH_TOKEN or ANTHROPIC_API_KEY)',
            };
        }
    }
    /**
     * Check if the provider is available (sync check based on config)
     */
    isAvailable() {
        if (this.useCliMode) {
            // CLI mode - we assume it might be available, actual check is async
            return true;
        }
        return this.anthropicClient !== null;
    }
    /**
     * Get the current provider mode
     */
    getMode() {
        return this.useCliMode ? 'cli' : 'api';
    }
    /**
     * Execute an LLM request
     */
    async execute(request) {
        const startTime = Date.now();
        if (this.useCliMode) {
            // Try CLI first
            const cliStatus = await claude_cli_service_1.claudeCliService.checkStatus();
            if (cliStatus.installed && cliStatus.authenticated) {
                return this.executeViaCli(request);
            }
            // Fallback to API if CLI unavailable
            console.warn('[LLMProvider] CLI unavailable, attempting API fallback');
            if (!this.anthropicClient) {
                this.initializeApiClient();
            }
            if (this.anthropicClient) {
                return this.executeViaApi(request);
            }
            return {
                success: false,
                error: `Claude CLI not available: ${cliStatus.error}. No API key configured for fallback.`,
                provider: 'none',
                durationMs: Date.now() - startTime,
            };
        }
        else {
            // API mode
            if (this.anthropicClient) {
                return this.executeViaApi(request);
            }
            return {
                success: false,
                error: 'Anthropic API client not initialized. Set CLAUDE_CODE_OAUTH_TOKEN or ANTHROPIC_API_KEY.',
                provider: 'none',
                durationMs: Date.now() - startTime,
            };
        }
    }
    /**
     * Execute request via Claude CLI
     */
    async executeViaCli(request) {
        const cliRequest = {
            prompt: request.prompt,
            model: request.model,
            systemPrompt: request.systemPrompt,
            timeout: request.timeout,
        };
        const cliResponse = await claude_cli_service_1.claudeCliService.execute(cliRequest);
        return {
            success: cliResponse.success,
            content: cliResponse.result,
            error: cliResponse.error,
            usage: cliResponse.usage,
            provider: 'cli',
            durationMs: cliResponse.durationMs,
        };
    }
    /**
     * Execute request via Anthropic API
     */
    async executeViaApi(request) {
        if (!this.anthropicClient) {
            return {
                success: false,
                error: 'Anthropic API client not initialized',
                provider: 'api',
            };
        }
        const startTime = Date.now();
        try {
            const messages = [
                { role: 'user', content: request.prompt },
            ];
            const config = (0, llm_config_1.getLLMConfig)();
            const response = await this.anthropicClient.messages.create({
                model: request.model || config.defaultModel,
                max_tokens: request.maxTokens || 4096,
                temperature: request.temperature ?? 0.2,
                system: request.systemPrompt,
                messages,
            }, {
                timeout: request.timeout || config.timeout,
            });
            const textContent = response.content.find(c => c.type === 'text');
            const content = textContent?.type === 'text' ? textContent.text : '';
            return {
                success: true,
                content,
                usage: {
                    inputTokens: response.usage?.input_tokens || 0,
                    outputTokens: response.usage?.output_tokens || 0,
                },
                provider: 'api',
                durationMs: Date.now() - startTime,
            };
        }
        catch (error) {
            return {
                success: false,
                error: error.message,
                provider: 'api',
                durationMs: Date.now() - startTime,
            };
        }
    }
}
exports.LLMProvider = LLMProvider;
// ============================================================================
// Singleton Factory
// ============================================================================
let providerInstance = null;
/**
 * Get the singleton LLM provider instance
 */
function getLLMProvider() {
    if (!providerInstance) {
        providerInstance = new LLMProvider();
    }
    return providerInstance;
}
/**
 * Reset the provider instance (useful for testing)
 */
function resetLLMProvider() {
    providerInstance = null;
}
//# sourceMappingURL=llm-provider.js.map
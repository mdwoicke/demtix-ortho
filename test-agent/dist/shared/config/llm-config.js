"use strict";
/**
 * LLM Configuration
 * Shared configuration for LLM services across backend and test-agent
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.isClaudeCliEnabled = isClaudeCliEnabled;
exports.getLLMConfig = getLLMConfig;
exports.getApiKey = getApiKey;
exports.hasLLMProvider = hasLLMProvider;
const dotenv = __importStar(require("dotenv"));
// Load environment variables
dotenv.config();
/**
 * Check if Claude CLI mode is enabled
 */
function isClaudeCliEnabled() {
    return process.env.USE_CLAUDE_CLI === 'true';
}
/**
 * Get the full LLM configuration
 */
function getLLMConfig() {
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
function getApiKey() {
    return process.env.CLAUDE_CODE_OAUTH_TOKEN || process.env.ANTHROPIC_API_KEY;
}
/**
 * Check if any LLM provider is available (CLI or API)
 */
function hasLLMProvider() {
    if (isClaudeCliEnabled()) {
        // CLI mode - will check availability at runtime
        return true;
    }
    // API mode - check for API key
    return !!getApiKey();
}
//# sourceMappingURL=llm-config.js.map
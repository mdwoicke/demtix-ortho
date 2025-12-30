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
exports.getOAuthToken = getOAuthToken;
exports.clearCredentialsCache = clearCredentialsCache;
exports.isClaudeCliEnabled = isClaudeCliEnabled;
exports.getLLMConfig = getLLMConfig;
exports.getApiKey = getApiKey;
exports.hasLLMProvider = hasLLMProvider;
const dotenv = __importStar(require("dotenv"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
// Load environment variables
dotenv.config();
// ============================================================================
// Credentials Cache
// ============================================================================
let cachedCredentials = null;
let credentialsCacheTime = 0;
const CREDENTIALS_CACHE_TTL = 60000; // 1 minute cache
/**
 * Get the path to Claude credentials file
 */
function getCredentialsPath() {
    // Check for custom path in environment
    if (process.env.CLAUDE_CREDENTIALS_PATH) {
        return process.env.CLAUDE_CREDENTIALS_PATH;
    }
    // Default: ~/.claude/.credentials.json
    return path.join(os.homedir(), '.claude', '.credentials.json');
}
/**
 * Load Claude credentials from the credentials file
 * Caches the result for 1 minute to avoid excessive file reads
 */
function loadClaudeCredentials() {
    // Return cached if fresh
    if (cachedCredentials && Date.now() - credentialsCacheTime < CREDENTIALS_CACHE_TTL) {
        return cachedCredentials;
    }
    const credentialsPath = getCredentialsPath();
    try {
        if (!fs.existsSync(credentialsPath)) {
            console.log(`[LLMConfig] Credentials file not found: ${credentialsPath}`);
            return null;
        }
        const content = fs.readFileSync(credentialsPath, 'utf8');
        cachedCredentials = JSON.parse(content);
        credentialsCacheTime = Date.now();
        // Check if token is expired
        if (cachedCredentials.claudeAiOauth) {
            const expiresAt = cachedCredentials.claudeAiOauth.expiresAt;
            if (expiresAt && Date.now() > expiresAt) {
                console.warn('[LLMConfig] OAuth token is expired');
            }
        }
        return cachedCredentials;
    }
    catch (error) {
        console.error(`[LLMConfig] Failed to load credentials: ${error.message}`);
        return null;
    }
}
/**
 * Get the OAuth access token from Claude credentials file
 */
function getOAuthToken() {
    const credentials = loadClaudeCredentials();
    return credentials?.claudeAiOauth?.accessToken;
}
/**
 * Clear the credentials cache (useful for testing or after token refresh)
 */
function clearCredentialsCache() {
    cachedCredentials = null;
    credentialsCacheTime = 0;
}
// ============================================================================
// Configuration Functions
// ============================================================================
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
        apiKey: getApiKey(),
        defaultModel: 'claude-sonnet-4-20250514',
        timeout: 120000, // 2 minutes
    };
}
/**
 * Get the API key/token for LLM access
 * Priority:
 * 1. ANTHROPIC_API_KEY env var (direct API key)
 * 2. OAuth token from ~/.claude/.credentials.json
 * 3. CLAUDE_CODE_OAUTH_TOKEN env var (legacy fallback)
 */
function getApiKey() {
    // Direct API key takes priority (works with Anthropic SDK)
    if (process.env.ANTHROPIC_API_KEY) {
        return process.env.ANTHROPIC_API_KEY;
    }
    // Try to load OAuth token from credentials file
    const oauthToken = getOAuthToken();
    if (oauthToken) {
        return oauthToken;
    }
    // Legacy fallback to env var
    return process.env.CLAUDE_CODE_OAUTH_TOKEN;
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
"use strict";
/**
 * Flowise API Client
 * Handles communication with the Flowise prediction API
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlowiseClient = void 0;
const axios_1 = __importDefault(require("axios"));
const uuid_1 = require("uuid");
const config_1 = require("../config/config");
class FlowiseClient {
    constructor(sessionId) {
        this.sessionId = sessionId || (0, uuid_1.v4)();
        this.client = axios_1.default.create({
            baseURL: config_1.config.flowise.endpoint,
            timeout: config_1.config.flowise.timeout,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }
    /**
     * Send a message to the Flowise API
     */
    async sendMessage(question) {
        const startTime = Date.now();
        const payload = {
            question,
            overrideConfig: {
                sessionId: this.sessionId,
            },
        };
        let lastError = null;
        for (let attempt = 1; attempt <= config_1.config.flowise.retryAttempts; attempt++) {
            try {
                const response = await this.client.post('', payload);
                const responseTime = Date.now() - startTime;
                // Handle different response formats from Flowise
                const text = this.extractText(response.data);
                // Extract tool calls from the response
                const toolCalls = this.extractToolCalls(response.data);
                return {
                    text,
                    sessionId: this.sessionId,
                    responseTime,
                    rawResponse: response.data,
                    toolCalls,
                };
            }
            catch (error) {
                lastError = error;
                if (attempt < config_1.config.flowise.retryAttempts) {
                    await this.delay(config_1.config.flowise.retryDelay * attempt);
                }
            }
        }
        throw this.createError(lastError);
    }
    /**
     * Extract text from various Flowise response formats
     */
    extractText(data) {
        if (typeof data === 'string') {
            return data;
        }
        if (data.text) {
            return data.text;
        }
        if (data.answer) {
            return data.answer;
        }
        if (data.response) {
            return data.response;
        }
        if (data.output) {
            return data.output;
        }
        return JSON.stringify(data);
    }
    /**
     * Extract tool calls from Flowise response
     * Flowise can return tool/function calls in various formats
     */
    extractToolCalls(data) {
        const toolCalls = [];
        if (!data || typeof data !== 'object') {
            return toolCalls;
        }
        // Extract the text content to look for embedded PAYLOAD
        const textContent = this.extractText(data);
        // Check for embedded PAYLOAD in the response text
        // Format: ANSWER: ... PAYLOAD: { JSON }
        const payloadIndex = textContent.toUpperCase().indexOf('PAYLOAD:');
        if (payloadIndex !== -1) {
            const payloadSection = textContent.substring(payloadIndex + 8).trim();
            // Find the JSON object - handle nested braces
            const jsonStart = payloadSection.indexOf('{');
            if (jsonStart !== -1) {
                let braceCount = 0;
                let jsonEnd = jsonStart;
                for (let i = jsonStart; i < payloadSection.length; i++) {
                    if (payloadSection[i] === '{')
                        braceCount++;
                    if (payloadSection[i] === '}')
                        braceCount--;
                    if (braceCount === 0) {
                        jsonEnd = i + 1;
                        break;
                    }
                }
                const jsonStr = payloadSection.substring(jsonStart, jsonEnd);
                try {
                    const payloadJson = JSON.parse(jsonStr);
                    toolCalls.push({
                        toolName: 'flowise_payload',
                        input: null,
                        output: payloadJson,
                        status: 'completed',
                    });
                }
                catch (e) {
                    // Store as raw text if parsing fails
                    toolCalls.push({
                        toolName: 'flowise_payload',
                        input: null,
                        output: { raw: jsonStr },
                        status: 'completed',
                    });
                }
            }
        }
        // Check for agentReasoning array (common in Flowise agent responses)
        if (Array.isArray(data.agentReasoning)) {
            for (const step of data.agentReasoning) {
                if (step.usedTools && Array.isArray(step.usedTools)) {
                    for (const tool of step.usedTools) {
                        toolCalls.push({
                            toolName: tool.tool || tool.name || 'unknown',
                            input: tool.toolInput || tool.input,
                            output: tool.toolOutput || tool.output,
                            status: tool.status || 'completed',
                        });
                    }
                }
                // Also check for single tool usage
                if (step.tool || step.toolName) {
                    toolCalls.push({
                        toolName: step.tool || step.toolName,
                        input: step.toolInput || step.input,
                        output: step.toolOutput || step.output,
                        status: step.status || 'completed',
                    });
                }
            }
        }
        // Check for tool_calls array (OpenAI function calling format)
        if (Array.isArray(data.tool_calls)) {
            for (const call of data.tool_calls) {
                toolCalls.push({
                    toolName: call.function?.name || call.name || 'unknown',
                    input: call.function?.arguments || call.arguments,
                    output: call.output || call.result,
                    status: 'completed',
                });
            }
        }
        // Check for function_call (single function call format)
        if (data.function_call) {
            toolCalls.push({
                toolName: data.function_call.name || 'unknown',
                input: data.function_call.arguments,
                output: data.function_call.output,
                status: 'completed',
            });
        }
        // Check for usedTools at the top level
        if (Array.isArray(data.usedTools)) {
            for (const tool of data.usedTools) {
                toolCalls.push({
                    toolName: tool.tool || tool.name || 'unknown',
                    input: tool.toolInput || tool.input,
                    output: tool.toolOutput || tool.output,
                    status: tool.status || 'completed',
                });
            }
        }
        // Check for sourceDocuments (RAG responses may contain retrieval info)
        if (Array.isArray(data.sourceDocuments)) {
            toolCalls.push({
                toolName: 'document_retrieval',
                input: { query: 'vector search' },
                output: data.sourceDocuments.map((doc) => ({
                    pageContent: doc.pageContent?.substring(0, 200),
                    metadata: doc.metadata,
                })),
                status: 'completed',
            });
        }
        return toolCalls;
    }
    /**
     * Create a standardized error object
     */
    createError(error) {
        if (axios_1.default.isAxiosError(error)) {
            return {
                message: error.response?.data?.message || error.message,
                code: error.code || 'UNKNOWN_ERROR',
                statusCode: error.response?.status,
            };
        }
        return {
            message: error?.message || 'Unknown error',
            code: 'UNKNOWN_ERROR',
        };
    }
    /**
     * Create a new session
     */
    newSession() {
        this.sessionId = (0, uuid_1.v4)();
        return this.sessionId;
    }
    /**
     * Get current session ID
     */
    getSessionId() {
        return this.sessionId;
    }
    /**
     * Helper delay function
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.FlowiseClient = FlowiseClient;
//# sourceMappingURL=flowise-client.js.map
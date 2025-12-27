/**
 * Flowise API Client
 * Handles communication with the Flowise prediction API
 */
export interface ToolCall {
    toolName: string;
    input?: any;
    output?: any;
    status?: string;
    durationMs?: number;
}
export interface FlowiseResponse {
    text: string;
    sessionId: string;
    responseTime: number;
    rawResponse: any;
    toolCalls: ToolCall[];
}
export interface FlowiseError {
    message: string;
    code: string;
    statusCode?: number;
}
export declare class FlowiseClient {
    private client;
    private sessionId;
    constructor(sessionId?: string);
    /**
     * Send a message to the Flowise API
     */
    sendMessage(question: string): Promise<FlowiseResponse>;
    /**
     * Extract text from various Flowise response formats
     */
    private extractText;
    /**
     * Extract tool calls from Flowise response
     * Flowise can return tool/function calls in various formats
     */
    private extractToolCalls;
    /**
     * Create a standardized error object
     */
    private createError;
    /**
     * Create a new session
     */
    newSession(): string;
    /**
     * Get current session ID
     */
    getSessionId(): string;
    /**
     * Helper delay function
     */
    private delay;
}
//# sourceMappingURL=flowise-client.d.ts.map
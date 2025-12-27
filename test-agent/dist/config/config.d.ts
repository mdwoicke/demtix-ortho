/**
 * Configuration for the E2E Testing Agent
 */
export declare const config: {
    flowise: {
        endpoint: string;
        timeout: number;
        retryAttempts: number;
        retryDelay: number;
    };
    backend: {
        baseUrl: string;
        timeout: number;
    };
    database: {
        path: string;
    };
    output: {
        transcriptsDir: string;
        reportsDir: string;
    };
    tests: {
        defaultDelayBetweenSteps: number;
        maxConversationTurns: number;
    };
    llmAnalysis: {
        provider: "anthropic";
        model: string;
        maxTokens: number;
        temperature: number;
        apiKeyEnvVar: string;
        timeout: number;
    };
    agentTuning: {
        systemPromptPath: string;
        schedulingToolPath: string;
        patientToolPath: string;
    };
    semanticEvaluation: {
        enabled: boolean;
        mode: "realtime" | "batch" | "failures-only";
        fallbackToRegex: boolean;
        cacheEnabled: boolean;
        cacheTTLMs: number;
        minConfidenceThreshold: number;
        batchSize: number;
        timeout: number;
    };
};
export type Config = typeof config;
//# sourceMappingURL=config.d.ts.map
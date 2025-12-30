"use strict";
/**
 * Quick test script to verify Claude CLI service works
 */
Object.defineProperty(exports, "__esModule", { value: true });
const claude_cli_service_1 = require("../../shared/services/claude-cli-service");
async function testCli() {
    console.log('=== Claude CLI Service Test ===\n');
    // Step 1: Check status
    console.log('1. Checking CLI status...');
    const status = await claude_cli_service_1.claudeCliService.checkStatus();
    console.log('   Installed:', status.installed);
    console.log('   Authenticated:', status.authenticated);
    console.log('   Version:', status.version || 'N/A');
    if (status.error) {
        console.log('   Error:', status.error);
    }
    if (!status.installed || !status.authenticated) {
        console.log('\nCLI not ready. Please run: claude login');
        process.exit(1);
    }
    // Step 2: Run a simple prompt
    console.log('\n2. Running test prompt...');
    const response = await claude_cli_service_1.claudeCliService.execute({
        prompt: 'Respond with only: hello world',
        model: 'haiku',
        timeout: 30000,
    });
    console.log('   Success:', response.success);
    console.log('   Result:', response.result?.substring(0, 100));
    console.log('   Duration:', response.durationMs, 'ms');
    if (response.usage) {
        console.log('   Input tokens:', response.usage.inputTokens);
        console.log('   Output tokens:', response.usage.outputTokens);
    }
    if (response.error) {
        console.log('   Error:', response.error);
    }
    console.log('\n=== Test Complete ===');
}
testCli().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
//# sourceMappingURL=test-cli.js.map
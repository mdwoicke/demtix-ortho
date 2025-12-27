/**
 * Claude CLI Service
 * Wraps the Claude CLI as a subprocess for LLM operations
 */

import { spawn } from 'child_process';

// ============================================================================
// Types
// ============================================================================

export interface ClaudeCliRequest {
  prompt: string;
  model?: string;  // 'sonnet', 'opus', 'haiku' or full model name
  systemPrompt?: string;
  timeout?: number;
}

export interface ClaudeCliResponse {
  success: boolean;
  result?: string;
  error?: string;
  durationMs?: number;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
  };
}

export interface ClaudeCliStatus {
  installed: boolean;
  authenticated: boolean;
  version?: string;
  error?: string;
}

// ============================================================================
// Claude CLI Service
// ============================================================================

export class ClaudeCliService {
  private static instance: ClaudeCliService;
  private statusCache: ClaudeCliStatus | null = null;
  private statusCacheTime: number = 0;
  private readonly STATUS_CACHE_TTL = 60000; // 1 minute

  static getInstance(): ClaudeCliService {
    if (!ClaudeCliService.instance) {
      ClaudeCliService.instance = new ClaudeCliService();
    }
    return ClaudeCliService.instance;
  }

  /**
   * Check if Claude CLI is installed and authenticated
   */
  async checkStatus(): Promise<ClaudeCliStatus> {
    // Return cached status if fresh
    if (this.statusCache && Date.now() - this.statusCacheTime < this.STATUS_CACHE_TTL) {
      return this.statusCache;
    }

    try {
      // Check if CLI is installed by running --version
      const versionResult = await this.runCommand(['--version'], 10000);
      if (!versionResult.success) {
        this.statusCache = {
          installed: false,
          authenticated: false,
          error: 'Claude CLI not installed or not in PATH',
        };
        this.statusCacheTime = Date.now();
        return this.statusCache;
      }

      // Check if authenticated by running a minimal prompt
      const authResult = await this.runCommand([
        '--print',
        '--output-format', 'json',
        '--no-session-persistence',
        '--model', 'haiku',
        '-p', 'respond with only: ok'
      ], 15000);

      this.statusCache = {
        installed: true,
        authenticated: authResult.success,
        version: versionResult.result?.trim(),
        error: authResult.success ? undefined : 'Claude CLI not authenticated. Run "claude login" to authenticate.',
      };
      this.statusCacheTime = Date.now();
      return this.statusCache;

    } catch (error: any) {
      this.statusCache = {
        installed: false,
        authenticated: false,
        error: error.message,
      };
      this.statusCacheTime = Date.now();
      return this.statusCache;
    }
  }

  /**
   * Clear the status cache to force a fresh check
   */
  clearStatusCache(): void {
    this.statusCache = null;
    this.statusCacheTime = 0;
  }

  /**
   * Execute a prompt via Claude CLI
   */
  async execute(request: ClaudeCliRequest): Promise<ClaudeCliResponse> {
    const startTime = Date.now();
    const args = this.buildArgs(request);
    const timeout = request.timeout || 120000;

    try {
      const result = await this.runCommand(args, timeout, request.prompt);
      const durationMs = Date.now() - startTime;

      if (!result.success) {
        return {
          success: false,
          error: result.error || 'CLI execution failed',
          durationMs,
        };
      }

      // Try to parse JSON response from CLI
      try {
        const jsonResponse = JSON.parse(result.result || '{}');

        return {
          success: !jsonResponse.is_error,
          result: jsonResponse.result || result.result,
          durationMs: jsonResponse.duration_ms || durationMs,
          usage: jsonResponse.usage ? {
            inputTokens: jsonResponse.usage.input_tokens || 0,
            outputTokens: jsonResponse.usage.output_tokens || 0,
            costUsd: jsonResponse.total_cost_usd || 0,
          } : undefined,
          error: jsonResponse.is_error ? jsonResponse.result : undefined,
        };
      } catch {
        // If JSON parsing fails, return raw result
        return {
          success: true,
          result: result.result,
          durationMs,
        };
      }

    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Build CLI arguments from request
   */
  private buildArgs(request: ClaudeCliRequest): string[] {
    const args: string[] = [
      '--print',                    // Non-interactive mode
      '--output-format', 'json',    // JSON output for parsing
      '--no-session-persistence',   // Don't persist context between calls
    ];

    // Add model if specified
    if (request.model) {
      args.push('--model', this.mapModelName(request.model));
    }

    // Add system prompt if specified
    if (request.systemPrompt) {
      args.push('--system-prompt', request.systemPrompt);
    }

    // Disable all tools for pure LLM inference
    args.push('--allowedTools', '');

    // Add the prompt via -p flag (prompt will also be piped via stdin as fallback)
    args.push('-p', request.prompt);

    return args;
  }

  /**
   * Map full model names to CLI aliases
   */
  private mapModelName(model: string): string {
    const modelMap: Record<string, string> = {
      'claude-opus-4-5-20251101': 'opus',
      'claude-sonnet-4-5-20250929': 'sonnet',
      'claude-sonnet-4-20250514': 'sonnet',
      'claude-haiku-4-5-20251001': 'haiku',
    };
    return modelMap[model] || model;
  }

  /**
   * Run a CLI command and return the result
   */
  private runCommand(
    args: string[],
    timeout: number = 30000,
    stdin?: string
  ): Promise<{ success: boolean; result?: string; error?: string }> {
    return new Promise((resolve) => {
      const isWindows = process.platform === 'win32';
      const command = isWindows ? 'claude.cmd' : 'claude';

      let child;
      try {
        child = spawn(command, args, {
          shell: isWindows,
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env },
        });
      } catch (spawnError: any) {
        resolve({ success: false, error: `Failed to spawn Claude CLI: ${spawnError.message}` });
        return;
      }

      let stdout = '';
      let stderr = '';
      let timedOut = false;

      // Set up timeout
      const timeoutId = setTimeout(() => {
        timedOut = true;
        child.kill('SIGTERM');
        setTimeout(() => child.kill('SIGKILL'), 1000);
      }, timeout);

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('error', (error) => {
        clearTimeout(timeoutId);
        resolve({ success: false, error: error.message });
      });

      child.on('close', (code) => {
        clearTimeout(timeoutId);

        if (timedOut) {
          resolve({ success: false, error: `Command timed out after ${timeout}ms` });
          return;
        }

        if (code === 0) {
          resolve({ success: true, result: stdout });
        } else {
          resolve({
            success: false,
            error: stderr || `Exit code: ${code}`,
            result: stdout // Include stdout even on error for debugging
          });
        }
      });

      // Send prompt via stdin if provided (as backup to -p flag)
      if (stdin && child.stdin) {
        child.stdin.write(stdin);
        child.stdin.end();
      }
    });
  }
}

// Export singleton
export const claudeCliService = ClaudeCliService.getInstance();

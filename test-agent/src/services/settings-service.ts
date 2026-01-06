/**
 * Settings Service
 * Fetches app settings from the backend API
 */

import axios from 'axios';
import { config } from '../config/config';

export interface FlowiseConfig {
  id: number;
  name: string;
  url: string;
  apiKey: string;
  hasApiKey: boolean;
  isDefault: boolean;
}

export interface LangfuseConfig {
  id: number;
  name: string;
  host: string;
  publicKey: string;
  secretKey: string;
  hasSecretKey: boolean;
  isDefault: boolean;
}

// Cache for settings to avoid repeated API calls
let cachedFlowiseConfig: FlowiseConfig | null = null;
let cachedLangfuseConfig: LangfuseConfig | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL_MS = 60000; // 1 minute cache

/**
 * Get the active (default) Flowise configuration from the backend
 */
export async function getActiveFlowiseConfig(): Promise<FlowiseConfig | null> {
  // Check cache first
  if (cachedFlowiseConfig && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
    return cachedFlowiseConfig;
  }

  try {
    const response = await axios.get(
      `${config.backend.baseUrl}/api/test-monitor/flowise-configs/active`,
      { timeout: 10000 }
    );

    if (response.data?.success && response.data?.data) {
      cachedFlowiseConfig = response.data.data;
      cacheTimestamp = Date.now();
      return cachedFlowiseConfig;
    }

    return null;
  } catch (error: any) {
    console.warn(`[SettingsService] Failed to fetch active Flowise config: ${error.message}`);
    return null;
  }
}

/**
 * Get the active (default) Langfuse configuration from the backend
 */
export async function getActiveLangfuseConfig(): Promise<LangfuseConfig | null> {
  // Check cache first
  if (cachedLangfuseConfig && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
    return cachedLangfuseConfig;
  }

  try {
    const response = await axios.get(
      `${config.backend.baseUrl}/api/test-monitor/langfuse-configs/active`,
      { timeout: 10000 }
    );

    if (response.data?.success && response.data?.data) {
      cachedLangfuseConfig = response.data.data;
      cacheTimestamp = Date.now();
      return cachedLangfuseConfig;
    }

    return null;
  } catch (error: any) {
    console.warn(`[SettingsService] Failed to fetch active Langfuse config: ${error.message}`);
    return null;
  }
}

/**
 * Clear the settings cache
 */
export function clearSettingsCache(): void {
  cachedFlowiseConfig = null;
  cachedLangfuseConfig = null;
  cacheTimestamp = 0;
}

/**
 * Get Flowise endpoint URL, with fallback to hardcoded config
 */
export async function getFlowiseEndpoint(): Promise<{ url: string; apiKey?: string }> {
  const activeConfig = await getActiveFlowiseConfig();

  if (activeConfig) {
    return {
      url: activeConfig.url,
      apiKey: activeConfig.hasApiKey ? activeConfig.apiKey : undefined,
    };
  }

  // Fallback to hardcoded config
  console.warn('[SettingsService] Using fallback hardcoded Flowise endpoint');
  return {
    url: config.flowise.endpoint,
  };
}

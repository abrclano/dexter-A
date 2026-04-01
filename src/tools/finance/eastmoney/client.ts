/**
 * Eastmoney API Client
 * Common utilities for interacting with Eastmoney APIs
 */

import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { dexterPath } from '../../../utils/paths.js';

export interface EastmoneyApiResponse<T = unknown> {
  code?: number | string;
  message?: string;
  data?: T;
  status?: number;
  msg?: string;
}

const OUTPUT_DIR = join(process.cwd(), dexterPath('mx_data'));

function ensureOutputDir(): string {
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  return OUTPUT_DIR;
}

function safeFilename(query: string, maxLen = 80): string {
  return query.replace(/[\s/\\:*?"<>|]/g, '_').substring(0, maxLen) || 'query';
}

/** Save data to .txt or .json under .dexter/mx_data/ */
export function saveResultToFile(
  prefix: string,
  query: string,
  data: unknown,
  format: 'json' | 'txt' = 'json'
): string {
  const filepath = join(ensureOutputDir(), `${prefix}_${safeFilename(query)}.${format}`);
  writeFileSync(
    filepath,
    format === 'json' ? JSON.stringify(data, null, 2) : String(data),
    { encoding: 'utf-8' }
  );
  return filepath;
}

/**
 * Make a POST request to Eastmoney API.
 * Throws on network/HTTP errors; returns the parsed JSON body.
 */
export async function makeEastmoneyRequest<T = unknown>(
  endpoint: string,
  payload: Record<string, unknown> = {}
): Promise<EastmoneyApiResponse<T>> {
  const apiKey = process.env.MX_APIKEY;
  if (!apiKey) {
    throw new Error('Missing MX_APIKEY environment variable');
  }

  const baseUrl = process.env.MX_API_URL || 'https://mkapi2.dfcfs.com/finskillshub';
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: apiKey },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return (await response.json()) as EastmoneyApiResponse<T>;
  } catch (error) {
    clearTimeout(timeoutId);
    throw new Error(
      `Eastmoney API request failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Determine whether an API response indicates success.
 *
 * - mx-data / mx-search / mx-select-stock / mx-selfselect: top-level `status === 0`
 * - mx-stock-simulator: top-level `code === "0"` or `code === "200"`
 */
export function isSuccessResponse(response: EastmoneyApiResponse): boolean {
  if (response.status !== undefined && response.status !== null) {
    return response.status === 0;
  }
  const code = String(response.code ?? '');
  return code === '0' || code === '200';
}

/** Convert a "厘" integer value to a yuan string */
export function formatCurrency(value: number | null | undefined, currencyUnit = 1000): string {
  if (value == null) return '-';
  return (value / currencyUnit).toFixed(2);
}

/**
 * Compression utilities for cache
 * Uses simple JSON serialization with gzip-like compression
 */

import { gzipSync, gunzipSync } from 'node:zlib';

/**
 * Compress data for storage
 * @param data Data to compress
 * @returns Compressed data as base64 string
 */
export function compress(data: any): string {
  const json = JSON.stringify(data);
  const buffer = Buffer.from(json, 'utf-8');
  const compressed = gzipSync(buffer);
  return compressed.toString('base64');
}

/**
 * Decompress data from storage
 * @param compressed Compressed data as base64 string
 * @returns Original data
 */
export function decompress(compressed: string): any {
  const buffer = Buffer.from(compressed, 'base64');
  const decompressed = gunzipSync(buffer);
  const json = decompressed.toString('utf-8');
  return JSON.parse(json);
}

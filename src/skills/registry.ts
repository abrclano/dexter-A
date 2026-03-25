import { existsSync, readdirSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import type { SkillMetadata, Skill, SkillSource } from './types.js';
import { extractSkillMetadata, loadSkillFromPath } from './loader.js';
import { dexterPath } from '../utils/paths.js';

// Get the directory of this file to locate builtin skills
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Skill directories in order of precedence (later overrides earlier).
 */
const SKILL_DIRECTORIES: { path: string; source: SkillSource }[] = [
  { path: __dirname, source: 'builtin' },
  { path: join(process.cwd(), dexterPath('skills')), source: 'project' },
];

// Cache for discovered skills (metadata only)
let skillMetadataCache: Map<string, SkillMetadata> | null = null;

/**
 * Recursively scans a directory to find SKILL.md files.
 * Supports nested folder structures (e.g., skills/em/skill-name/SKILL.md).
 *
 * @param dirPath - The current directory path to scan.
 * @param source - The source type for discovered skills (e.g., 'builtin', 'project').
 * @param skills - Accumulator array for found skill metadata.
 * @param visitedRealPaths - Set of resolved paths already visited to prevent symlink loops.
 * @returns Array of collected skill metadata.
 */
function scanSkillDirectoryRecursive(
  dirPath: string,
  source: SkillSource,
  skills: SkillMetadata[] = [],
  visitedRealPaths: Set<string> = new Set()
): SkillMetadata[] {
  if (!existsSync(dirPath)) {
    return skills;
  }

  // Prevent infinite loops caused by symbolic links by tracking resolved real paths
  try {
    const realPath = resolve(dirPath);
    if (visitedRealPaths.has(realPath)) {
      return skills;
    }
    visitedRealPaths.add(realPath);
  } catch (e) {
    // If path resolution fails (e.g., permissions), skip this directory
    return skills;
  }

  const entries = readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const subDirPath = join(dirPath, entry.name);
      const skillFilePath = join(subDirPath, 'SKILL.md');

      // 1. Check if the immediate subdirectory contains a SKILL.md file
      if (existsSync(skillFilePath)) {
        try {
          const metadata = extractSkillMetadata(skillFilePath, source);
          skills.push(metadata);

          // Optimization: If a directory defines a skill, we assume it's a leaf node
          // and do not search deeper inside it to avoid conflicts or redundant scans.
          continue;
        } catch (err) {
          console.warn(`Failed to load skill at ${skillFilePath}:`, err);
        }
      }

      // 2. If no SKILL.md was found in this subdirectory, recurse deeper
      // This allows structures like: skills/em/stock-info/SKILL.md
      scanSkillDirectoryRecursive(subDirPath, source, skills, visitedRealPaths);
    }
  }

  return skills;
}

/**
 * Discover all available skills from all configured skill directories.
 * Supports nested directory structures. Later sources override earlier ones by name.
 *
 * @returns Array of deduplicated skill metadata.
 */
export function discoverSkills(): SkillMetadata[] {
  if (skillMetadataCache) {
    return Array.from(skillMetadataCache.values());
  }

  skillMetadataCache = new Map();

  for (const { path, source } of SKILL_DIRECTORIES) {
    // Use the recursive scanner instead of the flat scanner
    const skills = scanSkillDirectoryRecursive(path, source);

    for (const skill of skills) {
      // Later sources (e.g., project) override earlier ones (e.g., builtin)
      skillMetadataCache.set(skill.name, skill);
    }
  }

  return Array.from(skillMetadataCache.values());
}

/**
 * Get a specific skill by name, loading its full instructions.
 *
 * @param name - The unique name of the skill.
 * @returns The full skill definition or undefined if not found.
 */
export function getSkill(name: string): Skill | undefined {
  // Ensure the cache is populated
  if (!skillMetadataCache) {
    discoverSkills();
  }

  const metadata = skillMetadataCache?.get(name);
  if (!metadata) {
    return undefined;
  }

  // Load the full skill content from disk
  return loadSkillFromPath(metadata.path, metadata.source);
}

/**
 * Build the skill metadata section for the system prompt.
 * Includes only name and description to keep the prompt lightweight.
 *
 * @returns Formatted string for system prompt injection.
 */
export function buildSkillMetadataSection(): string {
  const skills = discoverSkills();

  if (skills.length === 0) {
    return 'No skills available.';
  }

  return skills
    .map((s) => `- **${s.name}**: ${s.description}`)
    .join('\n');
}

/**
 * Clear the skill cache.
 * Useful for testing or when skills are dynamically added/removed at runtime.
 */
export function clearSkillCache(): void {
  skillMetadataCache = null;
}
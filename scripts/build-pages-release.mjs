#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PUBLIC_DIRECTORIES = [
  '.well-known',
  'admin',
  'agent-training',
  'agents',
  'assets',
  'company-brain',
  'connect',
  'functions',
];

export const PUBLIC_FILES = [
  '404.html',
  '_headers',
  '_redirects',
  'apple-touch-icon.png',
  'clawdified-apple-touch-icon.png',
  'clawdified-icon-192.png',
  'clawdified-icon-48.png',
  'clawdified-icon-512.png',
  'clawdified-icon.ico',
  'clawdified-social-profile-apple-touch-icon.png',
  'clawdified-social-profile-icon-192.png',
  'clawdified-social-profile-icon-48.png',
  'clawdified-social-profile-icon-512.png',
  'clawdified-social-profile-icon.ico',
  'favicon-192.png',
  'favicon-48.png',
  'favicon.ico',
  'favicon.png',
  'icon-512.png',
  'index.html',
  'llms-full.txt',
  'llms.txt',
  'robots.txt',
  'site.webmanifest',
  'sitemap.xml',
];

export const REPOSITORY_ONLY_ROOTS = [
  '.git',
  '.wrangler',
  'README.md',
  'RUN_STATUS.md',
  'docs',
  'scripts',
  'test',
];

export function buildPagesRelease(sourceRoot, outputRoot) {
  const source = path.resolve(sourceRoot);
  const output = path.resolve(outputRoot);

  if (output === source || output.startsWith(`${source}${path.sep}`)) {
    throw new Error('Release output must be outside the source tree.');
  }
  if (existsSync(output)) {
    throw new Error(`Release output already exists: ${output}`);
  }

  mkdirSync(output, { recursive: true });
  const copied = [];
  for (const relativePath of [...PUBLIC_DIRECTORIES, ...PUBLIC_FILES]) {
    const from = path.join(source, relativePath);
    if (!existsSync(from)) {
      throw new Error(`Required public path is missing: ${relativePath}`);
    }
    cpSync(from, path.join(output, relativePath), { recursive: true });
    copied.push(relativePath);
  }

  for (const relativePath of REPOSITORY_ONLY_ROOTS) {
    if (existsSync(path.join(output, relativePath))) {
      throw new Error(`Repository-only path leaked into release output: ${relativePath}`);
    }
  }

  return { source, output, copied, excluded: REPOSITORY_ONLY_ROOTS };
}

const scriptPath = realpathSync(fileURLToPath(import.meta.url));
if (process.argv[1] && realpathSync(process.argv[1]) === scriptPath) {
  const output = process.argv[2];
  const source = process.argv[3] || path.resolve(path.dirname(scriptPath), '..');
  if (!output) {
    console.error('Usage: node scripts/build-pages-release.mjs OUTPUT_DIRECTORY [SOURCE_DIRECTORY]');
    process.exit(2);
  }
  try {
    console.log(JSON.stringify(buildPagesRelease(source, output), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

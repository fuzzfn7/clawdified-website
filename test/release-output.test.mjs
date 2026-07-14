import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildPagesRelease,
  PUBLIC_DIRECTORIES,
  PUBLIC_FILES,
  REPOSITORY_ONLY_ROOTS,
} from '../scripts/build-pages-release.mjs';

test('Pages release builder copies only the explicit public runtime allowlist', () => {
  assert.equal(PUBLIC_DIRECTORIES.includes('about'), false);
  assert.equal(PUBLIC_DIRECTORIES.includes('contact'), false);
  const fixture = mkdtempSync(path.join(tmpdir(), 'clawdified-release-fixture-'));
  const source = path.join(fixture, 'source');
  const output = path.join(fixture, 'output');
  mkdirSync(source);

  for (const relativePath of PUBLIC_DIRECTORIES) {
    const directory = path.join(source, relativePath);
    mkdirSync(directory, { recursive: true });
    writeFileSync(path.join(directory, 'public-marker.txt'), relativePath);
  }
  for (const relativePath of PUBLIC_FILES) {
    const file = path.join(source, relativePath);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, relativePath);
  }
  for (const relativePath of REPOSITORY_ONLY_ROOTS) {
    const target = path.join(source, relativePath);
    if (path.extname(relativePath)) {
      mkdirSync(path.dirname(target), { recursive: true });
      writeFileSync(target, 'private repository data');
    } else {
      mkdirSync(target, { recursive: true });
      writeFileSync(path.join(target, 'private-marker.txt'), 'private repository data');
    }
  }

  try {
    const manifest = buildPagesRelease(source, output);
    assert.deepEqual(manifest.copied, [...PUBLIC_DIRECTORIES, ...PUBLIC_FILES]);
    for (const relativePath of [...PUBLIC_DIRECTORIES, ...PUBLIC_FILES]) {
      assert.equal(existsSync(path.join(output, relativePath)), true, relativePath);
    }
    for (const relativePath of REPOSITORY_ONLY_ROOTS) {
      assert.equal(existsSync(path.join(output, relativePath)), false, relativePath);
    }
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test('Pages release builder refuses output inside the source tree', () => {
  const fixture = mkdtempSync(path.join(tmpdir(), 'clawdified-release-boundary-'));
  try {
    assert.throws(
      () => buildPagesRelease(fixture, path.join(fixture, 'public')),
      /outside the source tree/,
    );
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

test('Pages release builder CLI works through the macOS /tmp path alias', () => {
  const fixture = `/tmp/clawdified-release-cli-${process.pid}-${Date.now()}`;
  mkdirSync(fixture);
  const output = path.join(fixture, 'output');
  const projectRoot = fileURLToPath(new URL('../', import.meta.url));
  const sourceScript = fileURLToPath(new URL('../scripts/build-pages-release.mjs', import.meta.url));
  const script = path.join(fixture, 'build-pages-release.mjs');
  cpSync(sourceScript, script);
  try {
    const result = spawnSync(process.execPath, [script, output, projectRoot], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(existsSync(path.join(output, 'index.html')), true);
    assert.equal(existsSync(path.join(output, 'functions/_middleware.js')), true);
    assert.equal(existsSync(path.join(output, 'README.md')), false);
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
});

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

/**
 * Release hygiene for the Stripe adapter.
 *
 * The version we report to Stripe travels in the request user agent and is what
 * Stripe attributes traffic to. It silently drifted to 0.1.0 while the package
 * was on 0.3.1, so this pins the two together.
 */

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(resolve(here, '../../src/providers/stripe/index.ts'), 'utf8');
const pkg = JSON.parse(readFileSync(resolve(here, '../../package.json'), 'utf8'));

describe('Stripe adapter versioning', () => {
  it('reports the package version to Stripe in appInfo', () => {
    const match = src.match(/const SDK_VERSION = '([^']+)'/);
    expect(match, 'SDK_VERSION constant not found').not.toBeNull();
    expect(match![1]).toBe(pkg.version);
  });

  it('pins a dated Stripe API version', () => {
    const match = src.match(/const STRIPE_API_VERSION = '([^']+)'/);
    expect(match, 'STRIPE_API_VERSION constant not found').not.toBeNull();
    // Stripe versions look like 2026-08-26.dahlia
    expect(match![1]).toMatch(/^\d{4}-\d{2}-\d{2}\.[a-z]+$/);
  });

  it('declares a stripe peer range matching the pinned API era', () => {
    // stripe-node v22 ships the Dahlia-era types; an older range would reintroduce
    // the type mismatch the `as any` cast is papering over.
    expect(pkg.peerDependencies.stripe).toBe('^22.0.0');
  });
});

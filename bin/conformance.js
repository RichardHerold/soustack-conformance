#!/usr/bin/env node
const path = require('node:path');
const { loadRegistry, validateRecipeFile, validateFixtures } = require('soustack-core');
const { findFilesFromGlob } = require('../src/glob');

function printUsage() {
  console.error(`Soustack Conformance Runner

Usage:
  conformance test <glob> [--registry <path>]
  conformance fixtures [--registry <path>] [--fixtures <path>]

Commands:
  test       Validate recipe files that match the provided glob (e.g. \"recipes/**/*.soustack.json\").
  fixtures   Run the vendored spec fixtures. Files containing .valid. must pass, .invalid. must fail.
`);
}

function humanSummary(payload) {
  const { summary, results } = payload;
  console.error(`\nSummary: ${summary.passed} passed, ${summary.failed} failed, ${summary.total} total.`);
  if (summary.failed > 0) {
    console.error('Failures:');
    results
      .filter((r) => !r.passed)
      .forEach((failure) => {
        const label = failure.expectation ? `${failure.file} (expected ${failure.expectation})` : `${failure.file} (no expectation)`;
        console.error(`- ${label}`);
        failure.errors.forEach((err) => console.error(`  • ${err}`));
      });
  }
}

function loadRegistryOrExit(registryPath) {
  try {
    return loadRegistry(registryPath);
  } catch (error) {
    console.error(`Failed to load registry: ${error.message}`);
    process.exit(1);
  }
}

function runTestCommand(args) {
  const glob = args[0];
  if (!glob) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const registryIndex = args.indexOf('--registry');
  const registryPath = registryIndex !== -1 ? args[registryIndex + 1] : undefined;
  const { registry, registryPath: resolvedRegistryPath } = loadRegistryOrExit(registryPath);

  const files = findFilesFromGlob(glob, process.cwd());
  const results = files.map((file) => {
    const validation = validateRecipeFile(file, { registry });
    return {
      file: validation.file,
      valid: validation.valid,
      passed: validation.valid,
      errors: validation.errors,
    };
  });

  const summary = {
    registryPath: resolvedRegistryPath,
    total: results.length,
    passed: results.filter((r) => r.passed).length,
    failed: results.filter((r) => !r.passed).length,
  };

  const payload = {
    command: 'test',
    generatedAt: new Date().toISOString(),
    results,
    summary,
  };

  console.log(JSON.stringify(payload, null, 2));
  humanSummary(payload);

  if (summary.failed > 0 || summary.total === 0) {
    process.exitCode = 1;
  }
}

function runFixturesCommand(args) {
  const registryIndex = args.indexOf('--registry');
  const fixturesIndex = args.indexOf('--fixtures');
  const registryPath = registryIndex !== -1 ? args[registryIndex + 1] : undefined;
  const fixturesPath = fixturesIndex !== -1 ? args[fixturesIndex + 1] : path.join(process.cwd(), 'fixtures');

  const { registry, registryPath: resolvedRegistryPath } = loadRegistryOrExit(registryPath);
  const files = findFilesFromGlob('**/*.soustack.json', fixturesPath);
  const fixtureResults = validateFixtures(files, { registry });

  const payload = {
    command: 'fixtures',
    generatedAt: new Date().toISOString(),
    registryPath: resolvedRegistryPath,
    results: fixtureResults.results,
    summary: {
      ...fixtureResults.summary,
      fixturesPath,
    },
  };

  console.log(JSON.stringify(payload, null, 2));
  humanSummary(payload);

  if (payload.summary.failed > 0 || payload.summary.total === 0) {
    process.exitCode = 1;
  }
}

function main() {
  const [, , command, ...args] = process.argv;
  if (!command || ['-h', '--help'].includes(command)) {
    printUsage();
    process.exit(1);
    return;
  }

  if (command === 'test') {
    runTestCommand(args);
    return;
  }

  if (command === 'fixtures') {
    runFixturesCommand(args);
    return;
  }

  printUsage();
  process.exit(1);
}

main();

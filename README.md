# Soustack Conformance Runner

This repository publishes a lightweight conformance runner for Soustack recipes. It validates recipe files against the vendored Soustack registry, runs the canonical fixtures, and outputs both machine-readable JSON and a concise human summary.

## Installation

```bash
npm install
```

The CLI is exposed as `conformance` via the `bin` entry in `package.json`.

## Usage

Validate recipe files that match a glob:

```bash
conformance test "examples/*.soustack.json"
```

Run the vendored fixtures (files containing `.valid.` must pass, `.invalid.` must fail):

```bash
conformance fixtures
```

Override the registry or fixture locations if desired:

```bash
conformance test "recipes/**/*.soustack.json" --registry ./vendor/soustack-core/registry/registry.json
conformance fixtures --fixtures ./fixtures --registry ./vendor/soustack-core/registry/registry.json
```

Each command prints a JSON payload followed by a human-friendly summary. A failing exit code is returned when expectations are not met.

### Example output

```json
{
  "command": "test",
  "generatedAt": "2025-12-26T00:00:00.000Z",
  "results": [
    {
      "file": "/workspace/soustack-conformance/examples/sample.soustack.json",
      "valid": true,
      "passed": true,
      "errors": []
    }
  ],
  "summary": {
    "registryPath": "/workspace/soustack-conformance/vendor/soustack-core/registry/registry.json",
    "total": 1,
    "passed": 1,
    "failed": 0
  }
}

Summary: 1 passed, 0 failed, 1 total.
```

## Registry and fixtures

- The registry that powers validation lives at `vendor/soustack-core/registry/registry.json` and is used by default by the CLI.
- Spec fixtures live in `fixtures/spec`. Files containing `.valid.` must pass validation; `.invalid.` files must fail. The CI workflow runs these fixtures to keep the runner honest.

## Development

Run the fixture suite locally:

```bash
npm test
```

Add new registry entries or fixture cases to extend coverage without requiring network access.

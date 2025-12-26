const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_REGISTRY_PATH = path.join(__dirname, 'registry', 'registry.json');

function loadRegistry(customPath) {
  const registryPath = customPath ? path.resolve(customPath) : DEFAULT_REGISTRY_PATH;
  const contents = fs.readFileSync(registryPath, 'utf8');
  const registry = JSON.parse(contents);
  return { registry, registryPath };
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isSemver(value) {
  return typeof value === 'string' && /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(value);
}

function validateComponent(component, registry, index) {
  const errors = [];
  const prefix = `components[${index}]`;
  if (component === null || typeof component !== 'object' || Array.isArray(component)) {
    errors.push(`${prefix} must be an object`);
    return errors;
  }

  if (!isNonEmptyString(component.id)) {
    errors.push(`${prefix}.id is required`);
  }

  if (!isNonEmptyString(component.registry)) {
    errors.push(`${prefix}.registry is required`);
  }

  if (!isNonEmptyString(component.version)) {
    errors.push(`${prefix}.version is required`);
  } else if (!isSemver(component.version)) {
    errors.push(`${prefix}.version must use semver (e.g. 1.0.0)`);
  }

  if (isNonEmptyString(component.registry)) {
    const registryEntry = registry.components?.[component.registry];
    if (!registryEntry) {
      errors.push(`${prefix}.registry references unknown component '${component.registry}'`);
    } else {
      if (Array.isArray(registryEntry.versions) && registryEntry.versions.length > 0) {
        if (!registryEntry.versions.includes(component.version)) {
          errors.push(
            `${prefix}.version '${component.version}' is not in registry for ${component.registry} (allowed: ${registryEntry.versions.join(', ')})`
          );
        }
      }

      if (Array.isArray(registryEntry.requiredConfig)) {
        const missing = registryEntry.requiredConfig.filter((key) => component.config?.[key] === undefined);
        if (missing.length > 0) {
          errors.push(
            `${prefix}.config is missing required key(s) for ${component.registry}: ${missing.join(', ')}`
          );
        }
      }
    }
  }

  return errors;
}

function validateWorkflow(workflow, index) {
  const errors = [];
  const prefix = `workflows[${index}]`;
  if (workflow === null || typeof workflow !== 'object' || Array.isArray(workflow)) {
    errors.push(`${prefix} must be an object`);
    return errors;
  }

  if (!isNonEmptyString(workflow.name)) {
    errors.push(`${prefix}.name is required`);
  }

  if (!Array.isArray(workflow.steps) || workflow.steps.length === 0) {
    errors.push(`${prefix}.steps must be a non-empty array`);
  } else {
    workflow.steps.forEach((step, stepIndex) => {
      if (!isNonEmptyString(step)) {
        errors.push(`${prefix}.steps[${stepIndex}] must be a non-empty string`);
      }
    });
  }

  return errors;
}

function validateRecipe(recipe, registryInput) {
  const activeRegistry = registryInput ?? loadRegistry().registry;
  const errors = [];

  if (!recipe || typeof recipe !== 'object' || Array.isArray(recipe)) {
    return { valid: false, errors: ['Recipe must be a JSON object'] };
  }

  if (!isNonEmptyString(recipe.name)) {
    errors.push('name is required');
  }

  if (!isNonEmptyString(recipe.version)) {
    errors.push('version is required');
  } else if (!isSemver(recipe.version)) {
    errors.push('version must use semver (e.g. 1.0.0)');
  }

  if (!Array.isArray(recipe.components) || recipe.components.length === 0) {
    errors.push('components must be a non-empty array');
  } else {
    recipe.components.forEach((component, index) => {
      errors.push(...validateComponent(component, activeRegistry, index));
    });
  }

  if (recipe.workflows !== undefined) {
    if (!Array.isArray(recipe.workflows)) {
      errors.push('workflows must be an array when provided');
    } else {
      recipe.workflows.forEach((workflow, index) => {
        errors.push(...validateWorkflow(workflow, index));
      });
    }
  }

  return { valid: errors.length === 0, errors };
}

function validateRecipeFile(filePath, registryInput) {
  const absolutePath = path.resolve(filePath);
  let parsed;
  try {
    const raw = fs.readFileSync(absolutePath, 'utf8');
    parsed = JSON.parse(raw);
  } catch (error) {
    return {
      file: absolutePath,
      valid: false,
      errors: [`Failed to read or parse JSON: ${error.message}`],
    };
  }

  const { registry } = registryInput ?? loadRegistry();
  const result = validateRecipe(parsed, registry);
  return { file: absolutePath, valid: result.valid, errors: result.errors };
}

function expectFromFilename(filePath) {
  const base = path.basename(filePath);
  if (base.includes('.valid.')) return 'valid';
  if (base.includes('.invalid.')) return 'invalid';
  return null;
}

function validateFixtures(files, registryInput) {
  const { registry, registryPath } = registryInput ?? loadRegistry();
  const results = files.map((file) => {
    const expectation = expectFromFilename(file);
    const validation = validateRecipeFile(file, { registry });
    const expectedValid = expectation === 'valid';
    const passed = expectation
      ? expectation === 'invalid'
        ? !validation.valid
        : validation.valid
      : false;
    const errors = expectation
      ? validation.errors
      : ['Fixture filenames must contain .valid. or .invalid. to set expectations'];
    return {
      file: validation.file,
      expectation,
      valid: validation.valid,
      passed,
      errors,
    };
  });

  const summary = {
    registryPath,
    total: results.length,
    expectedValid: results.filter((r) => r.expectation === 'valid').length,
    expectedInvalid: results.filter((r) => r.expectation === 'invalid').length,
    passed: results.filter((r) => r.passed).length,
    failed: results.filter((r) => !r.passed).length,
  };

  return { results, summary };
}

module.exports = {
  DEFAULT_REGISTRY_PATH,
  loadRegistry,
  validateRecipe,
  validateRecipeFile,
  validateFixtures,
};

const fs = require('node:fs');
const path = require('node:path');

function normalizePath(filePath) {
  return filePath.split(path.sep).join('/');
}

function globToRegExp(pattern) {
  const normalizedPattern = normalizePath(pattern);
  const escaped = normalizedPattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const doubleStarReplaced = escaped.replace(/\*\*/g, '::DOUBLE_STAR::');
  const singleStarReplaced = doubleStarReplaced.replace(/\*/g, '[^/]*');
  const regexSource = singleStarReplaced.replace(/::DOUBLE_STAR::/g, '.*');
  return new RegExp(`^${regexSource}$`);
}

function discoverBaseDir(pattern) {
  const normalized = normalizePath(pattern);
  const wildcardIndex = normalized.search(/[*?[]/);
  if (wildcardIndex === -1) {
    return path.dirname(normalized) || '.';
  }
  const base = normalized.slice(0, wildcardIndex);
  return base.endsWith('/') ? base.slice(0, -1) : base || '.';
}

function walk(dir, fileList = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  entries.forEach((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.git') return;
      walk(fullPath, fileList);
    } else if (entry.isFile()) {
      fileList.push(fullPath);
    }
  });
  return fileList;
}

function findFilesFromGlob(pattern, cwd = process.cwd()) {
  const isAbsolutePattern = path.isAbsolute(pattern);
  const baseDir = isAbsolutePattern ? discoverBaseDir(pattern) : path.resolve(cwd, discoverBaseDir(pattern));
  const regex = globToRegExp(normalizePath(pattern));
  if (!fs.existsSync(baseDir)) {
    return [];
  }
  const files = walk(baseDir);
  return files
    .map((file) => path.resolve(file))
    .filter((file) => {
      const comparablePath = isAbsolutePattern ? normalizePath(file) : normalizePath(path.relative(cwd, file));
      return regex.test(comparablePath);
    });
}

module.exports = { findFilesFromGlob, globToRegExp };

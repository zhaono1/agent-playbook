"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function isDirectChild(targetPath, rootPath) {
  const target = path.resolve(targetPath);
  const root = path.resolve(rootPath);
  const relative = path.relative(root, target);
  return Boolean(relative) && !relative.includes(path.sep) && !relative.startsWith(".");
}

function hashDirectory(rootPath) {
  const hash = crypto.createHash("sha256");

  function visit(currentPath, relativePath) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    for (const entry of entries) {
      const childPath = path.join(currentPath, entry.name);
      const childRelative = path.join(relativePath, entry.name);
      hash.update(`${entry.isDirectory() ? "d" : entry.isSymbolicLink() ? "l" : "f"}:${childRelative}\n`);
      if (entry.isDirectory()) {
        visit(childPath, childRelative);
      } else if (entry.isSymbolicLink()) {
        hash.update(`${fs.readlinkSync(childPath)}\n`);
      } else if (entry.isFile()) {
        hash.update(fs.readFileSync(childPath));
      }
    }
  }

  visit(rootPath, "");
  return hash.digest("hex");
}

function canonicalizeMissingPath(targetPath) {
  let current = path.resolve(targetPath);
  const missingParts = [];
  while (true) {
    try {
      const existing = fs.realpathSync(current);
      return path.join(existing, ...missingParts.reverse());
    } catch (error) {
      const parent = path.dirname(current);
      if (parent === current) {
        return path.resolve(targetPath);
      }
      missingParts.push(path.basename(current));
      current = parent;
    }
  }
}

function snapshotManagedResource(resource, rootPath, options = {}) {
  if (!resource || !resource.target || !resource.source) {
    return null;
  }
  if (!isDirectChild(resource.target, rootPath)) {
    return null;
  }

  let stat;
  try {
    stat = fs.lstatSync(resource.target);
  } catch (error) {
    return null;
  }
  if (stat.isSymbolicLink()) {
    let actualSource;
    try {
      actualSource = path.resolve(path.dirname(resource.target), fs.readlinkSync(resource.target));
    } catch (error) {
      return null;
    }
    let expectedSource = canonicalizeMissingPath(resource.source);
    try {
      actualSource = fs.realpathSync(resource.target);
    } catch (error) {
      actualSource = canonicalizeMissingPath(actualSource);
    }
    const comparableActual = process.platform === "win32" ? actualSource.toLowerCase() : actualSource;
    const comparableExpected =
      process.platform === "win32" ? expectedSource.toLowerCase() : expectedSource;
    if (comparableActual !== comparableExpected) {
      return null;
    }
    return {
      source: expectedSource,
      target: path.resolve(resource.target),
      mode: "link",
    };
  }

  if (!stat.isDirectory()) {
    return null;
  }
  const fingerprint = hashDirectory(resource.target);
  if (!options.allowNewCopy && resource.fingerprint !== fingerprint) {
    return null;
  }
  return {
    source: path.resolve(resource.source),
    target: path.resolve(resource.target),
    mode: "copy",
    fingerprint,
  };
}

function collectManagedResources(previous, linkResult, rootPath) {
  const candidates = [];
  for (const item of linkResult.created || []) {
    candidates.push({ item, allowNewCopy: true });
  }
  for (const item of linkResult.skipped || []) {
    if (item.reason === "already linked") {
      candidates.push({ item, allowNewCopy: false });
    }
  }
  for (const item of previous || []) {
    candidates.push({ item, allowNewCopy: false });
  }

  const byTarget = new Map();
  for (const candidate of candidates) {
    if (!candidate.item || !candidate.item.target || byTarget.has(path.resolve(candidate.item.target))) {
      continue;
    }
    const snapshot = snapshotManagedResource(candidate.item, rootPath, {
      allowNewCopy: candidate.allowNewCopy,
    });
    if (snapshot) {
      byTarget.set(snapshot.target, snapshot);
    }
  }
  return Array.from(byTarget.values()).sort((left, right) => left.target.localeCompare(right.target));
}

function removeManagedResources(resources, rootPath) {
  const removed = [];
  const preserved = [];
  for (const resource of resources || []) {
    const verified = snapshotManagedResource(resource, rootPath, { allowNewCopy: false });
    if (!verified) {
      preserved.push(resource && resource.target ? resource.target : "(invalid manifest entry)");
      continue;
    }
    fs.rmSync(verified.target, { recursive: true, force: true });
    removed.push(verified.target);
  }
  return { removed, preserved };
}

module.exports = {
  collectManagedResources,
  hashDirectory,
  removeManagedResources,
};

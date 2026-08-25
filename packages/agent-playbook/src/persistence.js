"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

class CorruptStoreError extends Error {
  constructor(filePath, cause) {
    super(`Unable to parse ${filePath}; the store may be corrupt. Refusing to overwrite it.`);
    this.name = "CorruptStoreError";
    this.code = "APB_CORRUPT_STORE";
    this.filePath = filePath;
    this.cause = cause;
  }
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function readJsonStrict(filePath, missingValue = null) {
  if (!fs.existsSync(filePath)) {
    return missingValue;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new CorruptStoreError(filePath, error);
  }
}

function writeFileAtomic(filePath, content, options = {}) {
  ensureDir(path.dirname(filePath));
  const tempPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${crypto.randomBytes(3).toString("hex")}.tmp`
  );
  const existingMode = fs.existsSync(filePath) ? fs.statSync(filePath).mode & 0o777 : null;
  const mode = options.mode ?? existingMode ?? 0o600;
  try {
    fs.writeFileSync(tempPath, content, { encoding: "utf8", mode });
    fs.renameSync(tempPath, filePath);
  } finally {
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
  }
}

function writeJsonAtomic(filePath, data, options = {}) {
  writeFileAtomic(filePath, `${JSON.stringify(data, null, 2)}\n`, options);
}

function isProcessAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return Boolean(error && error.code === "EPERM");
  }
}

function acquireFileLock(lockPath, options = {}) {
  const timeoutMs = options.timeoutMs || 3000;
  const staleMs = options.staleMs || 30000;
  const startedAt = Date.now();
  const token = `${process.pid}:${crypto.randomBytes(12).toString("hex")}`;
  ensureDir(path.dirname(lockPath));

  while (true) {
    try {
      const fd = fs.openSync(lockPath, "wx", 0o600);
      fs.writeFileSync(fd, `${token}\n${new Date().toISOString()}\n`, "utf8");
      return () => {
        try {
          fs.closeSync(fd);
        } finally {
          try {
            const owner = fs.readFileSync(lockPath, "utf8").split("\n", 1)[0];
            if (owner === token) {
              fs.unlinkSync(lockPath);
            }
          } catch (error) {
            if (!error || error.code !== "ENOENT") {
              throw error;
            }
          }
        }
      };
    } catch (error) {
      if (!error || error.code !== "EEXIST") {
        throw error;
      }
      try {
        const age = Date.now() - fs.statSync(lockPath).mtimeMs;
        const lockOwner = Number.parseInt(
          fs.readFileSync(lockPath, "utf8").split("\n", 1)[0].split(":", 1)[0],
          10
        );
        if (age > staleMs && !isProcessAlive(lockOwner)) {
          fs.unlinkSync(lockPath);
          continue;
        }
      } catch (statError) {
        if (statError && statError.code === "ENOENT") {
          continue;
        }
        throw statError;
      }
      if (Date.now() - startedAt >= timeoutMs) {
        const timeoutError = new Error(`Timed out waiting for state lock ${lockPath}.`);
        timeoutError.code = "APB_LOCK_TIMEOUT";
        throw timeoutError;
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);
    }
  }
}

function withFileLock(lockPath, callback, options) {
  const release = acquireFileLock(lockPath, options);
  try {
    return callback();
  } finally {
    release();
  }
}

module.exports = {
  CorruptStoreError,
  readJsonStrict,
  writeFileAtomic,
  writeJsonAtomic,
  withFileLock,
};

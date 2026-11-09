/* Local storage boundary for validated, versioned run snapshots. */
(function () {
  const SAVE_KEY = 'merge-rpg.run.v1';
  const RECOVERY_KEY = `${SAVE_KEY}.recovery`;
  let protectedRaw = null;
  let readBlocked = false;

  function errorText(error) {
    if (error && error.name === 'QuotaExceededError') return 'Local storage is full.';
    if (error && error.name === 'SecurityError') return 'Local storage is unavailable in this browser.';
    return 'The run could not be saved or read.';
  }

  function getStorage() {
    try {
      const storage = window.localStorage;
      if (!storage || typeof storage.getItem !== 'function' ||
          typeof storage.setItem !== 'function' || typeof storage.removeItem !== 'function') {
        return { storage: null, error: new Error('Storage API is unavailable') };
      }
      return { storage, error: null };
    } catch (error) {
      return { storage: null, error };
    }
  }

  function validateSnapshot(snapshot) {
    try {
      if (!window.runSnapshotRules || typeof window.runSnapshotRules.validate !== 'function') {
        return { valid: false, error: 'Snapshot validation is unavailable.' };
      }
      const result = window.runSnapshotRules.validate(snapshot);
      if (!result || result.valid !== true || !result.data) {
        return { valid: false, error: result && result.error ? result.error : 'The saved run is invalid.' };
      }
      return { valid: true, data: result.data };
    } catch (error) {
      return { valid: false, error: errorText(error) };
    }
  }

  function preserveCorrupt(raw) {
    if (typeof raw !== 'string') return { ok: false, status: 'invalid-input' };
    const access = getStorage();
    if (!access.storage) return { ok: false, status: 'unavailable', error: errorText(access.error) };

    try {
      const existing = access.storage.getItem(RECOVERY_KEY);
      if (existing === raw) return { ok: true, status: 'preserved' };
      if (existing !== null) return { ok: false, status: 'recovery-conflict' };
      access.storage.setItem(RECOVERY_KEY, raw);
      return { ok: true, status: 'preserved' };
    } catch (error) {
      return { ok: false, status: 'unavailable', error: errorText(error) };
    }
  }

  function parseAndValidate(raw) {
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      return { valid: false, error: 'The saved run is not valid JSON.' };
    }
    return validateSnapshot(parsed);
  }

  function read() {
    const access = getStorage();
    if (!access.storage) {
      readBlocked = true;
      return { status: 'unavailable', error: errorText(access.error) };
    }

    let raw;
    try {
      raw = access.storage.getItem(SAVE_KEY);
    } catch (error) {
      readBlocked = true;
      return { status: 'unavailable', error: errorText(error) };
    }
    readBlocked = false;

    if (raw === null) {
      protectedRaw = null;
      return { status: 'empty' };
    }
    if (typeof raw !== 'string') raw = String(raw);

    const validation = parseAndValidate(raw);
    if (!validation.valid) {
      protectedRaw = raw;
      const recovery = preserveCorrupt(raw);
      return {
        status: 'invalid',
        raw,
        error: validation.error,
        recoveryPreserved: recovery.ok,
        recoveryStatus: recovery.status,
      };
    }

    protectedRaw = null;
    return { status: 'valid', snapshot: validation.data };
  }

  function write(snapshot) {
    const validation = validateSnapshot(snapshot);
    if (!validation.valid) return { ok: false, status: 'invalid', error: validation.error };
    if (readBlocked) {
      return { ok: false, status: 'unavailable', error: 'Retry the storage read before saving.' };
    }

    let serialized;
    try {
      serialized = JSON.stringify(validation.data);
    } catch (error) {
      return { ok: false, status: 'invalid', error: errorText(error) };
    }
    if (typeof serialized !== 'string') {
      return { ok: false, status: 'invalid', error: 'The run could not be serialized.' };
    }

    const access = getStorage();
    if (!access.storage) return { ok: false, status: 'unavailable', error: errorText(access.error) };

    let existing;
    try {
      existing = access.storage.getItem(SAVE_KEY);
    } catch (error) {
      readBlocked = true;
      return { ok: false, status: 'unavailable', error: errorText(error) };
    }

    if (existing !== null) {
      if (typeof existing !== 'string') existing = String(existing);
      if (protectedRaw === existing) {
        return { ok: false, status: 'recovery-required', error: 'Recover or confirm a new run before replacing this save.' };
      }
      const previous = parseAndValidate(existing);
      if (!previous.valid) {
        protectedRaw = existing;
        const recovery = preserveCorrupt(existing);
        return {
          ok: false,
          status: 'recovery-required',
          error: previous.error,
          recoveryPreserved: recovery.ok,
          recoveryStatus: recovery.status,
        };
      }
    }

    try {
      access.storage.setItem(SAVE_KEY, serialized);
      return { ok: true, status: 'saved', savedAt: validation.data.savedAt };
    } catch (error) {
      const status = error && error.name === 'QuotaExceededError' ? 'quota' :
        error && error.name === 'SecurityError' ? 'unavailable' : 'failed';
      return { ok: false, status, error: errorText(error) };
    }
  }

  function clear(options = {}) {
    if (options.confirmed !== true) {
      return { ok: false, status: 'confirmation-required', error: 'Confirm before starting a new run.' };
    }
    const access = getStorage();
    if (!access.storage) return { ok: false, status: 'unavailable', error: errorText(access.error) };

    let raw;
    try {
      raw = access.storage.getItem(SAVE_KEY);
    } catch (error) {
      readBlocked = true;
      return { ok: false, status: 'unavailable', error: errorText(error) };
    }

    if (raw !== null) {
      if (typeof raw !== 'string') raw = String(raw);
      const validation = parseAndValidate(raw);
      if (!validation.valid) {
        protectedRaw = raw;
        const recovery = preserveCorrupt(raw);
        if (!recovery.ok && options.downloaded !== true) {
          return {
            ok: false,
            status: 'preserve-failed',
            raw,
            error: recovery.error || 'Download a copy before clearing this save.',
            recoveryStatus: recovery.status,
          };
        }
      }
    }

    try {
      access.storage.removeItem(SAVE_KEY);
      protectedRaw = null;
      readBlocked = false;
      return { ok: true, status: 'cleared' };
    } catch (error) {
      return { ok: false, status: 'failed', error: errorText(error) };
    }
  }

  window.localRunSave = {
    key: SAVE_KEY,
    recoveryKey: RECOVERY_KEY,
    read,
    write,
    preserveCorrupt,
    clear,
  };
})();
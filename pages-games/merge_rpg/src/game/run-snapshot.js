/* Versioned, DOM-free snapshots of committed run state. */
(function () {
  const SCHEMA_VERSION = 1;
  const RUN_PHASES = new Set(['management', 'combat', 'rewards']);
  const COMBAT_TURNS = new Set(['player', 'enemy']);
  const BLOCKED_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

  function isPlainRecord(value) {
    if (!value || Object.prototype.toString.call(value) !== '[object Object]') return false;
    const prototype = Object.getPrototypeOf(value);
    if (prototype === null) return true;
    const constructor = Object.getOwnPropertyDescriptor(prototype, 'constructor');
    return Boolean(constructor && typeof constructor.value === 'function' && constructor.value.name === 'Object');
  }

  function copyPlainData(value, path, ancestors = new Set()) {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (!value || typeof value !== 'object') throw new TypeError(`${path} is not plain JSON data`);
    if (ancestors.has(value)) throw new TypeError(`${path} contains a cycle`);
    if (!Array.isArray(value) && !isPlainRecord(value)) {
      throw new TypeError(`${path} must contain only plain objects and arrays`);
    }

    ancestors.add(value);
    let copy;
    if (Array.isArray(value)) {
      const keys = Reflect.ownKeys(value);
      if (keys.some((key) => typeof key !== 'string' || (key !== 'length' && !/^\d+$/.test(key))) ||
          Object.getOwnPropertySymbols(value).length > 0) {
        throw new TypeError(`${path} contains non-array properties`);
      }
      copy = [];
      for (let index = 0; index < value.length; index += 1) {
        if (!Object.prototype.hasOwnProperty.call(value, index)) {
          throw new TypeError(`${path}[${index}] is missing`);
        }
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
          throw new TypeError(`${path}[${index}] is not a data property`);
        }
        copy.push(copyPlainData(descriptor.value, `${path}[${index}]`, ancestors));
      }
    } else {
      if (Object.getOwnPropertySymbols(value).length > 0) {
        throw new TypeError(`${path} contains symbol properties`);
      }
      copy = {};
      for (const key of Object.keys(value)) {
        if (BLOCKED_KEYS.has(key)) throw new TypeError(`${path} contains a blocked property`);
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, 'value')) {
          throw new TypeError(`${path}.${key} is not a data property`);
        }
        copy[key] = copyPlainData(descriptor.value, `${path}.${key}`, ancestors);
      }
    }
    ancestors.delete(value);
    return copy;
  }

  function invalid(error) {
    return { valid: false, error };
  }

  function validateItem(item, path, seenIds, gridWidth, gridHeight, occupiedCells = null) {
    if (!isPlainRecord(item)) return `${path} must be an item object`;
    if (typeof item.id !== 'string' || !item.id.trim()) return `${path}.id is required`;
    if (seenIds.has(item.id)) return `${path}.id is duplicated`;
    seenIds.add(item.id);

    const catalog = window.itemTypes;
    const typeDefinition = typeof item.type === 'string' && isPlainRecord(catalog) &&
      Object.prototype.hasOwnProperty.call(catalog, item.type)
      ? catalog[item.type]
      : null;
    if (!isPlainRecord(typeDefinition)) return `${path}.type is not in the item catalog`;
    if (!Number.isInteger(item.tier) || item.tier < 1) return `${path}.tier is invalid`;
    if (Array.isArray(typeDefinition.icons) && item.tier > typeDefinition.icons.length) {
      return `${path}.tier is not in the item catalog`;
    }
    if (!isPlainRecord(item.stats)) return `${path}.stats must be an object`;
    if (item.rotated !== undefined && typeof item.rotated !== 'boolean') {
      return `${path}.rotated must be a boolean`;
    }

    const hasX = Object.prototype.hasOwnProperty.call(item, 'x');
    const hasY = Object.prototype.hasOwnProperty.call(item, 'y');
    if (hasX !== hasY) return `${path} must include both coordinates or neither`;
    if (hasX) {
      if (!Number.isInteger(item.x) || item.x < 0 || !Number.isInteger(item.y) || item.y < 0) {
        return `${path} coordinates are invalid`;
      }
      const itemWidth = item.rotated ? typeDefinition.height : typeDefinition.width;
      const itemHeight = item.rotated ? typeDefinition.width : typeDefinition.height;
      if (!Number.isInteger(itemWidth) || itemWidth < 1 || !Number.isInteger(itemHeight) || itemHeight < 1) {
        return `${path} catalog dimensions are invalid`;
      }
      if (gridWidth !== null && item.x + itemWidth > gridWidth) return `${path} is outside the backpack width`;
      if (gridHeight !== null && item.y + itemHeight > gridHeight) return `${path} is outside the backpack height`;
      if (occupiedCells) {
        const cells = [];
        for (let cellY = item.y; cellY < item.y + itemHeight; cellY += 1) {
          for (let cellX = item.x; cellX < item.x + itemWidth; cellX += 1) {
            const cellKey = cellX + ',' + cellY;
            if (occupiedCells.has(cellKey)) {
              return path + ' overlaps another equipped item';
            }
            cells.push(cellKey);
          }
        }
        cells.forEach((cellKey) => occupiedCells.add(cellKey));
      }
    }

    try {
      copyPlainData(item, path);
    } catch (error) {
      return error.message;
    }
    return null;
  }

  function validateCombatState(combatState) {
    if (combatState === null) return null;
    if (!isPlainRecord(combatState)) return 'combatState must be an object or null';
    const requiredNumbers = [
      'playerHp', 'playerMaxHp', 'enemyHp', 'enemyMaxHp', 'playerAttack', 'playerMagic',
      'playerDefense', 'playerPotions', 'enemyAttack', 'enemyPhysDef', 'enemyMagicDef',
    ];
    for (const key of requiredNumbers) {
      if (!Number.isFinite(combatState[key])) return `combatState.${key} is invalid`;
    }
    if (combatState.playerMaxHp <= 0 || combatState.enemyMaxHp <= 0 ||
        combatState.playerHp < 0 || combatState.playerHp > combatState.playerMaxHp ||
        combatState.enemyHp < 0 || combatState.enemyHp > combatState.enemyMaxHp) {
      return 'combatState health is out of range';
    }
    if (!COMBAT_TURNS.has(combatState.turn)) return 'combatState.turn is invalid';
    if (!Array.isArray(combatState.combatLog) || typeof combatState.battleEnded !== 'boolean') {
      return 'combatState log or completion flag is invalid';
    }
    try {
      copyPlainData(combatState, 'combatState');
    } catch (error) {
      return error.message;
    }
    return null;
  }

  function validate(snapshot) {
    if (!isPlainRecord(snapshot)) return invalid('Snapshot envelope must be an object');
    if (snapshot.schemaVersion !== SCHEMA_VERSION) return invalid('Unsupported snapshot version');
    if (!Number.isFinite(snapshot.savedAt) || snapshot.savedAt < 0) return invalid('Snapshot timestamp is invalid');
    if (!isPlainRecord(snapshot.run)) return invalid('Snapshot run is missing');

    const { gameConfig, gamePhase, combatState, rewardOptions } = snapshot.run;
    if (!isPlainRecord(gameConfig)) return invalid('gameConfig is missing');
    if (!RUN_PHASES.has(gamePhase)) return invalid('gamePhase is invalid');
    if (!Array.isArray(gameConfig.items)) return invalid('gameConfig.items is missing');
    for (const key of ['round', 'level', 'score', 'playerHp', 'maxHp']) {
      if (!Number.isFinite(gameConfig[key])) return invalid(`gameConfig.${key} is invalid`);
    }
    if (gameConfig.round < 1 || gameConfig.level < 1 || gameConfig.score < 0 ||
        gameConfig.maxHp <= 0 || gameConfig.playerHp < 0 || gameConfig.playerHp > gameConfig.maxHp) {
      return invalid('gameConfig progression or health is out of range');
    }
    if (!Array.isArray(rewardOptions)) return invalid('rewardOptions is missing');

    const gridWidth = Number.isInteger(Number(gameConfig.gridWidth)) && Number(gameConfig.gridWidth) > 0
      ? Number(gameConfig.gridWidth)
      : null;
    const gridHeight = Number.isInteger(Number(gameConfig.gridHeight)) && Number(gameConfig.gridHeight) > 0
      ? Number(gameConfig.gridHeight)
      : null;
    const itemIds = new Set();
    const occupiedCells = new Set();
    for (let index = 0; index < gameConfig.items.length; index += 1) {
      const error = validateItem(gameConfig.items[index], `gameConfig.items[${index}]`, itemIds, gridWidth, gridHeight, occupiedCells);
      if (error) return invalid(error);
    }

    const rewardIds = new Set();
    for (let index = 0; index < rewardOptions.length; index += 1) {
      const error = validateItem(rewardOptions[index], `rewardOptions[${index}]`, rewardIds, null, null);
      if (error) return invalid(error);
    }

    const combatError = validateCombatState(combatState);
    if (combatError) return invalid(combatError);
    if (gamePhase === 'combat' && combatState === null) return invalid('Combat phase has no combat state');
    if (gamePhase === 'rewards' && rewardOptions.length === 0) return invalid('Rewards phase has no pending rewards');

    try {
      const data = copyPlainData({
        schemaVersion: SCHEMA_VERSION,
        savedAt: snapshot.savedAt,
        run: { gameConfig, gamePhase, combatState, rewardOptions },
      }, 'snapshot');
      return { valid: true, data };
    } catch (error) {
      return invalid(error.message);
    }
  }

  function capture(runState, savedAt = Date.now()) {
    if (!isPlainRecord(runState) || !isPlainRecord(runState.gameConfig)) {
      throw new TypeError('Run state and gameConfig must be objects');
    }
    return {
      schemaVersion: SCHEMA_VERSION,
      savedAt,
      run: copyPlainData({
        gameConfig: runState.gameConfig,
        gamePhase: runState.gamePhase,
        combatState: runState.combatState === undefined ? null : runState.combatState,
        rewardOptions: runState.rewardOptions === undefined ? [] : runState.rewardOptions,
      }, 'run'),
    };
  }

  window.runSnapshotRules = { capture, validate };
})();
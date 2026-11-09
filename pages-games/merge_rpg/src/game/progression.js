/* Pure enemy progression and experience rules. */
(function () {
  const DEFAULT_GROWTH = 0.15;
  const MAX_ROUND = 1000000;
  const MAX_STAT = 999999;
  const MAX_LEVEL_UPS_PER_AWARD = 10;
  const ENEMY_TYPES = [
    'weak',
    'medium',
    'strong',
    'troll',
    'lich',
    'demon',
    'ancient_dragon',
    'void_lord',
  ];

  function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function readInteger(value, fallback = 0, minimum = 0, maximum = MAX_STAT) {
    if (value === null || value === undefined || value === '') return fallback;
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(minimum, Math.min(maximum, parsed));
  }

  function readPositiveRound(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 1) return 1;
    return Math.min(parsed, MAX_ROUND);
  }

  function readGrowth(value) {
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed) || parsed === 0) return DEFAULT_GROWTH;
    return Math.max(0, Math.min(10, parsed));
  }

  function parseConfig(value) {
    if (typeof value === 'string') {
      try {
        return asObject(JSON.parse(value));
      } catch {
        return {};
      }
    }
    return asObject(value);
  }

  function parseRoundConfig(levelConfig, round) {
    const config = parseConfig(levelConfig);
    const rounds = asObject(config.rounds);
    const rawRound = rounds[round];
    if (typeof rawRound === 'string') {
      try {
        return asObject(JSON.parse(rawRound));
      } catch {
        return {};
      }
    }
    return asObject(rawRound);
  }

  function defaultEnemyTypeForRound(round) {
    if (round <= 5) return 'weak';
    if (round <= 10) return 'medium';
    if (round <= 15) return 'strong';
    if (round <= 20) return 'troll';
    if (round <= 25) return 'lich';
    if (round <= 30) return 'demon';
    if (round <= 35) return 'ancient_dragon';
    return 'void_lord';
  }

  function hasEnemy(catalog, type) {
    return typeof type === 'string'
      && ENEMY_TYPES.includes(type)
      && Object.prototype.hasOwnProperty.call(catalog, type)
      && catalog[type]
      && typeof catalog[type] === 'object'
      && !Array.isArray(catalog[type]);
  }

  function getEnemyTypeForRound(roundValue, levelConfig, enemyCatalog = {}) {
    const round = readPositiveRound(roundValue);
    const catalog = asObject(enemyCatalog);
    const customType = parseRoundConfig(levelConfig, round).enemyType;
    if (hasEnemy(catalog, customType)) return customType;

    const defaultType = defaultEnemyTypeForRound(round);
    if (hasEnemy(catalog, defaultType)) return defaultType;
    return ENEMY_TYPES.find((type) => hasEnemy(catalog, type)) || 'weak';
  }

  function customStat(stats, key) {
    const value = stats[key];
    if (!value) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function createEncounter(runState, enemyCatalog, scalingSettings) {
    const state = asObject(runState);
    const catalog = asObject(enemyCatalog);
    const settings = asObject(scalingSettings);
    const round = readPositiveRound(state.round);
    const levelConfig = settings.levelConfig ?? state.levelConfig;
    const roundConfig = parseRoundConfig(levelConfig, round);
    const enemyType = getEnemyTypeForRound(round, levelConfig, catalog);
    const baseEnemy = hasEnemy(catalog, enemyType)
      ? catalog[enemyType]
      : { name: 'Враг', hp: 30, attack: 6, physDef: 2, magicDef: 1, asset: 'skeleton_warrior_dark' };
    const enemy = { ...baseEnemy };
    const customStats = {
      hp: customStat(roundConfig, 'customHp'),
      attack: customStat(roundConfig, 'customAttack'),
      physDef: customStat(roundConfig, 'customPhysDef'),
      magicDef: customStat(roundConfig, 'customMagicDef'),
      defense: customStat(roundConfig, 'customDefense'),
    };
    const hasCustomStats = Object.values(customStats).some((value) => value !== null);
    const hpGrowth = readGrowth(settings.monsterHpGrowth ?? state.monsterHpGrowth);
    const attackGrowth = readGrowth(settings.monsterAttackGrowth ?? state.monsterAttackGrowth);
    const defenseGrowth = readGrowth(settings.monsterDefenseGrowth ?? state.monsterDefenseGrowth);
    const hpScaling = 1 + (round - 1) * hpGrowth;
    const attackScaling = 1 + (round - 1) * attackGrowth;
    const defenseScaling = 1 + (round - 1) * defenseGrowth;

    if (hasCustomStats) {
      if (customStats.hp !== null) enemy.hp = customStats.hp;
      else enemy.hp = Math.floor(Number(enemy.hp) * hpScaling);

      if (customStats.attack !== null) enemy.attack = customStats.attack;
      else enemy.attack = Math.floor(Number(enemy.attack) * attackScaling);

      if (customStats.physDef !== null) {
        enemy.physDef = customStats.physDef;
      } else if (customStats.defense !== null) {
        enemy.physDef = customStats.defense;
      } else {
        enemy.physDef = Math.floor(Number(enemy.physDef) * defenseScaling);
      }

      if (customStats.magicDef !== null) {
        enemy.magicDef = customStats.magicDef;
      } else if (customStats.defense !== null) {
        enemy.magicDef = customStats.defense;
      } else {
        enemy.magicDef = Math.floor(Number(enemy.magicDef) * defenseScaling);
      }
    } else {
      enemy.hp = Math.floor(Number(enemy.hp) * hpScaling);
      enemy.attack = Math.floor(Number(enemy.attack) * attackScaling);
      enemy.physDef = Math.floor(Number(enemy.physDef) * defenseScaling);
      enemy.magicDef = Math.floor(Number(enemy.magicDef) * defenseScaling);
    }

    if (settings.applyStrengthBonus !== false && round > 1 && round <= 20 && enemyType !== 'void_lord') {
      enemy.hp = Math.floor(Number(enemy.hp) * 2);
      enemy.attack = Math.floor(Number(enemy.attack) * 2);
      enemy.physDef = Math.floor(Number(enemy.physDef) * 2);
      enemy.magicDef = Math.floor(Number(enemy.magicDef) * 2);
    }

    enemy.hp = readInteger(enemy.hp, 30, 1);
    enemy.attack = readInteger(enemy.attack, 6, 1);
    enemy.physDef = readInteger(enemy.physDef, 2, 0);
    enemy.magicDef = readInteger(enemy.magicDef, 1, 0);
    enemy.maxHp = enemy.hp;

    return {
      nextState: { ...state, round },
      enemyType,
      enemy,
    };
  }

  function calculateRequiredExp(levelValue) {
    const level = readInteger(levelValue, 1, 1, MAX_STAT);
    const totalExp = Math.round(2.92 * Math.pow(level, 2.69) + 31.23);
    return Math.max(1, Math.min(Number.MAX_SAFE_INTEGER, totalExp));
  }

  function getExpForNextLevel(currentLevel) {
    const level = readInteger(currentLevel, 1, 1, MAX_STAT);
    return calculateRequiredExp(Math.min(level + 1, MAX_STAT));
  }

  function getExperienceReward(completedRoundValue) {
    const round = readPositiveRound(completedRoundValue);
    if (round <= 5) return 11;
    if (round <= 10) return 15;
    if (round <= 15) return 32;
    if (round <= 20) return 42;
    if (round <= 25) return 55;
    if (round <= 30) return 72;
    if (round <= 35) return 95;
    return 125;
  }

  function readLevelBaseStat(value) {
    return readInteger(value || 1, 1);
  }

  function randomStatGain(randomSource) {
    if (typeof randomSource !== 'function') return 1;
    const value = Number(randomSource());
    const normalized = Number.isFinite(value)
      ? Math.max(0, Math.min(value, 1 - Number.EPSILON))
      : 0;
    return Math.floor(normalized * 6) + 1;
  }

  function awardExperience(runState, amountValue, randomSource = Math.random) {
    const state = asObject(runState);
    const currentLevel = readInteger(state.level, 1, 1, MAX_STAT);
    const currentExp = readInteger(state.score, 0);
    const expAdded = readInteger(amountValue, 0);
    const nextState = {
      ...state,
      level: currentLevel,
      score: Math.min(MAX_STAT, currentExp + expAdded),
    };
    const totalStatGains = { attack: 0, magic: 0, defense: 0 };
    let level = currentLevel;
    let leveledUp = false;

    for (let attempt = 0; attempt < MAX_LEVEL_UPS_PER_AWARD; attempt += 1) {
      if (nextState.score < getExpForNextLevel(level)) break;
      level += 1;
      leveledUp = true;
      const maxHp = readInteger(nextState.maxHp, 100, 0) || 100;
      nextState.maxHp = Math.min(MAX_STAT, maxHp + 100);
      nextState.playerHp = nextState.maxHp;

      const gains = {
        attack: randomStatGain(randomSource),
        magic: randomStatGain(randomSource),
        defense: randomStatGain(randomSource),
      };
      nextState.baseAttack = readLevelBaseStat(nextState.baseAttack) + gains.attack;
      nextState.baseMagic = readLevelBaseStat(nextState.baseMagic) + gains.magic;
      nextState.baseDefense = readLevelBaseStat(nextState.baseDefense) + gains.defense;
      totalStatGains.attack += gains.attack;
      totalStatGains.magic += gains.magic;
      totalStatGains.defense += gains.defense;
    }

    nextState.level = level;
    return { nextState, expAdded, leveledUp, totalStatGains };
  }

  window.progressionRules = {
    createEncounter,
    getEnemyTypeForRound,
    calculateRequiredExp,
    getExpForNextLevel,
    getExperienceReward,
    awardExperience,
  };
})();
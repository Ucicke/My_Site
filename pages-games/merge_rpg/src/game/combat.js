/* Pure combat state and turn rules. */
(function () {
  const MAX_COMBAT_VALUE = 999999;
  const TARGETS = ['head', 'body', 'limbs'];
  const STANCES = ['defensive', 'balanced', 'aggressive'];
  const TARGET_MULTIPLIERS = { head: 2, body: 1, limbs: 0.7 };
  const HIT_CHANCES = { head: 50, body: 80, limbs: 90 };

  function readInteger(value, fallback = 0, minimum = 0, maximum = MAX_COMBAT_VALUE) {
    if (value === null || value === undefined || value === '') return fallback;

    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.max(minimum, Math.min(maximum, parsed));
  }

  function readText(value, fallback) {
    return typeof value === 'string' && value.trim() ? value : fallback;
  }

  function normalizeTarget(target) {
    return TARGETS.includes(target) ? target : 'body';
  }

  function normalizeStance(stance) {
    return STANCES.includes(stance) ? stance : 'balanced';
  }

  function cloneCombatState(combatState) {
    const state = combatState && typeof combatState === 'object' ? combatState : {};
    const playerMaxHp = readInteger(state.playerMaxHp, 100, 1);
    const enemyMaxHp = readInteger(state.enemyMaxHp, readInteger(state.enemyHp, 30, 1), 1);

    return {
      ...state,
      playerHp: readInteger(state.playerHp, playerMaxHp, 0, playerMaxHp),
      playerMaxHp,
      playerAttack: readInteger(state.playerAttack, 0),
      playerMagic: readInteger(state.playerMagic, 0),
      playerDefense: readInteger(state.playerDefense, 0),
      playerPotions: readInteger(state.playerPotions, 0),
      enemyHp: readInteger(state.enemyHp, enemyMaxHp, 0, enemyMaxHp),
      enemyMaxHp,
      enemyAttack: readInteger(state.enemyAttack, 0),
      enemyPhysDef: readInteger(state.enemyPhysDef, 0),
      enemyMagicDef: readInteger(state.enemyMagicDef, 0),
      enemyName: readText(state.enemyName, 'Враг'),
      enemyAsset: readText(state.enemyAsset, 'skeleton_warrior_enemy'),
      playerAttackTarget: TARGETS.includes(state.playerAttackTarget)
        ? state.playerAttackTarget
        : null,
      playerStance: normalizeStance(state.playerStance || state.lastStance),
      enemyAttackTarget: TARGETS.includes(state.enemyAttackTarget)
        ? state.enemyAttackTarget
        : null,
      enemyDefenseTarget: TARGETS.includes(state.enemyDefenseTarget)
        ? state.enemyDefenseTarget
        : null,
      lastStance: normalizeStance(state.lastStance || state.playerStance),
      combatLog: Array.isArray(state.combatLog) ? [...state.combatLog] : [],
      battleEnded: Boolean(state.battleEnded),
      outcome: state.outcome === 'victory' || state.outcome === 'defeat' ? state.outcome : null,
    };
  }

  function createCombatState(playerStats = {}, enemyData = {}, startingHealth) {
    const player = playerStats && typeof playerStats === 'object' ? playerStats : {};
    const enemy = enemyData && typeof enemyData === 'object' ? enemyData : {};
    const playerMaxHp = readInteger(player.playerMaxHp, 100, 1);
    const enemyMaxHp = readInteger(enemy.maxHp ?? enemy.hp, 30, 1);
    const lastStance = normalizeStance(player.lastStance);

    return {
      playerHp: readInteger(startingHealth, playerMaxHp, 0, playerMaxHp),
      playerMaxHp,
      playerAttack: readInteger(player.playerAttack, 0),
      playerMagic: readInteger(player.playerMagic, 0),
      playerDefense: readInteger(player.playerDefense, 0),
      playerPotions: readInteger(player.playerPotions, 0),
      enemyHp: readInteger(enemy.hp, enemyMaxHp, 0, enemyMaxHp),
      enemyMaxHp,
      enemyAttack: readInteger(enemy.attack, 0),
      enemyPhysDef: readInteger(enemy.physDef, 0),
      enemyMagicDef: readInteger(enemy.magicDef, 0),
      enemyName: readText(enemy.name, 'Враг'),
      enemyAsset: readText(enemy.asset, 'skeleton_warrior_enemy'),
      turn: 'player',
      round: 1,
      combatLog: [],
      battleEnded: false,
      outcome: null,
      playerAttackTarget: null,
      playerStance: lastStance,
      enemyAttackTarget: null,
      enemyDefenseTarget: null,
      waitingForPlayerChoice: true,
      lastStance,
    };
  }

  function applyStance(value, stance, defensive = false) {
    if (defensive && stance === 'defensive') return Math.floor(value * 2);
    if (defensive && stance === 'aggressive') return Math.floor(value * 0.5);
    if (!defensive && stance === 'defensive') return Math.floor(value * 0.5);
    if (!defensive && stance === 'aggressive') return Math.floor(value * 2);
    return value;
  }

  function damageForTarget(baseDamage, target) {
    return Math.max(0, Math.min(MAX_COMBAT_VALUE, Math.floor(baseDamage * TARGET_MULTIPLIERS[target])));
  }

  function getDamagePreview(combatState) {
    const state = cloneCombatState(combatState);
    const stance = normalizeStance(state.playerStance);
    const baseDamage = applyStance(state.playerAttack + state.playerMagic, stance);
    const defendedPhysical = Math.max(0, state.playerAttack - state.enemyPhysDef);
    const defendedMagic = Math.max(0, state.playerMagic - state.enemyMagicDef);
    const finalDamage = applyStance(defendedPhysical + defendedMagic, stance);

    return TARGETS.reduce((preview, target) => {
      preview[target] = {
        base: damageForTarget(baseDamage, target),
        final: damageForTarget(finalDamage, target),
      };
      return preview;
    }, {});
  }

  function chooseAttackTarget(combatState, target) {
    const state = cloneCombatState(combatState);
    if (!TARGETS.includes(target)) return state;
    return { ...state, playerAttackTarget: target };
  }

  function chooseStance(combatState, stance) {
    const state = cloneCombatState(combatState);
    if (!STANCES.includes(stance)) return state;
    return { ...state, playerStance: stance };
  }

  function randomValue(randomSource) {
    if (typeof randomSource !== 'function') return 0;
    const value = Number(randomSource());
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(value, 1 - Number.EPSILON));
  }

  function chooseEnemyTarget(randomSource) {
    const roll = randomValue(randomSource);
    if (roll < 0.1) return 'head';
    if (roll < 0.6) return 'body';
    return 'limbs';
  }

  function resolveTurn(combatState, playerChoice = {}, randomSource) {
    const current = cloneCombatState(combatState);
    if (current.battleEnded) {
      return { nextState: current, events: [], outcome: current.outcome };
    }

    const choice = playerChoice && typeof playerChoice === 'object' ? playerChoice : {};
    const attackTarget = TARGETS.includes(choice.attackTarget)
      ? choice.attackTarget
      : normalizeTarget(current.playerAttackTarget);
    const stance = STANCES.includes(choice.stance)
      ? choice.stance
      : normalizeStance(current.playerStance);
    const enemyAttackTarget = chooseEnemyTarget(randomSource);
    const playerHitChance = HIT_CHANCES[attackTarget];
    const enemyHitChance = HIT_CHANCES[enemyAttackTarget];
    const playerHit = randomValue(randomSource) * 100 < playerHitChance;
    const enemyHit = randomValue(randomSource) * 100 < enemyHitChance;

    let playerDamage = 0;
    let enemyDamage = 0;

    if (playerHit) {
      const defendedPhysical = Math.max(0, current.playerAttack - current.enemyPhysDef);
      const defendedMagic = Math.max(0, current.playerMagic - current.enemyMagicDef);
      playerDamage = damageForTarget(
        applyStance(defendedPhysical + defendedMagic, stance),
        attackTarget
      );
    }

    if (enemyHit) {
      const effectiveDefense = applyStance(current.playerDefense, stance, true);
      enemyDamage = damageForTarget(current.enemyAttack - effectiveDefense, enemyAttackTarget);
    }

    const nextState = {
      ...current,
      enemyHp: Math.max(0, current.enemyHp - playerDamage),
      playerHp: Math.max(0, current.playerHp - enemyDamage),
      playerAttackTarget: attackTarget,
      playerStance: stance,
      enemyAttackTarget,
      waitingForPlayerChoice: false,
    };
    const outcome = nextState.enemyHp <= 0
      ? 'victory'
      : nextState.playerHp <= 0
        ? 'defeat'
        : null;
    nextState.outcome = outcome;

    return {
      nextState,
      outcome,
      events: [
        { type: 'playerChoice', target: attackTarget, stance },
        { type: 'enemyChoice', target: enemyAttackTarget },
        {
          type: 'playerResult',
          target: attackTarget,
          hit: playerHit,
          hitChance: playerHitChance,
          damage: playerDamage,
          blocked: playerHit && playerDamage === 0,
        },
        {
          type: 'enemyResult',
          target: enemyAttackTarget,
          hit: enemyHit,
          hitChance: enemyHitChance,
          damage: enemyDamage,
          blocked: enemyHit && enemyDamage === 0,
        },
      ],
    };
  }

  function startNextTurn(combatState) {
    const state = cloneCombatState(combatState);
    return {
      ...state,
      turn: 'player',
      playerAttackTarget: null,
      enemyAttackTarget: null,
      enemyDefenseTarget: null,
      waitingForPlayerChoice: true,
      outcome: null,
    };
  }

  function finishBattle(combatState, outcome) {
    const state = cloneCombatState(combatState);
    const finalOutcome = outcome === 'victory' || outcome === 'defeat' ? outcome : state.outcome;
    return { ...state, battleEnded: true, outcome: finalOutcome };
  }

  window.combatRules = {
    createCombatState,
    resolveTurn,
    getDamagePreview,
    chooseAttackTarget,
    chooseStance,
    startNextTurn,
    finishBattle,
  };
})();
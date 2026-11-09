/* Pure reward offer and choice transitions. */
(function () {
  const ITEM_TYPES = ['dagger', 'magic', 'armor', 'potion'];
  const MAX_ROUND = 1000000;
  const MAX_TIER = 100;
  const MAX_STAT = 1000000;

  function asObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function readRound(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 1) return 1;
    return Math.min(parsed, MAX_ROUND);
  }

  function validTierCatalog(value) {
    const catalog = asObject(value);
    return ITEM_TYPES.every((type) => {
      const tier = catalog[type];
      return Number.isInteger(tier) && tier >= 1 && tier <= MAX_TIER;
    });
  }

  function validRewardItem(item) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return false;
    if (typeof item.id !== 'string' || !item.id.trim() || item.id.length > 200) return false;
    if (!ITEM_TYPES.includes(item.type)) return false;
    if (!Number.isInteger(item.tier) || item.tier < 1 || item.tier > MAX_TIER) return false;
    if (!item.stats || typeof item.stats !== 'object' || Array.isArray(item.stats)) return false;

    return Object.entries(item.stats).every(([key, value]) => {
      if (key === 'name') return typeof value === 'string' && value.length <= 200;
      return typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= MAX_STAT;
    });
  }

  function unchangedState(runState) {
    const state = asObject(runState);
    return { ...state };
  }

  function createEmptyOffer(runState, currentRound, status) {
    const emptyCounts = { weaponCount: 0, magicCount: 0, armorCount: 0, potionCount: 0 };
    return {
      nextState: unchangedState(runState),
      items: [],
      requestedCounts: emptyCounts,
      generatedCounts: { ...emptyCounts },
      firstFloor: currentRound === 1,
      completedRound: currentRound - 1,
      currentRound,
      status,
    };
  }

  function createOffer(runState, configuration = {}, generator = window.itemGenerationRules) {
    const state = asObject(runState);
    const options = asObject(configuration);
    const currentRound = readRound(state.round);
    const completedRound = currentRound - 1;
    const maxTiers = options.maxTiers ?? window.itemMaxTiers;
    const generateRandomItemStats = options.generateRandomItemStats;
    const nextState = unchangedState(state);

    if (
      !generator
      || typeof generator.createRewardItems !== 'function'
      || !validTierCatalog(maxTiers)
      || typeof generateRandomItemStats !== 'function'
    ) {
      return createEmptyOffer(state, currentRound, 'invalid_configuration');
    }

    const generationOptions = {
      completedRound,
      currentRound,
      maxTiers,
      spawnConfig: asObject(options.spawnConfig ?? state.itemSpawnConfig),
      advancedCoefficient: options.advancedCoefficient ?? state.advancedItemCoefficient,
      generateRandomItemStats,
      random: typeof options.random === 'function' ? options.random : undefined,
      now: typeof options.now === 'function' ? options.now : undefined,
    };

    let generated;
    try {
      generated = generator.createRewardItems(generationOptions);
    } catch {
      return createEmptyOffer(state, currentRound, 'generation_failed');
    }

    if (!generated || typeof generated !== 'object' || !Array.isArray(generated.items)) {
      return createEmptyOffer(state, currentRound, 'invalid_generation');
    }

    const ids = new Set();
    for (const item of generated.items) {
      if (!validRewardItem(item) || ids.has(item.id)) {
        return createEmptyOffer(state, currentRound, 'invalid_generation');
      }
      ids.add(item.id);
    }

    return {
      nextState,
      items: generated.items.slice(),
      requestedCounts: asObject(generated.requestedCounts),
      generatedCounts: asObject(generated.generatedCounts),
      firstFloor: Boolean(generated.firstFloor),
      completedRound,
      currentRound,
      status: 'offered',
    };
  }

  function resolveChoice(runState, rewardId, offeredItems) {
    const state = asObject(runState);
    if (rewardId === null || rewardId === undefined) {
      return {
        nextState: unchangedState(state),
        accepted: false,
        status: 'declined',
        nextPhase: 'management',
      };
    }

    const offer = Array.isArray(offeredItems) ? offeredItems : [];
    const item = typeof rewardId === 'string'
      ? offer.find((candidate) => candidate && candidate.id === rewardId)
      : undefined;

    if (!item || !validRewardItem(item)) {
      return {
        nextState: unchangedState(state),
        accepted: false,
        status: 'invalid',
        nextPhase: 'management',
      };
    }

    const currentItems = Array.isArray(state.items) ? state.items : [];
    if (currentItems.some((currentItem) => currentItem && currentItem.id === item.id)) {
      return {
        nextState: unchangedState(state),
        accepted: false,
        status: 'invalid',
        nextPhase: 'management',
      };
    }

    return {
      nextState: { ...state, items: [...currentItems, item] },
      accepted: true,
      status: 'accepted',
      nextPhase: 'management',
    };
  }

  window.rewardRules = { createOffer, resolveChoice };
})();
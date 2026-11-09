/* Reward loot generation rules. */
(function () {
  const defaultTierProbabilities = [0.6, 0.25, 0.1, 0.04, 0.008, 0.0015, 0.0004, 0.0001];

  function createRewardItems({
    completedRound,
    currentRound,
    maxTiers,
    spawnConfig,
    advancedCoefficient,
    generateRandomItemStats,
    random = Math.random,
    now = Date.now,
  }) {
    const requestedCounts = {
      weaponCount: Math.floor(random() * 2) + 1,
      magicCount: Math.floor(random() * 2) + 1,
      armorCount: Math.floor(random() * 2) + 1,
      potionCount: Math.floor(random() * 2) + 1,
    };
    const roundToCheck = completedRound || currentRound || 1;
    const items = [];
    const options = {
      maxTiers,
      spawnConfig,
      advancedCoefficient,
      generateRandomItemStats,
      random,
      now,
    };
    let generatedCounts = requestedCounts;
    let itemCounts;

    if (roundToCheck === 1) {
      const totalRequested = Object.values(requestedCounts).reduce((sum, count) => sum + count, 0);
      const guaranteedCount = Math.max(totalRequested, 3);
      const weaponCount = Math.max(1, Math.ceil(guaranteedCount / 3));
      const armorCount = Math.max(1, Math.ceil(guaranteedCount / 3));
      const magicCount = Math.max(1, guaranteedCount - weaponCount - armorCount);

      generatedCounts = { weaponCount, magicCount, armorCount, potionCount: 0 };
      itemCounts = [
        ['dagger', weaponCount],
        ['armor', armorCount],
        ['magic', magicCount],
      ];
    } else {
      const { weaponCount, magicCount, armorCount, potionCount } = requestedCounts;
      itemCounts = [
        ['dagger', weaponCount],
        ['magic', magicCount],
        ['armor', armorCount],
        ['potion', potionCount],
      ];
    }

    itemCounts.forEach(([itemType, count]) =>
      appendItems(items, itemType, count, roundToCheck, options)
    );

    return {
      items,
      round: roundToCheck,
      requestedCounts,
      generatedCounts,
      firstFloor: roundToCheck === 1,
    };
  }

  function appendItems(items, itemType, count, round, options) {
    const coefficient = parseFloat(options.advancedCoefficient) || 0.1;
    const spawnConfig = options.spawnConfig || {};
    const probabilities = spawnConfig.tierProbabilities || defaultTierProbabilities;
    const maxTier = options.maxTiers[itemType];

    for (let index = 0; index < count; index++) {
      const advancedBonus = (round - 1) * coefficient;
      const tierRoll = options.random();
      const adjustedProbabilities = probabilities.map((probability, probabilityIndex) => {
        const tierLevel = probabilityIndex + 1;
        if (round <= 5 && tierLevel >= 6) return 0;
        if (round <= 10 && tierLevel >= 7) return 0;
        if (round <= 15 && tierLevel >= 8) return 0;
        return probability * (1 + advancedBonus * tierLevel * 0.3);
      });

      const totalProbability = adjustedProbabilities.reduce(
        (sum, probability) => sum + probability,
        0
      );
      const normalizedProbabilities = adjustedProbabilities.map(
        (probability) => probability / totalProbability
      );

      let cumulativeProbability = 0;
      let tier = 1;
      for (let candidateTier = 1; candidateTier <= maxTier; candidateTier++) {
        cumulativeProbability += normalizedProbabilities[candidateTier - 1];
        if (tierRoll < cumulativeProbability) {
          tier = candidateTier;
          break;
        }
      }

      tier = Math.min(tier, maxTier);
      items.push({
        id:
          'item_' +
          itemType +
          '_' +
          options.now() +
          '_' +
          options.random().toString(36).substr(2, 9),
        type: itemType,
        tier,
        rotated: false,
        stats: options.generateRandomItemStats(itemType, tier, round),
      });
    }
  }

  window.itemGenerationRules = { createRewardItems };
})();

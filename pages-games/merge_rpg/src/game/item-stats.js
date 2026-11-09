/* Item-stat lookup and tier-based variance rules. */
(function () {
  const itemStats = window.itemStats;

  function getItemStats(type, tier, itemData = null) {
    if (itemData && itemData.stats) {
      return {
        ...itemData.stats,
        name:
          itemStats[type] && itemStats[type][tier]
            ? itemStats[type][tier].name
            : 'Неизвестный предмет',
      };
    }

    return itemStats[type] && itemStats[type][tier] ? itemStats[type][tier] : {};
  }

  function generateRandomItemStats(type, tier, currentFloor = null) {
    let sourceStats = itemStats;
    if (
      window.gameConfig &&
      window.gameConfig.itemStats &&
      window.gameConfig.itemStats[type] &&
      window.gameConfig.itemStats[type][tier]
    ) {
      sourceStats = window.gameConfig.itemStats;
    }

    const baseStats =
      sourceStats[type] && sourceStats[type][tier] ? sourceStats[type][tier] : {};
    const randomStats = { name: baseStats.name || 'Неизвестный предмет' };
    const floor = currentFloor || window.gameConfig.round || 1;

    // The variance begins at ±20% and shifts upward by 2% per floor.
    const baseVariance = 20;
    const floorShift = (floor - 1) * 2;
    const minVariance = Math.max(-baseVariance, -baseVariance + floorShift);
    const maxVariance = baseVariance + floorShift;

    for (const stat of ['attack', 'defense', 'magic', 'healing', 'points']) {
      if (!baseStats[stat]) continue;

      const variance = minVariance + Math.random() * (maxVariance - minVariance);
      const multiplier = 1 + variance / 100;
      randomStats[stat] = Math.max(1, Math.floor(baseStats[stat] * multiplier));
    }

    return randomStats;
  }

  window.itemStatsRules = { getItemStats, generateRandomItemStats };
})();

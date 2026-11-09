/* Pure item-merging state transition. */
(function () {
  function combineItemStats(firstStats, secondStats) {
    const combinedStats = {};

    for (const stat of ['attack', 'defense', 'magic', 'healing', 'points']) {
      if (firstStats[stat] || secondStats[stat]) {
        combinedStats[stat] = (firstStats[stat] || 0) + (secondStats[stat] || 0);
      }
    }

    return combinedStats;
  }

  function mergeItems(
    items,
    draggedItemData,
    targetItemData,
    { draggedStats, targetStats, maxTier, mergedItemId }
  ) {
    const currentTier = draggedItemData.tier;
    const newTier = currentTier >= maxTier ? maxTier : currentTier + 1;
    const mergedItem = {
      id: mergedItemId,
      type: draggedItemData.type,
      tier: newTier,
      x: targetItemData.x,
      y: targetItemData.y,
      rotated: targetItemData.rotated,
      stats: combineItemStats(draggedStats, targetStats),
    };

    const nextItems = items.filter(
      (item) => item.id !== draggedItemData.id && item.id !== targetItemData.id
    );
    nextItems.push(mergedItem);

    return { items: nextItems, mergedItem, currentTier, maxTier };
  }

  window.mergingRules = { mergeItems };
})();

/* Inventory placement and state transitions. */
(function () {
  const itemTypes = window.itemTypes;

  function canMergeItems(item1, item2) {
    if (item1.type !== item2.type || item1.tier !== item2.tier) {
      return false;
    }

    // Tier-eight items still merge; their resulting tier is handled by the caller.
    return true;
  }

  function canPlaceItem(items, x, y, width, height, excludeId = null) {
    const gridWidth = 6;
    const gridHeight = 6;

    if (x < 0 || y < 0 || x + width > gridWidth || y + height > gridHeight) {
      return false;
    }

    for (let checkY = y; checkY < y + height; checkY++) {
      for (let checkX = x; checkX < x + width; checkX++) {
        const occupyingItem = items.find((item) => {
          if (item.id === excludeId) return false;

          const itemType = itemTypes[item.type];
          const itemWidth = item.rotated ? itemType.height : itemType.width;
          const itemHeight = item.rotated ? itemType.width : itemType.height;

          return (
            checkX >= item.x &&
            checkX < item.x + itemWidth &&
            checkY >= item.y &&
            checkY < item.y + itemHeight
          );
        });

        if (occupyingItem) return false;
      }
    }

    return true;
  }

  function placeStagingItem(items, itemId, x, y) {
    return items.map((item) =>
      item.id === itemId
        ? { ...item, x, y, rotated: item.rotated || false }
        : item
    );
  }

  function moveGridItem(items, itemId, x, y) {
    return items.map((item) => (item.id === itemId ? { ...item, x, y } : item));
  }

  function moveItemToStaging(items, itemId) {
    return items.map((item) => {
      if (item.id !== itemId) return item;

      const stagingItem = { ...item };
      delete stagingItem.x;
      delete stagingItem.y;
      delete stagingItem.rotated;
      return stagingItem;
    });
  }

  function moveAllItemsToStaging(items) {
    return items.map((item) => {
      const stagingItem = { ...item };
      delete stagingItem.x;
      delete stagingItem.y;
      delete stagingItem.rotated;
      return stagingItem;
    });
  }

  function swapWithStaging(items, gridItemId, stagingItemId) {
    const gridItem = items.find((item) => item.id === gridItemId);
    const stagingItem = items.find((item) => item.id === stagingItemId);
    if (!gridItem || !stagingItem) return items;

    return items.map((item) => {
      if (item.id === gridItemId) {
        const nextGridItem = { ...item };
        delete nextGridItem.x;
        delete nextGridItem.y;
        delete nextGridItem.rotated;
        return nextGridItem;
      }

      if (item.id === stagingItemId) {
        return {
          ...item,
          x: gridItem.x,
          y: gridItem.y,
          rotated: item.rotated || false,
        };
      }

      return item;
    });
  }

  function rotateGridItem(items, itemId) {
    const item = items.find((candidate) => candidate.id === itemId);
    if (!item) return items;

    const itemType = itemTypes[item.type];
    const width = item.rotated ? itemType.width : itemType.height;
    const height = item.rotated ? itemType.height : itemType.width;
    if (!canPlaceItem(items, item.x, item.y, width, height, itemId)) return items;

    return items.map((candidate) =>
      candidate.id === itemId ? { ...candidate, rotated: !candidate.rotated } : candidate
    );
  }

  function findFirstFit(items, itemId, width, height) {
    const gridWidth = 6;
    const gridHeight = 6;

    for (let y = 0; y <= gridHeight - height; y++) {
      for (let x = 0; x <= gridWidth - width; x++) {
        if (canPlaceItem(items, x, y, width, height, itemId)) return { x, y };
      }
    }

    return null;
  }

  function placeAllStagingItems(items) {
    let nextItems = items;
    let placedCount = 0;

    items.forEach((item) => {
      if (item.x !== undefined && item.y !== undefined) return;

      const itemType = itemTypes[item.type];
      const width = item.rotated ? itemType.height : itemType.width;
      const height = item.rotated ? itemType.width : itemType.height;
      const position = findFirstFit(nextItems, item.id, width, height);
      if (!position) return;

      nextItems = placeStagingItem(nextItems, item.id, position.x, position.y);
      placedCount++;
    });

    return { items: nextItems, placedCount };
  }

  function sortEquippedItems(items, compare) {
    const equippedItems = items
      .filter((item) => item.x !== undefined && item.y !== undefined)
      .sort(compare);
    if (equippedItems.length === 0) return items;

    const equippedIds = new Set(equippedItems.map((item) => item.id));
    let nextItems = items.map((item) => {
      if (!equippedIds.has(item.id)) return item;

      const stagingItem = { ...item };
      delete stagingItem.x;
      delete stagingItem.y;
      delete stagingItem.rotated;
      return stagingItem;
    });

    equippedItems.forEach((item) => {
      const itemType = itemTypes[item.type];
      const position = findFirstFit(nextItems, item.id, itemType.width, itemType.height);
      if (!position) return;

      nextItems = nextItems.map((candidate) =>
        candidate.id === item.id
          ? { ...candidate, x: position.x, y: position.y, rotated: false }
          : candidate
      );
    });

    return nextItems;
  }

  function sortInventoryByClass(items) {
    const classOrder = { dagger: 1, magic: 2, armor: 3, potion: 4 };
    return sortEquippedItems(items, (first, second) => {
      const classDifference = (classOrder[first.type] || 999) - (classOrder[second.type] || 999);
      if (classDifference !== 0) return classDifference;
      return second.tier - first.tier;
    });
  }

  function sortInventoryByRarity(items) {
    return sortEquippedItems(items, (first, second) => {
      if (first.tier !== second.tier) return second.tier - first.tier;
      return first.type.localeCompare(second.type);
    });
  }

  window.inventoryRules = {
    canMergeItems,
    canPlaceItem,
    placeStagingItem,
    moveGridItem,
    moveItemToStaging,
    moveAllItemsToStaging,
    swapWithStaging,
    rotateGridItem,
    placeAllStagingItems,
    sortInventoryByClass,
    sortInventoryByRarity,
  };
})();

/* Selection and tap gesture controller for inventory input. */
(function () {
  function createInventoryInput(config, callbacks = {}) {
    const { inventoryRules, mergingRules } = config;
    let selectedItemId = null;
    let lastTappedItemId = null;
    let lastTappedAt = 0;
    let selectionError = '';
    let errorCell = null;
    let pointerGesture = null;
    function allItems() {
      return config.getItems();
    }

    function findItem(itemId) {
      return allItems().find((item) => String(item.id) === String(itemId)) || null;
    }

    function dimensions(item) {
      const type = config.itemTypes[item.type];
      if (!type) return null;
      return {
        width: item.rotated ? type.height : type.width,
        height: item.rotated ? type.width : type.height,
      };
    }

    function isEquipped(item) {
      return item.x !== undefined && item.y !== undefined;
    }
    function beginGesture(itemId, eventType, clientX, clientY) {
      pointerGesture = {
        itemId: String(itemId),
        eventType,
        startX: clientX,
        startY: clientY,
        startedAt: Date.now(),
        moved: false,
      };
      return true;
    }

    function moveGesture(eventType, clientX, clientY) {
      if (!pointerGesture) return false;
      const deltaX = Math.abs(clientX - pointerGesture.startX);
      const deltaY = Math.abs(clientY - pointerGesture.startY);
      if (deltaX >= 10 || deltaY >= 10) pointerGesture.moved = true;
      return pointerGesture.moved;
    }

    function endGesture(eventType, clientX, clientY) {
      if (!pointerGesture) return null;
      const gesture = pointerGesture;
      moveGesture(eventType, clientX, clientY);
      pointerGesture = null;
      const isTouchTap =
        gesture.eventType === 'touchstart' &&
        eventType === 'touchend' &&
        !gesture.moved &&
        Date.now() - gesture.startedAt < 500;
      return { type: isTouchTap ? 'tap' : 'drag', itemId: gesture.itemId };
    }

    function cancelGesture() {
      const gesture = pointerGesture;
      pointerGesture = null;
      return gesture;
    }

    function getSelectionSnapshot() {
      const item = selectedItemId === null ? null : findItem(selectedItemId);
      if (!item) {
        return { item: null, validCells: [], mergeTargetIds: [], error: selectionError, errorCell };
      }

      const size = dimensions(item);
      const validCells = [];
      if (size) {
        for (let y = 0; y < 6; y++) {
          for (let x = 0; x < 6; x++) {
            if (inventoryRules.canPlaceItem(allItems(), x, y, size.width, size.height, item.id)) {
              validCells.push({ x, y });
            }
          }
        }
      }

      const mergeTargetIds = allItems()
        .filter((candidate) => candidate.id !== item.id && isEquipped(candidate))
        .filter((candidate) => inventoryRules.canMergeItems(item, candidate))
        .map((candidate) => String(candidate.id));

      return { item, validCells, mergeTargetIds, error: selectionError, errorCell };
    }

    function notifySelection() {
      const snapshot = getSelectionSnapshot();
      if (callbacks.onSelectionChange) callbacks.onSelectionChange(snapshot);
      if (callbacks.onDetails) callbacks.onDetails(snapshot.item, snapshot.error);
    }

    function choose(itemId) {
      const item = findItem(itemId);
      if (!item) return false;
      selectedItemId = String(item.id);
      selectionError = '';
      errorCell = null;
      notifySelection();
      return true;
    }

    function cancelSelection() {
      if (selectedItemId === null) return false;
      selectedItemId = null;
      selectionError = '';
      errorCell = null;
      notifySelection();
      return true;
    }

    function reportInvalid(message, cell = null) {
      selectionError = message || 'Нельзя поместить предмет сюда. Выберите другое место.';
      errorCell = cell;
      notifySelection();
      return false;
    }

    function emitChange(reason, result = null) {
      if (callbacks.onChange) callbacks.onChange({ reason, result, items: allItems() });
    }

    function applyItems(items, reason, result = null, keepSelection = false) {
      config.setItems(items);
      selectionError = '';
      errorCell = null;
      if (!keepSelection) selectedItemId = null;
      emitChange(reason, result);
      notifySelection();
      return true;
    }

    function mergeInto(source, target) {
      if (!inventoryRules.canMergeItems(source, target) || !isEquipped(target)) return false;
      const options = config.getMergeOptions(source, target);
      const result = mergingRules.mergeItems(allItems(), source, target, options);
      return applyItems(result.items, 'merge', result);
    }

    function rotateSelected() {
      const item = selectedItemId === null ? null : findItem(selectedItemId);
      if (!item || !isEquipped(item)) return false;
      const nextItems = inventoryRules.rotateGridItem(allItems(), item.id);
      if (nextItems === allItems()) {
        return reportInvalid('Предмет нельзя повернуть в текущем положении.');
      }
      return applyItems(nextItems, 'rotate', null, true);
    }

    function placeAt(item, x, y) {
      const size = dimensions(item);
      if (!size || !inventoryRules.canPlaceItem(allItems(), x, y, size.width, size.height, item.id)) {
        return reportInvalid('Нельзя поместить сюда. Выберите подсвеченную клетку.', { x, y });
      }
      const nextItems = isEquipped(item)
        ? inventoryRules.moveGridItem(allItems(), item.id, x, y)
        : inventoryRules.placeStagingItem(allItems(), item.id, x, y);
      return applyItems(nextItems, 'place');
    }

    function swapGridItems(source, target) {
      const sourceSize = dimensions(source);
      const targetSize = dimensions(target);
      if (!sourceSize || !targetSize) return false;

      const itemsWithoutPair = allItems().filter(
        (item) => item.id !== source.id && item.id !== target.id
      );
      if (
        !inventoryRules.canPlaceItem(
          itemsWithoutPair,
          target.x,
          target.y,
          sourceSize.width,
          sourceSize.height,
          source.id
        )
      ) {
        return false;
      }

      const sourceAtTarget = inventoryRules.moveGridItem(
        allItems().filter((item) => item.id !== target.id),
        source.id,
        target.x,
        target.y
      );
      if (
        !inventoryRules.canPlaceItem(
          sourceAtTarget,
          source.x,
          source.y,
          targetSize.width,
          targetSize.height,
          target.id
        )
      ) {
        return false;
      }

      let nextItems = inventoryRules.moveGridItem(allItems(), source.id, target.x, target.y);
      nextItems = inventoryRules.moveGridItem(nextItems, target.id, source.x, source.y);
      return applyItems(nextItems, 'swap');
    }

    function swapStagingAndGrid(source, target) {
      const stagingItem = isEquipped(source) ? target : source;
      const gridItem = isEquipped(source) ? source : target;
      const stagingSize = dimensions(stagingItem);
      if (!stagingSize) return false;
      const remainingItems = allItems().filter(
        (item) => item.id !== stagingItem.id && item.id !== gridItem.id
      );
      if (
        !inventoryRules.canPlaceItem(
          remainingItems,
          gridItem.x,
          gridItem.y,
          stagingSize.width,
          stagingSize.height,
          stagingItem.id
        )
      ) {
        return false;
      }
      return applyItems(
        inventoryRules.swapWithStaging(allItems(), gridItem.id, stagingItem.id),
        'swap'
      );
    }

    function tapStagingItem(target) {
      const source = selectedItemId === null ? null : findItem(selectedItemId);
      if (!source) return choose(target.id);
      if (!isEquipped(source) && !isEquipped(target)) return choose(target.id);

      if (isEquipped(source)) {
        const targetSize = dimensions(target);
        const remainingItems = allItems().filter(
          (item) => item.id !== source.id && item.id !== target.id
        );
        if (
          targetSize &&
          inventoryRules.canPlaceItem(
            remainingItems,
            source.x,
            source.y,
            targetSize.width,
            targetSize.height,
            target.id
          )
        ) {
          return applyItems(
            inventoryRules.swapWithStaging(allItems(), source.id, target.id),
            'swap'
          );
        }
        return applyItems(inventoryRules.moveItemToStaging(allItems(), source.id), 'stage');
      }

      return reportInvalid('Выберите клетку рюкзака, чтобы экипировать предмет.');
    }

    function tapItem(itemId) {
      if (config.getPhase() !== 'management') return false;
      const target = findItem(itemId);
      if (!target) return false;

      const now = Date.now();
      if (
        selectedItemId === String(target.id) &&
        lastTappedItemId === String(target.id) &&
        now - lastTappedAt <= 320 &&
        isEquipped(target)
      ) {
        lastTappedItemId = null;
        lastTappedAt = 0;
        return rotateSelected();
      }
      lastTappedItemId = String(target.id);
      lastTappedAt = now;

      if (selectedItemId === null) return choose(target.id);
      if (selectedItemId === String(target.id)) return cancelSelection();

      const source = findItem(selectedItemId);
      if (!source) return choose(target.id);
      if (!isEquipped(target)) return tapStagingItem(target);
      if (inventoryRules.canMergeItems(source, target)) return mergeInto(source, target);

      if (isEquipped(source)) {
        if (swapGridItems(source, target)) return true;
      } else if (swapStagingAndGrid(source, target)) {
        return true;
      }
      return reportInvalid('Эти предметы нельзя поменять местами. Выберите другое место.');
    }

    function itemAtCell(x, y, excludeId) {
      return allItems().find((item) => {
        if (String(item.id) === String(excludeId) || !isEquipped(item)) return false;
        const size = dimensions(item);
        return size && x >= item.x && x < item.x + size.width && y >= item.y && y < item.y + size.height;
      }) || null;
    }

    function tapGridCell(x, y) {
      if (config.getPhase() !== 'management' || selectedItemId === null) return false;
      const source = findItem(selectedItemId);
      if (!source) return cancelSelection();
      if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || x >= 6 || y < 0 || y >= 6) {
        return reportInvalid('Выберите клетку внутри рюкзака.', { x, y });
      }

      const target = itemAtCell(x, y, source.id);
      if (target && inventoryRules.canMergeItems(source, target)) return mergeInto(source, target);
      if (target) {
        if (isEquipped(source) && swapGridItems(source, target)) return true;
        if (!isEquipped(source) && swapStagingAndGrid(source, target)) return true;
        return reportInvalid('Эти предметы нельзя поменять местами.', { x, y });
      }
      return placeAt(source, x, y);
    }

    function tapStagingArea() {
      if (config.getPhase() !== 'management' || selectedItemId === null) return false;
      const source = findItem(selectedItemId);
      if (!source || !isEquipped(source)) return false;
      return applyItems(inventoryRules.moveItemToStaging(allItems(), source.id), 'stage');
    }

    function tapGridEvent(event) {
      if (!event || !config.getGridCell) return false;
      const cell = config.getGridCell(event);
      return cell ? tapGridCell(cell.x, cell.y) : false;
    }

    function getSelectedId() {
      return selectedItemId;
    }

    function refreshSelection() {
      notifySelection();
    }

    return {
      beginGesture,
      moveGesture,
      endGesture,
      cancelGesture,
      tapItem,
      tapGridCell,
      tapGridEvent,
      tapStagingArea,
      cancelSelection,
      rotateSelected,
      refreshSelection,
      getSelectedId,
      getSelectionSnapshot,
    };
  }

  window.inventoryInput = { create: createInventoryInput };
})();
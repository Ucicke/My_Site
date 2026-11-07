/* ================================================================
   SCROLL HUNTER · engine/canvas-inventory.js
   Слоты свитков и панель подробностей инвентаря.
   ================================================================ */
'use strict';
function drawInventoryScrollArt(scroll, x, y, w, h) {
    const pw = Math.min(w * 0.65, h * 1.15);
    const px = x + (w - pw) / 2;
    const ink = scroll.curse ? '#693d46' : '#5d4830';
    const paper = ctx.createLinearGradient(px, y, px + pw, y + h);
    paper.addColorStop(0, '#c2995d');
    paper.addColorStop(0.45, '#ead4a0');
    paper.addColorStop(1, '#b68a51');
    fillRound(px, y + h * 0.08, pw, h * 0.84, 5, paper, '#8e693d');
    fillRound(px - 5, y, pw + 10, Math.max(5, h * 0.1), 4, '#c9a571', '#8e693d');
    fillRound(px - 5, y + h * 0.9, pw + 10, Math.max(5, h * 0.1), 4, '#c9a571', '#8e693d');
    if (scroll.id === 'mirror' || scroll.id === 'window') {
        // These newer emoji are absent from some Windows emoji fonts.
        ctx.save();
        ctx.strokeStyle = ink;
        ctx.lineWidth = Math.max(1, h * 0.018);
        const cx = x + w / 2, cy = y + h * 0.4, r = h * 0.13;
        ctx.beginPath();
        if (scroll.id === 'mirror') {
            ctx.ellipse(cx, cy, r * 0.7, r, 0, 0, TAU);
            ctx.moveTo(cx, cy + r);
            ctx.lineTo(cx, cy + r * 1.6);
        } else {
            ctx.rect(cx - r, cy - r, r * 2, r * 2);
            ctx.moveTo(cx, cy - r);
            ctx.lineTo(cx, cy + r);
            ctx.moveTo(cx - r, cy);
            ctx.lineTo(cx + r, cy);
        }
        ctx.stroke();
        ctx.restore();
    } else {
        drawText(scroll.icon || '📜', x + w / 2, y + h * 0.42,
            Math.round(h * 0.31) + 'px "Segoe UI Emoji", sans-serif', ink, 'center', 'middle');
    }
    for (let i = 0; i < 3; i++) {
        fillRound(px + pw * 0.2, y + h * (0.68 + i * 0.06), pw * (i === 2 ? 0.38 : 0.6), 1, 0.5, 'rgba(81,57,30,0.4)');
    }
}

function inventoryWindowButton(text, box, action, disabled, goldStyle) {
    drawCommonButton(box, BTN_STYLE[goldStyle ? 'btn-gold' : 'btn-ghost'], disabled, 8);
    drawText(text, box.x + box.w / 2, box.y + box.h / 2,
        '700 12px Inter, sans-serif', disabled ? UIC.dim : UIC.text, 'center', 'middle');
    canvasHits.push({ ...box, ariaLabel: text, disabled: !!disabled, action });
}

function drawInventoryGrid({ narrow, scroll, gridW, gridX, contentY, contentH }) {
    if (!narrow || !scroll) {
        const gap = 10;
        const cell = Math.min(88, (gridW - gap * 3) / 4, (contentH - 68) / 2);
        for (let slot = 0; slot < 8; slot++) {
            const index = inventoryPage * 8 + slot;
            const item = scrollInventory[index];
            const data = item && SCROLL_TYPES.find(sc => sc.id === item.id);
            const cellBox = { x: gridX + (slot % 4) * (cell + gap),
                y: contentY + Math.floor(slot / 4) * (cell + gap), w: cell, h: cell };
            drawCommonButton(cellBox, BTN_STYLE[index === selectedInventoryIndex ? 'btn-gold' : 'btn-ghost'], !data, 10);
            if (data) {
                drawInventoryScrollArt(data, cellBox.x + 8, cellBox.y + 8, cell - 16, cell - 16);
                canvasHits.push({ ...cellBox, ariaLabel: 'Слот ' + (index + 1) + ': ' + data.name,
                    action: () => { selectedInventoryIndex = index; updateUI(); } });
            }
        }
        const pages = Math.max(1, Math.ceil(scrollInventory.length / 8));
        const pagerY = contentY + (cell + gap) * 2 + 8;
        drawText((inventoryPage + 1) + ' / ' + pages, gridX + gridW / 2, pagerY + 17,
            '600 12px Inter, sans-serif', UIC.dim, 'center', 'middle');
        inventoryWindowButton('←', { x: gridX, y: pagerY, w: 45, h: 34 },
            () => { inventoryPage--; selectedInventoryIndex = -1; updateUI(); }, inventoryPage === 0);
        inventoryWindowButton('→', { x: gridX + gridW - 45, y: pagerY, w: 45, h: 34 },
            () => { inventoryPage++; selectedInventoryIndex = -1; updateUI(); }, inventoryPage + 1 >= pages);
    }


}

function drawInventoryDetails({ narrow, box, pad, contentY, contentH, gridW, gridX, scroll, entry }, atMerchant, atExit) {
    const detailX = narrow ? gridX : gridX + gridW + 26;
    const detailW = narrow ? gridW : box.x + box.w - pad - detailX;
    if (!scroll) {
        if (!narrow) {
            drawText(scrollInventory.length ? 'Выберите свиток в слоте' : 'Сумка пока пуста',
                detailX + detailW / 2, contentY + contentH / 2,
                '500 15px Inter, sans-serif', UIC.dim, 'center', 'middle');
        } else if (!scrollInventory.length) {
            drawText('Здесь будут найденные свитки', gridX + gridW / 2, contentY + contentH - 24,
                '500 12px Inter, sans-serif', UIC.dim, 'center', 'middle');
        }
        return;
    }
    let top = contentY;
    if (narrow) {
        inventoryWindowButton('← К слотам', { x: detailX, y: top, w: 112, h: 32 },
            () => { selectedInventoryIndex = -1; updateUI(); });
        top += 46;
    }
    const short = contentH < 320;
    const titleFont = '800 ' + (short ? 12 : 15) + 'px Manrope, Inter, sans-serif';
    const bodyFont = '500 ' + (short ? 11 : 12) + 'px Inter, sans-serif';
    const flavorFont = 'italic ' + (short ? 10 : 12) + 'px Georgia, serif';
    const titleLineH = short ? 16 : 20;
    const bodyLineH = short ? 14 : 17;
    const flavorLineH = short ? 13 : 16;
    const titles = quartermasterTextLines(scroll.name, titleFont, detailW, 10);
    const descriptions = quartermasterTextLines(scroll.desc, bodyFont, detailW, 20);
    const flavors = quartermasterTextLines(scroll.effect, flavorFont, detailW, 20);
    titles.forEach(line => {
        drawText(line, detailX, top + 9, titleFont, UIC.text, 'left', 'middle');
        top += titleLineH;
    });
    const warning = blockedByStinginess() ? 'Скупость не позволяет читать свитки.' : scroll.curse ? 'Проклятый свиток' : '';
    const actionH = atMerchant || atExit ? 82 : 40;
    const textH = descriptions.length * bodyLineH + flavors.length * flavorLineH + actionH + 46 + (warning ? 22 : 0);
    const artH = Math.max(24, Math.min(155, box.y + box.h - 20 - top - textH));
    drawInventoryScrollArt(scroll, detailX, top + 8, detailW, artH);
    top += artH + 26;
    descriptions.forEach(line => {
        drawText(line, detailX, top, bodyFont, scroll.curse ? UIC.red : UIC.text, 'left', 'middle');
        top += bodyLineH;
    });
    if (warning) {
        top += 5;
        drawText(warning, detailX, top, '500 11px Inter, sans-serif', UIC.red, 'left', 'middle');
        top += 17;
    }
    top += 10;
    inventoryWindowButton('Прочитать', { x: detailX, y: top, w: detailW, h: 34 },
        () => readInventoryScroll(selectedInventoryIndex), blockedByStinginess(), true);
    top += 42;
    if (atMerchant || atExit) {
        const price = quoteInventorySale(entry);
        const buyerCost = inventoryBuyerCost(entry);
        const shortage = atMerchant && shopStock.cash < buyerCost;
        inventoryWindowButton(shortage ? 'Торговцу не хватает ' + (buyerCost - shopStock.cash) + ' зол.' : 'Продать за ' + price + ' зол.',
            { x: detailX, y: top, w: detailW, h: 34 }, () => sellInventoryScroll(selectedInventoryIndex), shortage);
        top += 42;
        if (entry.rogiSharePercent && !atExit) {
            drawText('Роги получит ' + entry.rogiSharePercent + '% от выручки, если свиток продадут.',
                detailX,top,'500 10px Inter, sans-serif',UIC.gold,'left','middle');
            top += 16;
        }
    }
    top = Math.max(top + 8, box.y + box.h - 20 - flavors.length * flavorLineH);
    flavors.forEach(line => {
        drawText(line, detailX, top + 8, flavorFont, UIC.dim, 'left', 'middle');
        top += flavorLineH;
    });
}

function drawInventoryWindow() {
    const narrow = VIEW_W < 650;
    if (narrow && scrollInventory.length === 1 && selectedInventoryIndex < 0) selectedInventoryIndex = 0;
    const box = { x: Math.max(12, (VIEW_W - 1040) / 2), y: UI.hudH + 12,
        w: Math.min(1040, VIEW_W - 24), h: Math.min(narrow ? 620 : 540, VIEW_H - UI.hudH - 28) };
    fillRound(box.x, box.y, box.w, box.h, 16, 'rgba(10,15,23,0.98)', 'rgba(217,158,58,0.5)');
    const pad = narrow ? 16 : 24;
    drawText('ИНВЕНТАРЬ', box.x + pad, box.y + 28, '800 16px Manrope, Inter, sans-serif', UIC.gold, 'left', 'middle');
    inventoryWindowButton('Закрыть', { x: box.x + box.w - 99, y: box.y + 12, w: 85, h: 32 }, closeInventory);
    const atMerchant = inventoryReturnState === STATES.SHOP;
    const atExit = atDungeonExit();
    const note = atMerchant ? 'Кошелёк торговца: ' + shopStock.cash + ' зол.'
        : atExit ? 'Выкуп на выходе: 50% стоимости'
            : 'Свитков с собой: ' + scrollInventory.length;
    drawText(note, box.x + pad, box.y + 57, '500 11px Inter, sans-serif', UIC.dim, 'left', 'middle');
    const entry = scrollInventory[selectedInventoryIndex];
    const scroll = entry && SCROLL_TYPES.find(item => item.id === entry.id);
    const contentY = box.y + 82;
    const contentH = box.h - 100;
    const gridW = narrow ? box.w - pad * 2 : Math.min(400, box.w * 0.43);
    const gridX = box.x + pad;

    drawInventoryGrid({ narrow, scroll, gridW, gridX, contentY, contentH });
    drawInventoryDetails({ narrow, box, pad, contentY, contentH, gridW, gridX, scroll, entry }, atMerchant, atExit);
}


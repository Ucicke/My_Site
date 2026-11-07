/* ================================================================
   SCROLL HUNTER · core/economy.js
   Золото, цены реликвий, дань арендодателя.
   ================================================================ */
'use strict';

const ECONOMY = {
    floors: 15,          // уровней в этапе (база; +1 за мета-улучшение)
    emptyBounty: 4,      // сколько платит пустой сундук (если есть «мелочь»)

    /* чем глубже — тем дороже реликвии */
    depthPrice: [1.0, 1.0, 1.05, 1.2, 1.3, 1.4, 1.55, 1.7, 1.85, 2.0, 2.1, 2.2, 2.3, 2.4, 2.5]
};

function scrollCountText(count) {
    const n = Math.abs(Math.trunc(Number(count) || 0));
    const lastTwo = n % 100;
    const last = n % 10;
    const form = lastTwo >= 11 && lastTwo <= 14 ? 'свитков'
        : last === 1 ? 'свиток' : last >= 2 && last <= 4 ? 'свитка' : 'свитков';
    return n + ' ' + form;
}

function depthMultiplier(depth) {
    const i = clamp(depth - 1, 0, ECONOMY.depthPrice.length - 1);
    return ECONOMY.depthPrice[i];
}

function relicPrice(scroll, depth) {
    if (!scroll) return 0;
    let p = scroll.price * depthMultiplier(depth);
    if (boosts.doubleAll) p *= 2;
    if (boosts.doubleNext) p *= 2;
    p *= metaGoldMultiplier();
    p *= boosts.goldBoost || 1;
    p *= giftFlags.goldBonus || 1;
    p *= giftFlags.incomePenalty || 1;
    return Math.round(p);
}

function randomRelic(rare) {
    let pool = SCROLL_TYPES.filter(s => !foundRelics.has(s.id) && !clearedWeak.has(s.id));
    if (rare) {
        const rich = pool.filter(s => s.price >= 40);
        if (rich.length) pool = rich;
    }
    if (pool.length === 0) {
        foundRelics = new Set();
        pool = SCROLL_TYPES.filter(s => !clearedWeak.has(s.id));
        if (pool.length === 0) pool = SCROLL_TYPES;
    }
    const sc = pool[randIntIn('loot', 0, pool.length - 1)];
    foundRelics.add(sc.id);
    return sc;
}

function sellRelic(scroll, price, showFeedback = true) {
    gold += price;
    stats.gold += price;
    stats.sold++;
    if(typeof RogiWorld!=='undefined'&&typeof STATES!=='undefined'&&(gameState===STATES.SHOP||(gameState===STATES.INVENTORY&&inventoryReturnState===STATES.SHOP)))
        RogiWorld.enqueue('sale',{sentimental:false},'sale-player:'+companion.dungeon+':'+currentNodeId);
    if (showFeedback) {
        addFloater(VIEW_W / 2, VIEW_H / 2, '+' + price + ' ЗОЛОТА', '#ffd76a', 30);
        Sfx.play('scroll');
    }
}

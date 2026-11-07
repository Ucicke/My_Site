/* ================================================================
   SCROLL HUNTER · core/ui-meta-screens.js
   Экраны меню, квартирмейстера и завершения кампании.
   ================================================================ */
'use strict';

function campaignEndButtons() {
    return [
        { text: 'В лавку квартирмейстера', cls: 'btn-primary', action: () => { gameState = STATES.QUARTERMASTER; updateUI(); } },
        { text: 'Новая кампания', cls: 'btn-ghost', action: () => startCampaign() },
        { text: 'В главное меню', cls: 'btn-ghost', action: () => { gameState = STATES.INTRO; updateUI(); } }
    ];
}

function renderMetaStateUI(stage, tribute) {
    switch (gameState) {
        case STATES.INTRO:
            ui.message.html =  '';

            createButtons([
                { text: 'Начать спуск', cls: 'btn-primary', action: () => beginCampaignFromMenu() },
                {
                    text: `Квартирмейстер · ${meta.dust} пыли`,
                    cls: 'btn-ghost',
                    highlight: META_UPGRADES.some(canBuy),
                    action: () => { gameState = STATES.QUARTERMASTER; updateUI(); }
                }
            ]);
            break;

        case STATES.PROLOGUE:
            ui.message.html = '';
            createButtons([]);
            primaryAction = null;
            break;

        case STATES.QUARTERMASTER: {
            const ups = META_UPGRADES.map(up => {
                const lvl = metaLevel(up.id);
                const maxed = lvl >= up.max;
                const cost = upgradeCost(up);
                return {
                    id: up.id, name: up.name, desc: up.desc,
                    detail: up.detail, lvl, max: up.max, maxed, cost,
                    definition: up,
                    can: canBuy(up)
                };
            });
            ui.message.html = `<b style="color:var(--gold)">КВАРТИРМЕЙСТЕР</b><br>
                <span class="muted">Постоянные улучшения между забегами. У вас <b>${meta.dust}</b> пыли.
                Лучшая добыча: ${record.best} зол. · Побед: ${record.wins} · Наибольшая глубина: неделя ${record.deepest}</span>`;

            /* Кнопки улучшений — на холсте */
            const shopBtns = ups.map(u => ({
                text: u.name + ' (' + u.lvl + '/' + u.max + ')',
                sub: u.maxed ? 'максимальный уровень' : u.can ? 'доступно для покупки' : 'не хватает ' + Math.max(0, u.cost - meta.dust) + ' пыли',
                cls: u.maxed ? 'btn-muted' : (u.can ? 'btn-gold' : 'btn-muted'),
                upgrade: true,
                id: u.id,
                name: u.name,
                desc: u.desc,
                detail: u.detail,
                level: u.lvl,
                max: u.max,
                cost: u.cost,
                can: u.can,
                maxed: u.maxed,
                disabled: u.maxed,
                action: () => {
                    const now = performance.now();
                    if (now < (quartermasterPurchaseGuards[u.id] || 0)) return;
                    if (!canBuy(u.definition)) {
                        showQuartermasterReaction(GameRng.next('ui') < 0.5
                            ? 'Сначала добудь ещё немного пыли.'
                            : 'Не хватает припасов для такой сделки.', 'shortage');
                        updateUI();
                        return;
                    }
                    const dustBefore = meta.dust;
                    if (!buyUpgrade(u.definition)) {
                        showQuartermasterReaction('Сначала добудь ещё немного пыли.', 'shortage');
                        updateUI();
                        return;
                    }
                    quartermasterPurchaseGuards[u.id] = now + 320;
                    quartermasterLastPurchase = { id: u.id, at: now };
                    quartermasterDustTransition = prefersReducedMotion() ? null : {
                        from: dustBefore, to: meta.dust, at: now
                    };
                    const reactions = [
                        'Хороший выбор!',
                        'Пригодится в следующем походе.',
                        'Вот теперь шансов побольше.'
                    ];
                    showQuartermasterReaction(reactions[GameRng.int('ui', 0, reactions.length - 1)], 'success');
                    Sfx.play('scroll');
                    updateUI();
                }
            }));
            shopBtns.push({
                text: 'Назад', cls: 'btn-ghost',
                action: () => { gameState = STATES.INTRO; updateUI(); }
            });
            createButtons(shopBtns);
            primaryAction = null;
            break;
        }

        case STATES.GAME_OVER: {
            const r = lastResult;
            const epi = typeof epilogue === 'function' ? epilogue(false) : '';
            ui.message.html =  `<b style="color:var(--danger)">${r.reason}</b><br>
                <span class="muted">Неделя ${r.week} · уровень ${r.floors} ·
                золота ${r.gold} · укусов ${r.bites}</span><br>
                <span class="muted">Получено ${r.dust} пыли для постоянных улучшений.</span>`
                + (epi ? `<br><br><span style="font-style:italic;color:#c7b6ff">${epi}</span>` : '');

            createButtons(campaignEndButtons());
            break;
        }

        case STATES.VICTORY: {
            const r = lastResult;
            const epi = typeof epilogue === 'function' ? epilogue(true) : '';
            ui.message.html =  `<b style="color:var(--success)">${r.reason}</b><br>
                <span class="muted">Золота в кошеле: ${r.gold} · неделя ${r.week} · этажей пройдено: ${r.floors} ·
                реликвий продано: ${r.sold} · использовано: ${r.used} · пыли: ${r.dust}</span>`
                + (epi ? `<br><br><span style="font-style:italic;color:#c7b6ff">${epi}</span>` : '');

            createButtons(campaignEndButtons());
            break;
        }

    }
}

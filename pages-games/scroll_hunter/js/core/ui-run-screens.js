/* ================================================================
   SCROLL HUNTER · core/ui-run-screens.js
   Экраны и действия активного подземельного забега.
   ================================================================ */
'use strict';

function renderRunStateUI(stage, tribute) {
    switch (gameState) {
        case STATES.STEP: {
            const actions = [];

            if (attemptOver) {
                const exitHeading = week === 1
                    ? 'Первая пятница. Подведите итог двух расписок.'
                    : `Неделя ${week} окончена. Вы вышли из подземелья.`;
                let exitMessage = `<b style="color:var(--gold)">${exitHeading}</b><br><span class="muted">${lastEvent || ''}</span><br>
                    <span class="muted">В кошеле ${gold} зол. Долг — ${tribute}. Свитки на выходе: ${exitScrollValue()} зол. за ${scrollInventory.length} шт. (50%).</span>`;
                if (companion.active) {
                    exitMessage += `<br><b>Роги: ${companion.gold} зол. · её долг ${companion.debt} · не хватает ${Math.max(0, companion.debt - companion.gold)}.</b>`;
                    if (week === 1) exitMessage += '<br><span class="muted">Помощь ей уменьшит запас на вашу выплату.</span>';
                    const helpAmount = Math.min(gold, Math.max(0, companion.debt - companion.gold));
                    const transferImpact = FirstFridayStory.transferImpact({
                        playerGold:gold, amount:helpAmount, due:tribute, exitScrollValue:exitScrollValue()
                    });
                    actions.push({ text: 'Помочь Роги', sub: transferImpact.threatensInstallment
                            ? `До ${helpAmount} зол. · не хватит ${transferImpact.shortfall} на вашу выплату`
                            : `Передать до ${helpAmount} зол. перед расчётом`, cls: 'btn-ghost',
                        action: () => { companionModal = { type: 'transfer', amount: Math.min(gold, Math.max(1, companion.debt - companion.gold)) }; updateUI(); } });
                }
                ui.message.html = exitMessage;

                actions.push({
                    text: gold >= tribute ? 'Отдать долг' : 'Признать провал',
                    sub: gold >= tribute ? `${tribute} зол. · останется ${gold - tribute}` : `Не хватает ${tribute - gold} зол. Сначала продайте свитки, иначе — долговая яма.`,
                    cls: 'btn-primary',
                    action: () => payTribute()
                });
                if (scrollInventory.length) actions.unshift({
                    text: `Продать всё: +${exitScrollValue()}`,
                    sub: 'Выкуп на выходе за половину стоимости. Или выберите отдельные свитки в сумке.',
                    cls: 'btn-gold', action: sellExitInventory
                });
            } else {
                const head = 'Выберите путь на карте.';
                const ev = lastEvent ? `<br><span class="muted">${lastEvent}</span>` : '';
                const letter = letterText
                    ? `<br><span class="muted" style="font-style:italic">${letterText}</span>` : '';
                ui.message.html =  head + ev + letter;
            }

            createButtons(actions);
            break;
        }

        case STATES.CHOOSE: {
            const c = selected >= 0 ? chests[selected] : null;
            const isBoss = currentNode && currentNode.type === 'BOSS';
            let html;
            if (isBoss) {
                html = `<b style="color:var(--danger)">👑 ${stage.boss}</b> <span class="muted">· ${boss.hp} ХП</span>`
                    + `<br><b class="bad-text">${stage.bossRuleDesc}</b>`
                    + `<br><span class="muted">Реликвия — удар по боссу, мимик — укус. После каждого вскрытия ряд перемешивается заново.</span>`;
            } else {
                html = 'Выберите сундук.';
                if (c) {
                    html += `<br><span class="muted">Сундук №${selected + 1}`
                        + (c.destroyed ? ' — уничтожен' : c.opened ? ' — уже вскрыт' : '') + '</span>';
                }
                /* что случилось в прошлом сундуке — чтобы контекст не терялся */
                const left = chests.filter(x => !x.opened).length;
                if (lastEvent && !rogiMsg) {
                    html += `<br><span class="muted">${lastEvent}</span>`;
                }
                if (left > 0) {
                    html += `<br><span class="muted">Осталось невскрытых: ${left}. `
                        + (chests.some(chest => chest.opened && !chest.destroyed)
                            ? 'Можно вскрыть все или уйти с добычей.</span>'
                            : 'Чтобы уйти, откройте хотя бы один сундук.</span>');
                }
            }
            if (rogiMsg) {
                html = `<b style="color:#c7b6ff">${rogiMsg}</b><br><span class="muted">${html}</span>`;
                rogiMsg = '';
            }
            ui.message.html =  html;

            const buttons = [];
            if (c && !c.opened) {
                buttons.push({ text: 'Открыть!', cls: 'btn-danger', action: requestOpen });
                buttons.push({
                    text: 'Уничтожить', cls: 'btn-danger',
                    sub: canDestroyChest(selected) ? 'мимик +10 / свиток −10' : 'последний сундук нужно открыть',
                    disabled: !canDestroyChest(selected), action: requestDestroy
                });
            }
            /* Выход открывается после первого вскрытия.
               Из логова предводителя уйти нельзя. */
            const opened = chests.filter(x => x.opened && !x.destroyed).length;
            if (!isBoss) {
                buttons.push({
                    text: 'Уйти из комнаты',
                    sub: opened > 0 ? 'забрать добычу и идти дальше' : 'сначала откройте хотя бы один сундук',
                    cls: 'btn-ghost',
                    disabled: opened === 0,
                    action: leaveRoom
                });
            }
            createButtons(buttons);
            break;
        }

        case STATES.HEIST_CRISIS: {
            const crisis = HeistLoop.state().crisis;
            const hasExit = chests.some(item => item.opened && !item.destroyed);
            const ai = companion.active ? RogiAI.ensure(companion) : null;
            ui.message.html = '<b style="color:#f39a99">Нас услышали.</b> Выберите, как уйти из комнаты с уже добытым.';
            createButtons([
                { text:'Затаиться', sub:'−2 личного фокуса', disabled:HeistLoop.focus() < HEIST_LOOP_RULES.hideCost,
                    action:() => HeistLoop.resolve('hide') },
                { text:scrollInventory.length ? 'Отдать свиток' : 'Нет свитка для отвлечения',
                    sub:scrollInventory.length ? 'самый дешёвый · выбраться' : 'добычи в сумке нет', disabled:!scrollInventory.length,
                    action:() => HeistLoop.resolve('scroll') },
                { text:'Подкупить', sub:`−${HEIST_LOOP_RULES.bribeGold} золота`, disabled:gold < HEIST_LOOP_RULES.bribeGold,
                    action:() => HeistLoop.resolve('gold') },
                { text:crisis?.rogiTried ? 'Роги уже ответила' : 'Попросить Роги',
                    sub:!companion.active ? 'вы одни' : crisis?.rogiTried ? 'попробуйте сами' : 'её решение · −1 фокус Роги',
                    disabled:!companion.active || !ai || ai.focus < 1 || companion.hp <= 0 || !!crisis?.rogiTried,
                    action:() => HeistLoop.resolve('rogi') },
                { text:'Бежать', sub:'−1 ♥ · покинуть комнату', disabled:!hasExit,
                    action:() => HeistLoop.resolve('flee') }
            ]);
            break;
        }

        case STATES.OPENING:
            ui.message.html =  '<span class="muted">Крышка отходит…</span>';

            createButtons([]);
            break;

        case STATES.REACTION:
            ui.message.html =  '<span class="muted">…</span>';

            createButtons([]);
            break;

        case STATES.INVENTORY: {
            inventoryPage = clamp(inventoryPage, 0, Math.max(0, Math.ceil(scrollInventory.length / 8) - 1));
            if (!scrollInventory[selectedInventoryIndex]) selectedInventoryIndex = -1;
            ui.message.html = 'Инвентарь: ' + scrollCountText(scrollInventory.length);
            createButtons([]);
            break;
        }

        case STATES.TREASURE_CHOICE: {
            ui.message.html =  `<b style="color:var(--gold)">💎 СОКРОВИЩНИЦА</b> <span class="muted">Ларец тяжёлый. Рядом следы когтей.</span>`;

            createButtons([
                {
                    text: 'Забрать осторожно',
                    sub: `+${treasureBase} зол., без риска`,
                    cls: 'btn-primary',
                    action: () => takeTreasure(false)
                },
                {
                    text: 'Рискнуть и выломать дно',
                    sub: `×2.5 золота, но 30% — мимик`,
                    cls: 'btn-danger',
                    action: () => takeTreasure(true)
                }
            ]);
            break;
        }

        case STATES.CAMP: {
            const isFinal = currentNode && currentNode.type === 'CAMP_FINALE';
            ui.message.html = lastEvent ? `<b style="color:var(--gold)">${lastEvent}</b>` : '';

            const buttons = [];
            if(companion.active)buttons.push({text:'Поговорить с Роги',sub:'Спокойный разговор у костра',cls:'btn-ghost',action:()=>{
                RogiAI.openDialogue(companion);RogiAI.act(companion,'personal-bond','Что держит тебя на этой дороге?');updateUI();
            }});
            const campRested = HeistLoop.hasRestedAtCamp(currentNodeId);
            const needsRest = hp < maxHp || companion.active && companion.hp < companion.maxHp || HeistLoop.focus() < HEIST_LOOP_RULES.maxFocus;
            buttons.push({
                text: campRested ? 'Костёр использован' : 'Отдохнуть',
                sub: campRested ? 'У этого костра вы уже отдыхали' : hp < maxHp || companion.active && companion.hp < companion.maxHp
                    ? '+1 ♥ · Роги отдохнёт' : HeistLoop.focus() < HEIST_LOOP_RULES.maxFocus ? '+1 личный фокус' : 'Здоровье восстановлено',
                cls: 'btn-success',
                action: campRest,
                disabled: campRested || !needsRest
            });
            buttons.push({
                text: 'Выковать',
                sub: 'след. реликвия +50% цены',
                cls: 'btn-gold',
                action: campForge
            });
            buttons.push({
                text: 'Очистить',
                sub: 'снять проклятие',
                cls: 'btn-primary',
                action: campPurify
            });
            buttons.push({ text: 'Идти дальше', cls: 'btn-ghost', action: leaveNode });
            createButtons(buttons);
            break;
        }

        case STATES.SHOP: {
            if (!shopStock) shopStock = makeShopStock();
            ui.message.html = lastEvent ? `<b style="color:var(--gold)">${lastEvent}</b>` : '';

            const buttons = [];
            buttons.push({
                text: shopStock.techniqueSold ? 'Приём куплен' : shopStock.technique.name,
                icon: ICONS.sword,
                sub: shopStock.techniqueSold ? '' : shopStock.technique.desc + ' · ' + shopStock.technique.price + ' зол.' + (gold < shopStock.technique.price ? ' · Не хватает золота' : ''),
                cls: 'btn-path',
                action: shopBuyTechnique,
                disabled: shopStock.techniqueSold || gold < shopStock.technique.price
            });
            buttons.push({
                text: shopStock.elixirSold ? 'Эликсир выпит' : shopStock.elixir.name,
                icon: ICONS.coin,
                sub: shopStock.elixirSold ? '' : shopStock.elixir.desc + ' · ' + shopStock.elixir.price + ' зол.' + (gold < shopStock.elixir.price ? ' · Не хватает золота' : ''),
                cls: 'btn-path',
                action: shopBuyElixir,
                disabled: shopStock.elixirSold || gold < shopStock.elixir.price
            });
            buttons.push({
                text: shopStock.relicSold ? 'Реликвия куплена' : 'Реликвия',
                icon: ICONS.TREASURE,
                sub: shopStock.relicSold ? '' : shopStock.relic.name + ' · 45 зол.' + (gold < 45 ? ' · Не хватает золота' : ''),
                cls: 'btn-gold',
                action: shopBuyRelic,
                disabled: shopStock.relicSold || gold < 45
            });
            buttons.push({
                text: shopStock.cleaned ? 'Колода вычищена' : 'Очистить колоду (60 зол.)',
                sub: shopStock.cleaned ? '' : 'убрать 3 слабых свитка навсегда' + (gold < 60 ? ' · Не хватает золота' : ''),
                cls: 'btn-primary',
                action: shopCleanDeck,
                disabled: shopStock.cleaned || gold < 60
            });
            buttons.push({ text: 'Уйти', cls: 'btn-ghost', action: leaveNode });
            createButtons(buttons);
            break;
        }

        case STATES.EVENT: {
            if (!currentEvent) currentEvent = drawDungeonEvent() || EVENTS[0] || null;
            const ev = currentEvent;
            ui.message.html = ev.storyEvent
                ? `<b style="color:var(--gold)">${ev.title}</b><br>
                    <span class="muted">${ev.sceneText || ev.text}</span>${ev.rogiView ? `<br><span style="color:#d9c4e8">${ev.rogiView}</span>` : ''}`
                : `<b style="color:var(--gold)">${ev.title}</b><br>
                    <span class="muted">${ev.text}</span>`;

            createButtons(ev.choices.map((ch, i) => ({
                text: ch.text,
                sub: ch.hint || (ch.cost && gold < ch.cost ? 'Не хватает золота' :
                    ch.healthCost && hp <= ch.healthCost ? 'Недостаточно здоровья' :
                    ch.relicForced && !scrollInventory.length ? 'Нет свитков в сумке' : ''),
                cls: 'btn-path',
                subWrap:ev.storyEvent === true,
                disabled: ch.disabled || (ch.cost && gold < ch.cost) || (ch.healthCost && hp <= ch.healthCost) || (ch.relicForced && !scrollInventory.length),
                action: () => chooseEvent(i)
            })));
            break;
        }

        case STATES.BOSS_GIFT: {
            const g = currentGift;
            ui.message.html =  `<b style="color:var(--gold)">👑 ${stage.boss} повержен</b><br>
                ${g ? `<span class="muted">Он оставляет вам дар:</span><br>
                <b style="color:var(--success)">${g.icon} ${g.name}</b> — ${g.boon}<br>
                <b style="color:var(--danger)">Но взамен: ${g.cost}</b>` : '<span class="muted">Он оставляет вам пустой сундук.</span>'}`;

            createButtons([
                { text: g ? 'Принять дар' : 'Забрать добычу', cls: 'btn-primary', action: acceptGift },
                { text: 'Отказаться', cls: 'btn-ghost', action: () => { currentGift = null; stageIndex = Math.min(STAGES.length - 1, stageIndex + 1); lastEvent = 'Вы отказались от дара. Пора рассчитаться с арендодателем.'; attemptOver = true; gameState = STATES.STEP; updateUI(); } }
            ]);
            break;
        }


    }
}

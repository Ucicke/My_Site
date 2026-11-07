/* ================================================================
   SCROLL HUNTER · core/rogi-ai-debug.js
   Локальная панель диагностики процедурной личности Роги.
   ================================================================ */
'use strict';

function debugEnabled() { return !!globalThis.ROGI_AI_DEV || ['localhost', '127.0.0.1', '::1'].includes(location.hostname); }
function installRogiAIDebug() {
        if (!debugEnabled() || document.getElementById('rogi-ai-debug')) return;
        const style = document.createElement('style');
        style.textContent = '#rogi-ai-debug{position:fixed;z-index:99999;right:12px;top:12px;width:min(520px,calc(100vw - 24px));max-height:85vh;overflow:auto;background:#10141df2;color:#e7dcc5;border:1px solid #b58a45;border-radius:10px;padding:14px;font:12px/1.4 monospace;box-shadow:0 12px 40px #000b}#rogi-ai-debug[hidden]{display:none}#rogi-ai-debug pre{white-space:pre-wrap;word-break:break-word}#rogi-ai-debug button{background:#352a1c;color:#f1cc84;border:1px solid #96713f;padding:6px 9px;margin:3px;cursor:pointer}';
        document.head.appendChild(style);
        const box = document.createElement('aside'); box.id = 'rogi-ai-debug'; box.hidden = true;
        box.innerHTML = '<b>ROGI AI · DEV</b> <button data-debug="close">Закрыть</button><button data-debug="reroll">Новый профиль</button><button data-debug="stress">Стресс +20</button><button data-debug="trust">Доверие +20</button><button data-debug="need">Тревога +20</button><button data-debug="focus">Фокус 5</button><button data-debug="simulate">Сценарии 1000</button><button data-debug="dialogue">Проверить реплику</button><div>Сравнить профили: <input data-debug-seed="a" value="rogi-a" aria-label="Первый seed"><input data-debug-seed="b" value="rogi-b" aria-label="Второй seed"><select data-debug-scenario aria-label="Ситуация"></select><button data-debug="compare">Сравнить</button></div><pre></pre>';
        const scenarioSelect = box.querySelector('[data-debug-scenario]');
        for (const scenarioId of Object.keys(RogiAI.SIMULATION_SCENARIOS)) {
            const option = document.createElement('option'); option.value = scenarioId; option.textContent = scenarioId; scenarioSelect.appendChild(option);
        }
        document.body.appendChild(box);
        const render = () => {
            const ai = RogiAI.ensure(companion); if (!ai) return;
            box.querySelector('pre').textContent = JSON.stringify({ seed: ai.seed, profile: ai.profile, dimensions: ai.dimensions, development: ai.development, needs: ai.needs, stress: ai.stress, mood: ai.mood, behaviorState: ai.behaviorState, focus: ai.focus + '/' + ai.focusMax, bondState: ai.bondState, memories: ai.memory, timeline: ai.timeline.slice(-30), candidates: ai.decisionLog, decisionJournal: ai.decisionJournal, conversation: ai.conversation, promises: ai.promises, drama: ai.drama, simulation: box.dataset.simulation || null, comparison: box.dataset.comparison || null }, null, 2);
        };
        box.addEventListener('click', event => {
            const action = event.target.dataset.debug;
            if (action === 'close') box.hidden = true;
            if (action === 'reroll') { companion.ai = RogiAI.create(RogiAI.campaignSeed()); render(); saveRunCheckpoint(); }
            if (action === 'stress') { companion.ai.stress = Math.min(100, companion.ai.stress + 20); RogiAI.event(companion, 'debug-stress'); render(); }
            if (action === 'focus') { companion.ai.focus = RogiAI.MAX_FOCUS; render(); }
            if (action === 'trust') { bumpTrust(20); render(); }
            if (action === 'need') { companion.ai.needs.safety = Math.min(100, companion.ai.needs.safety + 20); render(); }
            if (action === 'simulate') { box.dataset.simulation = JSON.stringify(RogiAI.simulateScenarios(1000)); render(); }
            if (action === 'compare') {
                const first = box.querySelector('[data-debug-seed="a"]').value || 'rogi-a';
                const second = box.querySelector('[data-debug-seed="b"]').value || 'rogi-b';
                box.dataset.comparison = JSON.stringify(RogiAI.compareProfiles(first, second, scenarioSelect.value)); render();
            }
            if (action === 'dialogue') { companion.dialogueLine = RogiAI.dialogue(companion, 'ask-fear'); render(); }
        });
        window.addEventListener('keydown', event => {
            if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'd') { box.hidden = !box.hidden; render(); event.preventDefault(); }
        });
        window.addEventListener('pointerdown', () => { if (!box.hidden) render(); }, { passive: true });
    }
if (typeof document !== "undefined" && debugEnabled()) installRogiAIDebug();

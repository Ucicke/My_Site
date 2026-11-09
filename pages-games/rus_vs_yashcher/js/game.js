"use strict";
(() => {
    'use strict';
    const canvas = document.createElement('canvas'), context = canvas.getContext('2d');
    if (!context)
        throw new Error('A 2D canvas context is unavailable');
    const ctx = context, W = 900, H = 540;
    // The scene is vector-generated; render it at 2x internal resolution to avoid
    // blurring from the scene -> HUD compositing pass.
    const SCENE_SCALE = 2;
    canvas.width = W * SCENE_SCALE;
    canvas.height = H * SCENE_SCALE;
    ctx.setTransform(SCENE_SCALE, 0, 0, SCENE_SCALE, 0, 0);
    const sceneBackgroundCanvas = document.createElement('canvas'), sceneBackgroundContext = (() => { const value = sceneBackgroundCanvas.getContext('2d'); if (!value)
        throw new Error('A background canvas context is unavailable'); return value; })();
    sceneBackgroundCanvas.width = canvas.width / 3;
    sceneBackgroundCanvas.height = canvas.height;
    function fmt(v) { const n = Number(v); return Number.isFinite(n) ? Number(n.toFixed(2)).toLocaleString('ru-RU', { maximumFractionDigits: 2 }) : '0'; }
    const rand = (a, b) => a + Math.random() * (b - a), clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const FACE_INDICES = [0, 1, 2, 3, 4, 5];
    const SLOT_IDS = [0, 1, 2, 3, 4];
    function isFaceIndex(value) { return Number.isInteger(value) && value >= 0 && value < FACE_INDICES.length; }
    function isSlotId(value) { return Number.isInteger(value) && value >= 0 && value < SLOT_IDS.length; }
    function six(values) { if (values.length !== 6)
        throw new RangeError(`Expected six values, received ${values.length}`); const value = (index) => { const item = values[index]; if (item === undefined)
        throw new RangeError(`Missing face value ${index}`); return item; }; return [value(0), value(1), value(2), value(3), value(4), value(5)]; }
    function copySix(values) { return six(values); }
    function requiredAt(values, index) { const value = values[index]; if (value === undefined)
        throw new RangeError(`Index ${index} is outside the available items`); return value; }
    function readonlyView(value) { return new Proxy(value, { get(target, key, receiver) { const child = Reflect.get(target, key, receiver); return child !== null && typeof child === 'object' ? readonlyView(child) : child; }, set() { return false; }, deleteProperty() { return false; }, defineProperty() { return false; } }); }
    function mixColor(a, b, t) { t = clamp(t, 0, 1); const a0 = [1, 3, 5].map(x => parseInt(a.slice(x, x + 2), 16)), b0 = [1, 3, 5].map(x => parseInt(b.slice(x, x + 2), 16)); return '#' + a0.map((x, i) => Math.round(x + (requiredAt(b0, i) - x) * t).toString(16).padStart(2, '0')).join(''); }
    const DURATION = 300, MAX_GATE = 112, STORE_KEY = 'zastava_d6_meta_v9'; // Keep the existing save key for returning players.
    const BOW_TIMING = window.__archerRig?.timing ?? { idleFrame: .1, drawFrame: .025, drawHold: .15, releaseFrames: [.016, .032, .05, .05, .05], recoverFrame: .06 };
    const RELEASE_DURATION = BOW_TIMING.releaseFrames.reduce((sum, duration) => sum + duration, 0), RECOVER_DURATION = 9 * BOW_TIMING.recoverFrame;
    const FACE_ATTACKS = [
        { name: 'Грань 1', label: 'Одинарная', symbol: '→', mode: 'plain', burst: 1, pierce: 1, damage: .98, color: '#eecf9b' },
        { name: 'Грань 2', label: 'Пробивная', symbol: '⇢', mode: 'pierce', burst: 1, pierce: 3, damage: .92, color: '#9fe0c9' },
        { name: 'Грань 3', label: 'Залп ×3', symbol: '⋔', mode: 'spread', burst: 3, pierce: 1, damage: .56, color: '#efb58b' },
        { name: 'Грань 4', label: 'Проб. залп', symbol: '⫸', mode: 'spreadPierce', burst: 3, pierce: 3, damage: .43, color: '#d6c39d' },
        { name: 'Грань 5', label: 'Поле', symbol: '✦', mode: 'field', burst: 999, pierce: 1, damage: .26, color: '#e8d694' },
        { name: 'Грань 6', label: 'Поле пробой', symbol: '✸', mode: 'fieldPierce', burst: 999, pierce: 2, damage: .20, color: '#a7d8e6' }
    ];
    const CLASS_ORDER = ['short', 'medium', 'heavy'];
    const CLASSES = {
        short: { name: 'Скорострел', short: 'СКОРОСТРЕЛ', color: '#83b86a', period: 1.55, damage: .88, speed: 920, faces: [6, 6, 5, 4, 3, 2], bow: 24, shotDelay: .044, boostDamage: .17, hp: 32, passive: 'Каждый 4-й выстрел — дополнительная стрела' },
        medium: { name: 'Дружинник', short: 'ДРУЖИННИК', color: '#cf9351', period: 3.1, damage: 1.42, speed: 760, faces: [4, 4, 3, 3, 2, 1], bow: 44, shotDelay: .085, boostDamage: .28, hp: 53, passive: 'Первый удар по цели сильнее на 35%' },
        heavy: { name: 'Тяжёлый стрелец', short: 'ТЯЖЕЛЫЙ', color: '#b86f58', period: 6.35, damage: 3.7, speed: 610, faces: [2, 2, 1, 1, 1, 1], bow: 108, shotDelay: .13, boostDamage: .56, hp: 87, passive: 'Все стрелы пробивают, попадание оглушает' }
    };
    const SLOTS = [{ x: 110, price: 92, mult: 1 }, { x: 280, price: 58, mult: 1 }, { x: 450, price: 0, mult: 1 }, { x: 620, price: 66, mult: 1 }, { x: 790, price: 104, mult: 1 }];
    function randomizeSlots() { for (const i of SLOT_IDS) {
        if (i === 2) {
            SLOTS[i].mult = 1;
            SLOTS[i].price = 0;
            continue;
        }
        const m = Math.round((.92 + Math.random() * .23) * 100) / 100;
        SLOTS[i].mult = m;
        const normalized = (m - .92) / .23;
        const base = 62 + normalized * 72;
        const traderDiscount = Math.min(.25, metaLevel('trader') * .06), hoardDiscount = Math.min(.16, metaLevel('hoard') * .04);
        SLOTS[i].price = Math.max(36, Math.round(base * (1 - traderDiscount) * (1 - hoardDiscount)));
    } }
    const ARCHER_NAMES = ['Бажен', 'Белогор', 'Борислав', 'Боян', 'Братислав', 'Бронислав', 'Вадим', 'Велимир', 'Вечеслав', 'Витольд', 'Владлен', 'Владимир', 'Владислав', 'Всеволод', 'Всемил', 'Вячеслав', 'Горислав', 'Данислав', 'Добромир', 'Добрыня', 'Драгомир', 'Ждан', 'Изяслав', 'Ладислав', 'Любомир', 'Милан', 'Милорад', 'Мирослав', 'Мстислав', 'Огнеслав', 'Пересвет', 'Радим', 'Радислав', 'Радомир', 'Ратибор', 'Ростислав', 'Святозар', 'Святополк', 'Святослав', 'Станислав', 'Судислав', 'Твердислав', 'Тихомир', 'Чеслав', 'Яромир', 'Ярослав'];
    const ENEMIES = {
        normal: { name: 'Ящер-коготь', icon: '♟', color: '#9ecf7a', hp: 4.2, speed: 31, xp: 4, gold: 7 },
        swift: { name: 'Юркий ящер', icon: '➤', color: '#92e099', hp: 2.7, speed: 52, xp: 5, gold: 9 },
        shield: { name: 'Щитоящер', icon: '⬟', color: '#7db38b', hp: 8.5, speed: 23, xp: 9, gold: 13, resist: .57 },
        heavy: { name: 'Ящер-копейщик', icon: '◆', color: '#6ca56b', hp: 11, speed: 22, xp: 12, gold: 18 },
        brute: { name: 'Чешуйчатый громила', icon: '⬢', color: '#5c945b', hp: 22, speed: 16, xp: 20, gold: 30 },
        shaman: { name: 'Болотный шаман', icon: '✧', color: '#b6e17b', hp: 9, speed: 9, xp: 20, gold: 31, ranged: true },
        healer: { name: 'Ящер-знахарь', icon: '✥', color: '#badf87', hp: 8, speed: 8, xp: 21, gold: 34, ranged: true }
    };
    const ENEMY_KINDS = ['normal', 'swift', 'shield', 'heavy', 'brute', 'shaman', 'healer'];
    const PAUSE_LINES = [
        'Друже, Байкальская водица стынет, пока ты тут прохлаждаешься!',
        'Род замер в ожидании. Ящеры сами себя на стрелы не насадят!',
        'Русь матушка в опасности, а ты очи зажмурил?',
        'Предки смотрят на эту паузу с глубоким славянским разочарованием.',
        'Пока ты отдыхаешь, рептилоиды крутят свои махинации!',
        'Зелёные гады уже празднуют победу. Не дай им повода!',
        'Внимание: уровень авторитета среди русов стремительно падает.',
        'Зажимы яйцами приостановлены. Ящеры недоумевают.',
        'Хватит думу думать, пора иродов крушить!',
        'Собери волю в кулак, отхлебни кваса и жми «Продолжить»!',
        'Перун даровал тебе эту передышку, но время на исходе.',
        'Скинь оковы лени, подними верный топор!'
    ];
    const RUS_LINES = ['За Русь!', 'А ящер-то без сапог!', 'Стрела лети, казну береги!', 'Ох и квас будет после боя!', 'На рожон, зелёный!', 'Деревянный лук — железный характер!', 'Ставлю бочку кваса на победу!'];
    const LIZARD_LINES = ['Ш-ш-ш!', 'Верните наше болото!', 'Мерзкие теплокровные!', 'Чешуя крепче вашей бересты!', 'Квас не вкус-с-сный!', 'Зелёный совет недоволен!'];
    const RELICS = [
        { id: 'perun', name: 'Искра Перуна', icon: '⚡', desc: '+28% урона стрел', color: '#f4d287' },
        { id: 'kvass', name: 'Боевой квас', icon: '♨', desc: '+30 здоровья и лечение', color: '#b5deae' },
        { id: 'boots', name: 'Лапти-скороходы', icon: '⌁', desc: 'Броски на 18% чаще', color: '#9ec9f0' },
        { id: 'amulet', name: 'Оберег рода', icon: '◇', desc: '−30% входящего урона', color: '#d6b8e5' },
        { id: 'quiver', name: 'Колчан судьбы', icon: '➶', desc: '+2 ко всем граням', color: '#ebbd8b' }
    ];
    function isRecord(value) { return typeof value === 'object' && value !== null && !Array.isArray(value); }
    const EMPTY_STORED_META = { runes: undefined, night: undefined, nodes: undefined, bonus: undefined, workshop: undefined };
    function parseMetaValue(raw) {
        if (raw === null)
            return EMPTY_STORED_META;
        try {
            const parsed = JSON.parse(raw);
            if (!isRecord(parsed))
                return EMPTY_STORED_META;
            return { runes: parsed['runes'], night: parsed['night'], nodes: parsed['nodes'], bonus: parsed['bonus'], workshop: parsed['workshop'] };
        }
        catch (error) {
            if (error instanceof SyntaxError)
                return EMPTY_STORED_META;
            throw error;
        }
    }
    function readStoredValue(key) {
        try {
            return localStorage.getItem(key);
        }
        catch (error) {
            if (error instanceof DOMException && error.name === 'SecurityError')
                return null;
            throw error;
        }
    }
    function storedBonus(value) {
        if (!isRecord(value))
            return { short: undefined, medium: undefined, heavy: undefined };
        return { short: value['short'], medium: value['medium'], heavy: value['heavy'] };
    }
    function storedWorkshop(value) {
        if (!isRecord(value))
            return { gate: undefined, gold: undefined, health: undefined, luck: undefined };
        return { gate: value['gate'], gold: value['gold'], health: value['health'], luck: value['luck'] };
    }
    function savedNumber(value, fallback, min, max) {
        return typeof value === 'number' && Number.isFinite(value) ? clamp(Math.floor(value), min, max) : fallback;
    }
    const META_NODE_IDS = { root: true, short: true, medium: true, heavy: true, gate: true, gold: true, health: true, luck: true, shortSpeed: true, mediumSpeed: true, heavyPower: true, gateRegen: true, palisade: true, treasury: true, bounty: true, healing: true, armor: true, relicFortune: true, runeBonus: true, fate: true, keen: true, tempo: true, crush: true, rampart: true, fortified: true, trader: true, loot: true, rest: true, guard: true, fortune2: true, study: true, training: true, arsenal: true, watch: true, mentor: true, hoard: true, runeskin: true, ditch: true };
    function isMetaNodeId(key) { return Object.hasOwn(META_NODE_IDS, key); }
    function readMeta() {
        const current = parseMetaValue(readStoredValue(STORE_KEY)), legacy = parseMetaValue(readStoredValue('zastava_d6_meta_v7'));
        const previous = current.runes == null ? legacy : current;
        const currentNodes = isRecord(current.nodes) ? current.nodes : {};
        const previousBonus = storedBonus(previous.bonus);
        const workshop = storedWorkshop(current.workshop);
        const nodes = {};
        for (const [key, value] of Object.entries(currentNodes))
            if (isMetaNodeId(key) && typeof value === 'number' && Number.isFinite(value))
                nodes[key] = Math.max(0, Math.floor(value));
        return {
            nodes, runes: savedNumber(previous.runes, 0, 0, Number.MAX_SAFE_INTEGER), night: savedNumber(current.night, 1, 1, Number.MAX_SAFE_INTEGER),
            bonus: { short: savedNumber(previousBonus.short, 0, 0, 20), medium: savedNumber(previousBonus.medium, 0, 0, 20), heavy: savedNumber(previousBonus.heavy, 0, 0, 20) },
            workshop: { gate: savedNumber(workshop.gate, 0, 0, 5), gold: savedNumber(workshop.gold, 0, 0, 5), health: savedNumber(workshop.health, 0, 0, 5), luck: savedNumber(workshop.luck, 0, 0, 5) }
        };
    }
    let meta = readMeta();
    function saveMeta() { try {
        localStorage.setItem(STORE_KEY, JSON.stringify(meta));
        return true;
    }
    catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        console.warn(`Unable to save game progress: ${detail}`);
        return false;
    } }
    function isArcherClass(value) { return value === 'short' || value === 'medium' || value === 'heavy'; }
    function isWorkshopKey(value) { return value === 'gate' || value === 'gold' || value === 'health' || value === 'luck'; }
    // Keep existing meta bonuses compatible with saved progress.
    const META_NODES = [
        { id: 'root', title: 'Вечевой костёр', desc: 'Начало родовой мощи', x: 820, y: 120, pre: [], max: 1, cost: 0 },
        { id: 'short', title: 'Стрелы сокола', desc: 'Урон коротких луков +1', x: 290, y: 300, pre: ['root'], max: 5, cost: 8 },
        { id: 'medium', title: 'Зоркие очи', desc: 'Урон средних луков +1', x: 600, y: 300, pre: ['root'], max: 5, cost: 8 },
        { id: 'heavy', title: 'Мощь Пересвета', desc: 'Урон слонобоев +1', x: 920, y: 300, pre: ['root'], max: 5, cost: 9 },
        { id: 'gate', title: 'Бревенчатый завет', desc: 'Прочность ворот +14', x: 1220, y: 300, pre: ['root'], max: 5, cost: 8 },
        { id: 'gold', title: 'Княжья казна', desc: 'Начальное золото +15', x: 1460, y: 455, pre: ['root'], max: 5, cost: 8 },
        { id: 'health', title: 'Сила богатырей', desc: 'Здоровье лучников +7', x: 750, y: 520, pre: ['root'], max: 5, cost: 8 },
        { id: 'luck', title: 'Удача знахаря', desc: 'Шанс добычи реликвий +8%', x: 1160, y: 540, pre: ['root'], max: 5, cost: 9 },
        { id: 'shortSpeed', title: 'Соколий взмах', desc: 'Короткий лук: скорость +8%', x: 120, y: 510, pre: ['short'], max: 4, cost: 13 },
        { id: 'mediumSpeed', title: 'Ловкая тетива', desc: 'Средний лук: скорость +7%', x: 410, y: 530, pre: ['medium'], max: 4, cost: 12 },
        { id: 'heavyPower', title: 'Дубовый размах', desc: 'Слонобой: ещё +8% урона', x: 970, y: 505, pre: ['heavy'], max: 4, cost: 14 },
        { id: 'gateRegen', title: 'Плотники в засаде', desc: 'Восстановление ворот +0,07/с', x: 1340, y: 625, pre: ['gate'], max: 4, cost: 15 },
        { id: 'palisade', title: 'Вторая стена', desc: 'Ещё +15 здоровья ворот', x: 1460, y: 790, pre: ['gate'], max: 4, cost: 16 },
        { id: 'treasury', title: 'Тайный сундук', desc: 'Начальное золото +12', x: 1520, y: 970, pre: ['gold'], max: 4, cost: 14 },
        { id: 'bounty', title: 'Налог на хвосты', desc: 'Золото за убийства +5%', x: 1270, y: 945, pre: ['gold'], max: 4, cost: 14 },
        { id: 'healing', title: 'Живица рода', desc: 'Лучники лечатся +0,06 HP/с', x: 650, y: 770, pre: ['health'], max: 4, cost: 15 },
        { id: 'armor', title: 'Залатанный тулуп', desc: 'Лучники получают на 4% меньше урона', x: 810, y: 980, pre: ['health'], max: 4, cost: 15 },
        { id: 'relicFortune', title: 'Шаманский тайник', desc: 'Ещё +5% выпадения реликвий', x: 1090, y: 770, pre: ['luck'], max: 4, cost: 15 },
        { id: 'runeBonus', title: 'Рунический круг', desc: 'Рун за забег +10%', x: 990, y: 970, pre: ['luck'], max: 4, cost: 18 },
        { id: 'fate', title: 'Золотая судьба', desc: 'Вероятность редких карт выше', x: 180, y: 860, pre: ['luck'], max: 4, cost: 20 },
        { id: 'keen', title: 'Железные стрелы', desc: 'Урон каждого выстрела +4%', x: 200, y: 130, pre: ['shortSpeed'], max: 5, cost: 18 },
        { id: 'tempo', title: 'Тугая тетива', desc: 'Скорость бросков +3%', x: 320, y: 55, pre: ['mediumSpeed'], max: 5, cost: 18 },
        { id: 'crush', title: 'Удар Пересвета', desc: 'Слонобои: урон +5%', x: 900, y: 55, pre: ['heavyPower'], max: 5, cost: 19 },
        { id: 'rampart', title: 'Крепость дедов', desc: 'Прочность ворот +12', x: 1150, y: 135, pre: ['gateRegen'], max: 4, cost: 19 },
        { id: 'fortified', title: 'Еловый частокол', desc: 'Прочность ворот +10', x: 1250, y: 530, pre: ['palisade'], max: 4, cost: 19 },
        { id: 'trader', title: 'Купеческая смекалка', desc: 'Найм русов дешевле на 6%', x: 1200, y: 900, pre: ['treasury'], max: 4, cost: 18 },
        { id: 'loot', title: 'Хвост — в казну', desc: 'Золото за убийство +5%', x: 1050, y: 995, pre: ['bounty'], max: 4, cost: 18 },
        { id: 'rest', title: 'Живительная берёза', desc: 'Регенерация русов +0,05 ХП/с', x: 750, y: 1030, pre: ['healing'], max: 4, cost: 18 },
        { id: 'guard', title: 'Чешуйчатый тулуп', desc: 'Снижение урона русам +3%', x: 475, y: 1030, pre: ['armor'], max: 4, cost: 18 },
        { id: 'fortune2', title: 'Чудо-обереги', desc: 'Шанс реликвий +3%', x: 70, y: 915, pre: ['relicFortune'], max: 4, cost: 18 },
        { id: 'study', title: 'Книжная мудрость', desc: 'Личный опыт русов +6%', x: 65, y: 675, pre: ['fate'], max: 5, cost: 19 },
        { id: 'training', title: 'Княжья школа', desc: 'Цена обучения −6%', x: 70, y: 420, pre: ['short'], max: 4, cost: 18 },
        { id: 'arsenal', title: 'Кузня наконечников', desc: 'Весь урон отряда +4%', x: 540, y: 110, pre: ['medium'], max: 4, cost: 18 },
        { id: 'watch', title: 'Дозорные тропы', desc: 'Следующая волна приносит больше золота', x: 1210, y: 610, pre: ['gateRegen'], max: 4, cost: 17 },
        { id: 'mentor', title: 'Наставники заставы', desc: 'Опыт отряда +5%', x: 470, y: 1020, pre: ['study'], max: 4, cost: 20 },
        { id: 'hoard', title: 'Кладовая воеводы', desc: 'Пустые позиции дешевле на 4%', x: 1310, y: 980, pre: ['treasury'], max: 4, cost: 18 },
        { id: 'runeskin', title: 'Береста с рунами', desc: 'Шанс необычной карты +2%', x: 165, y: 120, pre: ['training'], max: 4, cost: 18 },
        { id: 'ditch', title: 'Глубокий ров', desc: 'Ящеры у ворот дополнительно замедляются на 8% за уровень', x: 1400, y: 420, pre: ['gate'], max: 4, cost: 18 }
    ];
    // Canvas meta layout: symmetric branching constellation of twenty nodes.
    const META_SYMMETRY = { root: [600, 470], short: [315, 365], medium: [480, 235], heavy: [720, 235], gate: [885, 365], gold: [905, 620], health: [600, 695], luck: [295, 620], shortSpeed: [125, 275], mediumSpeed: [390, 70], heavyPower: [810, 70], gateRegen: [1055, 260], palisade: [1125, 475], treasury: [1110, 755], bounty: [955, 860], healing: [680, 920], armor: [520, 920], relicFortune: [175, 795], runeBonus: [325, 900], fate: [95, 565], keen: [80, 150], tempo: [380, 40], crush: [820, 40], rampart: [1110, 150], fortified: [1260, 465], trader: [1125, 860], loot: [1000, 980], rest: [720, 1075], guard: [480, 1075], fortune2: [85, 865], study: [55, 730], training: [175, 110], arsenal: [555, 25], watch: [1265, 310], mentor: [315, 900], hoard: [1290, 900], runeskin: [210, 30], ditch: [1290, 210] };
    for (const n of META_NODES) {
        const p = META_SYMMETRY[n.id];
        if (p) {
            n.x = p[0];
            n.y = p[1];
        }
    }
    if (!meta.nodes)
        meta.nodes = {};
    for (const n of META_NODES) {
        if (n.id === 'root')
            meta.nodes.root = 1;
        else if (meta.nodes[n.id] == null) {
            const initial = isArcherClass(n.id) ? meta.bonus[n.id] : isWorkshopKey(n.id) ? meta.workshop[n.id] : 0;
            meta.nodes[n.id] = initial;
        }
    }
    function metaLevel(k) { return meta.nodes[k] || 0; }
    function metaPrice(k) { const n = META_NODES.find(x => x.id === k); return n ? Math.round(n.cost * (1 + .75 * metaLevel(k))) : 99999; }
    function canMeta(k) { const n = META_NODES.find(x => x.id === k); return !!n && metaLevel(k) < n.max && n.pre.every(x => metaLevel(x) > 0) && meta.runes >= metaPrice(k); }
    function buyMeta(key) { if (!isMetaNodeId(key) || !['idle', 'win', 'lose'].includes(state.phase.mode) || !canMeta(key))
        return; meta.runes -= metaPrice(key); const level = (meta.nodes[key] ?? 0) + 1; meta.nodes[key] = level; if (isArcherClass(key))
        meta.bonus[key] = level;
    else if (isWorkshopKey(key))
        meta.workshop[key] = level; saveMeta(); }
    function earnMeta(win, bonus = 0) { const base = Math.max(3, Math.floor(state.kills / 5) + Math.floor(state.elapsed / 30) + (win ? 13 : 0)), g = Math.round((base + bonus) * (1 + metaLevel('runeBonus') * .10)); meta.runes += g; if (win)
        meta.night++; saveMeta(); }
    function metaBonus(k) { return metaLevel(k); }
    function maxGate() { return MAX_GATE + meta.workshop.gate * 14 + metaBonus('palisade') * 15 + metaBonus('rampart') * 12 + metaBonus('fortified') * 10; }
    function newDie() { return { timer: 0, face: 0, value: 1, lastFace: -1, fired: 0, phase: 'rolling', startX: 0, startY: 0, endX: 0, endY: 0, finalX: 0, finalY: 0, cycleEnd: 4, initialized: false, manualFire: false, manualTargetId: null }; }
    function usedNames() { return new Set(state.archers.map(a => a.name)); }
    function pickName() { const used = usedNames(); const pool = ARCHER_NAMES.filter(n => !used.has(n)), candidates = pool.length ? pool : ARCHER_NAMES; return requiredAt(candidates, Math.floor(rand(0, candidates.length))); }
    function boostPrice(a) { return Math.ceil(Math.max(0, a.xpNeeded - a.xp) * (.75 + .16 * (a.level - 1)) * (1 - Math.min(.65, metaLevel('training') * .06))); }
    function randomAppearance(klass) { return { height: klass === 'heavy' ? rand(1.08, 1.22) : klass === 'short' ? rand(.76, .92) : rand(.94, 1.08), bodyW: rand(.9, 1.08), hood: Math.random() < .72 ? 1 : 0, scar: Math.random() < .34 ? 1 : 0, patch: Math.random() < .55 ? 1 : 0, trim: Math.floor(rand(0, 3)), bowTilt: rand(-4, 5), cap: Math.floor(rand(0, 3)), wear: rand(.18, .68), beard: Math.random() < .72 ? Math.floor(rand(0, 4)) : 0, beardLen: rand(.82, 1.28), moustache: Math.random() < .45 ? 1 : 0 }; }
    function randomLizardLook() { return { snout: rand(.9, 1.35), frill: Math.random() < .52 ? 1 : 0, horn: Math.floor(rand(0, 3)), tail: rand(.85, 1.2), hue: Math.floor(rand(0, 3)), jaw: rand(.85, 1.22) }; }
    let nextArcherId = 1;
    function newArcher(slot, klass = 'medium', name = pickName(), seedData = null) { const def = SLOTS[slot], c = CLASSES[klass], data = seedData; const hpMax = c.hp + meta.workshop.health * 7, speedBonus = klass === 'short' ? metaBonus('shortSpeed') * .08 : klass === 'medium' ? metaBonus('mediumSpeed') * .07 : 0; return { id: nextArcherId++, slot, x: def.x, y: klass === 'heavy' ? 457 : 486, slotPower: def.mult || 1, klass, name, faces: data ? copySix(data.faces) : copySix(c.faces), faceDamage: data ? copySix(data.faceDamage) : six(FACE_ATTACKS.map(f => f.damage)), damage: (data?.damage ?? (c.damage + meta.bonus[klass] + (klass === 'heavy' ? c.damage * metaBonus('heavyPower') * .08 : 0))), period: (data?.period ?? c.period), maxHp: hpMax, hp: hpMax, speed: (data?.speed ?? 1) * (1 + speedBonus), level: 1, xp: 0, xpNeeded: 14, shotFlash: 0, bowPull: 0, bowPhase: 'idle', bowPhaseTime: 0, die: newDie(), boosts: 0, shots: 0, damageDealt: 0, crit: 0, stun: 0, relics: [], appearance: data?.appearance ?? randomAppearance(klass), mods: modifierDefaults(), targetMode: 'gate', shotDelayMult: 1, hurryTimer: 0 }; }
    const state = { phase: { mode: 'idle', modal: { type: 'none' } }, elapsed: 0, lives: MAX_GATE, gateFlash: 0, enemies: [], arrows: [], fx: [], labels: [], nextId: 1, kills: 0, gold: 0, archers: [], level: 1, xp: 0, xpNeeded: 10, wave: 0, spawnQueue: [], spawnDelay: 0, nextWaveAt: 8, toastTime: 0, last: 0, night: 1, totalWaves: 12, waveStreams: [], relics: [], damageNumbers: [], barks: [], barkTimer: 9, spellShots: [], goldMult: 1, personalLevelCount: 0, controlMode: 'shooting', bonusRunes: 0 };
    let autoEquipRetryAt = 0, autoRecruitRetryAt = 0;
    let pauseMessage = 'Отхлебни кваса, переведи дух и продолжай дозор.';
    function setControlMode(mode) { if (state.controlMode === mode)
        return; state.controlMode = mode; autoEquipRetryAt = 0; autoRecruitRetryAt = 0; for (const a of state.archers) {
        if (mode === 'manual' && a.die.fired > 0)
            roll(a);
        a.die.manualFire = false;
        a.die.manualTargetId = null;
    } }
    function canManualVolley(slot) { return state.phase.mode === 'playing' && state.controlMode === 'manual' && state.archers.some(a => (slot === undefined || a.slot === slot) && a.die.initialized && !a.die.manualFire && a.die.timer >= a.die.cycleEnd * .65 - 1e-6); }
    function manualVolley(targetId, slot) { if (!canManualVolley(slot))
        return; if (targetId !== undefined && !state.enemies.some(e => e.id === targetId))
        return; for (const a of state.archers) {
        if ((slot === undefined || a.slot === slot) && !a.die.manualFire && a.die.timer >= a.die.cycleEnd * .65 - 1e-6) {
            a.die.manualFire = true;
            a.die.manualTargetId = targetId ?? null;
        }
    } }
    const introArcher = newArcher(2, 'medium', 'Добрыня');
    introArcher.x = 652;
    introArcher.y = 461;
    introArcher.appearance = { height: 1.48, bodyW: 1.08, hood: 1, scar: 1, patch: 1, trim: 2, bowTilt: -2, cap: 1, wear: .34, beard: 2, beardLen: 1.12, moustache: 1 };
    window.__archerRig?.prepare(introArcher.klass, introArcher.appearance, introArcher.relics);
    const introEnemies = [
        { id: -1, x: 429, y: 418, targetX: 450, targetY: 444, lane: -.45, route: 'forestL', wave: 0, reward: 0, speed: 0, hp: 4, maxHp: 4, kind: 'normal', phase: .7, radius: 18, healTimer: 0, attacking: false, attackTimer: 0, attackFlash: 0, stunned: 0, ranged: false, spawnAt: 0, poison: 0, burn: 0, slow: 0, shred: 0, vulnerable: 0, poisonDps: 0, burnDps: 0, look: { snout: 1.13, frill: 1, horn: 1, tail: 1.05, hue: 0, jaw: .92 } },
        { id: -2, x: 512, y: 402, targetX: 450, targetY: 444, lane: .38, route: 'forestR', wave: 0, reward: 0, speed: 0, hp: 4, maxHp: 4, kind: 'swift', phase: 2.1, radius: 15, healTimer: 0, attacking: false, attackTimer: 0, attackFlash: 0, stunned: 0, ranged: false, spawnAt: 0, poison: 0, burn: 0, slow: 0, shred: 0, vulnerable: 0, poisonDps: 0, burnDps: 0, look: { snout: 1.25, frill: 1, horn: 2, tail: .92, hue: 2, jaw: 1.08 } }
    ];
    let introMood = 'idle', introAim = 0, introReducedMotion = false, introHideKvass = 0, introLastTime = null, introDemoActive = false, introDemoStart = 0;
    let introStoryBeat = 'sip';
    function setIntroMood(mood) { introMood = mood; }
    function setIntroReducedMotion(reduced) { introReducedMotion = reduced; }
    function currentMode() { return state.phase.mode; }
    function currentPhase() { return state.phase; }
    const FRONT_ORIENTATION = [[0, 0], [0, -90], [0, 180], [0, 90], [-90, 0], [90, 0]];
    function nearestAngle(a, n) { return a + 360 * Math.round((n - a) / 360); }
    function frontFace(x, y) { const a = x * Math.PI / 180, b = y * Math.PI / 180, s = Math.sin(a), c = Math.cos(a), z = [c * Math.cos(b), -c * Math.sin(b), -c * Math.cos(b), c * Math.sin(b), -s, s], index = z.indexOf(Math.max(...z)); return isFaceIndex(index) ? index : 0; }
    function roll(arch) {
        const d = arch.die;
        d.initialized = true;
        d.timer = 0;
        d.fired = 0;
        d.manualFire = false;
        d.manualTargetId = null;
        d.phase = 'rolling';
        arch.bowPhase = 'draw';
        arch.bowPhaseTime = 0;
        d.startX = d.finalX || 0;
        d.startY = d.finalY || 0;
        let prefIdx = randomFaceIndex();
        if (Math.random() < Math.min(.72, arch.mods.bias)) {
            const strongest = arch.faces.indexOf(Math.max(...arch.faces));
            if (isFaceIndex(strongest))
                prefIdx = strongest;
        }
        const preferred = FRONT_ORIENTATION[prefIdx];
        d.endX = nearestAngle(preferred[0] + rand(-17, 17), d.startX + 720 + rand(0, 130));
        d.endY = nearestAngle(preferred[1] + rand(-17, 17), d.startY + 720 + rand(0, 130));
        d.face = frontFace(d.endX, d.endY);
        d.value = faceRepeats(arch, d.face);
        const f = FRONT_ORIENTATION[d.face];
        d.finalX = nearestAngle(f[0], d.endX);
        d.finalY = nearestAngle(f[1], d.endY);
        d.cycleEnd = Math.max(arch.period / Math.max(.35, attackSpeed(arch)) * (arch.hurryTimer > 0 ? (1 - Math.min(.5, arch.mods.hurry)) : 1), 1.15 + Math.min(d.value, 65) * CLASSES[arch.klass].shotDelay * (arch.shotDelayMult || 1));
    }
    function easeOut(t) { return 1 - Math.pow(1 - clamp(t, 0, 1), 3); }
    // Each die face has its own persistent damage multiplier. This is not a count of arrows.
    function relicCount(a, id) { return a.relics.filter(x => x === id).length; }
    function attackSpeed(a) { return a.speed * (1 + .18 * relicCount(a, 'boots')) * (1 + metaLevel('tempo') * .03); }
    function faceRepeats(a, i) { return a.faces[i] + 2 * relicCount(a, 'quiver'); }
    function rawShotDamage(a, i) { return a.damage * a.faceDamage[i] * a.slotPower * (1 + metaLevel('keen') * .04) * (1 + metaLevel('arsenal') * .04) * (a.klass === 'heavy' ? 1 + metaLevel('crush') * .05 : 1); }
    function displayedShotDamage(a, i) {
        const m = a.mods || modifierDefaults();
        let dmg = rawShotDamage(a, i) * (1 + Math.min(3, m.mult) + (a.relics.length ? m.relicPower : 0));
        dmg *= Math.pow(1.28, relicCount(a, 'perun'));
        if (m.synergy)
            dmg *= 1 + Math.min(.8, m.synergy * state.archers.filter(x => x.klass === a.klass && x.x !== a.x).length);
        if (m.aura)
            dmg *= 1 + Math.min(.5, m.aura * state.archers.filter(x => x.x !== a.x && Math.abs(x.x - a.x) < 195).length);
        return dmg;
    }
    function formatDamage(n) { return n >= 10 ? n.toFixed(1).replace('.', ',') : n >= 1 ? n.toFixed(2).replace(/0$/, '').replace('.', ',') : n.toFixed(2).replace('.', ','); }
    const SHORT_ATTACK_MODES = { pierce: 'plain', spreadPierce: 'spread', fieldPierce: 'field' };
    const HEAVY_ATTACK_MODES = { plain: 'pierce', spread: 'spreadPierce', field: 'fieldPierce' };
    function faceModeFor(a, i) {
        let mode = FACE_ATTACKS[i].mode;
        if (a.klass === 'short')
            mode = SHORT_ATTACK_MODES[mode] || mode;
        if (a.klass === 'heavy')
            mode = HEAVY_ATTACK_MODES[mode] || mode;
        return mode;
    }
    const STATUS_IDS = ['poison', 'burn', 'slow', 'stun', 'vulnerable'];
    const STATUS_ICONS = { poison: { name: 'Яд', c: '#91e6a5', path: 'M9 2C5 8 5 11 9 14C13 11 13 8 9 2ZM4 14H14' }, burn: { name: 'Огонь', c: '#ffae6c', path: 'M10 2C14 8 6 8 13 15C6 18 2 14 5 10C5 7 8 6 10 2Z' }, slow: { name: 'Лёд', c: '#9edafa', path: 'M9 1V17M1 9H17M3 3L15 15M15 3L3 15' }, stun: { name: 'Оглушение', c: '#e5d28c', path: 'M11 1L5 10H10L7 17L15 7H10Z' }, vulnerable: { name: 'Уязвимость', c: '#ef9bc5', path: 'M9 2L16 6V12L9 17L2 12V6ZM6 9L9 12L13 6' } };
    function activeStatuses(a) { return STATUS_IDS.filter(k => (a.mods[k] || 0) > 0).map(id => ({ ...STATUS_ICONS[id], id })); }
    function faceInfo(a, i) {
        const mode = faceModeFor(a, i), number = faceRepeats(a, i);
        const labels = { plain: 'Обычная стрела', pierce: 'Пробивная стрела', spread: 'Залп: 3 обычные стрелы', spreadPierce: 'Залп: 3 пробивные стрелы', field: 'По всему полю: обычные стрелы', fieldPierce: 'По всему полю: пробивные стрелы' }, label = labels[mode];
        const desc = (mode.startsWith('field') ? 'По 1 стреле на каждого ящера, максимум 10. ' : mode.startsWith('spread') ? 'По 3 стрелы за залп. ' : 'По 1 стреле за выстрел. ') + (mode.includes('Pierce') || mode === 'pierce' ? 'Стрелы пробивают несколько целей. ' : '');
        return { mode, label, desc, number, damage: displayedShotDamage(a, i) };
    }
    function faceSymbolFor(a, i) { const m = FACE_ATTACKS[i].mode, shortSymbols = ['→', '→', '⋔', '⋔', '✦', '✦'], heavySymbols = ['⇢', '⇢', '⫸', '⫸', '✸', '✸']; if (a.klass === 'short' && (m === 'pierce' || m === 'spreadPierce' || m === 'fieldPierce'))
        return shortSymbols[i]; if (a.klass === 'heavy')
        return heavySymbols[i]; return FACE_ATTACKS[i].symbol; }
    function estimateDps(a) { const values = FACE_INDICES.map(i => { const mode = faceModeFor(a, i), count = faceRepeats(a, i), targets = mode.startsWith('field') ? 3.2 : mode.startsWith('spread') ? 2.25 : 1, pierce = mode === 'pierce' || mode.endsWith('Pierce') ? 1.3 : 1, critical = 1 + Math.min(.75, a.mods.crit) * (.65 + a.mods.critPower), cycle = Math.max(a.period / Math.max(.35, attackSpeed(a)), 1.15 + Math.min(count, 65) * CLASSES[a.klass].shotDelay * a.shotDelayMult); return displayedShotDamage(a, i) * count * targets * pierce * critical / cycle; }); return values.reduce((sum, value) => sum + value, 0) / 6; }
    function boostArcher(slot) { if (!isSlotId(slot))
        return; const a = state.archers.find(archer => archer.slot === slot); if (!a || state.phase.mode !== 'playing')
        return; const price = boostPrice(a); if (state.gold < price)
        return; state.gold -= price; if (a.xp < a.xpNeeded)
        giveMemberXP(a, a.xpNeeded - a.xp); showNextLevel('personal', slot); }
    function randomFaceIndex() { const index = Math.floor(rand(0, FACE_INDICES.length)); if (!isFaceIndex(index))
        throw new RangeError('Random face index is out of range'); return index; }
    function buildRecruit(klass, name) {
        const c = CLASSES[klass], faces = six(c.faces.map(v => Math.max(1, v + (Math.random() < .37 ? 1 : 0) + (Math.random() < .09 ? 1 : 0))));
        const pick = randomFaceIndex();
        faces[pick] += Math.random() < .45 ? 2 : 1;
        // All archer classes retain distinct attack restrictions while the 6 face types remain illustrated.
        const damage = (c.damage + meta.bonus[klass] + (klass === 'heavy' ? c.damage * metaBonus('heavyPower') * .08 : 0)) * rand(.92, 1.14), period = c.period * rand(.94, 1.08);
        return { klass, name, faces, faceDamage: six(FACE_ATTACKS.map(face => face.damage)), damage, period, speed: rand(.92, 1.10), appearance: randomAppearance(klass) };
    }
    function openRecruit(slot, replacing = false) {
        if (!isSlotId(slot) || state.phase.mode !== 'playing')
            return;
        const validSlot = slot, old = state.archers.find(a => a.slot === validSlot);
        if (!!old !== !!replacing)
            return;
        const price = replacing ? Math.round(SLOTS[validSlot].price * .65 + 25) : SLOTS[validSlot].price;
        if (state.gold < price)
            return;
        const pool = [];
        for (const klass of CLASS_ORDER.slice().sort(() => Math.random() - .5)) {
            const name = pickName();
            pool.push(buildRecruit(klass, name));
        }
        state.phase = { mode: 'recruit', modal: { type: 'recruit', slot: validSlot, replacing, options: pool } };
    }
    function inheritHalf(old, neo) { const c = CLASSES[old.klass]; for (const f of FACE_INDICES) {
        neo.faces[f] += Math.max(0, Math.floor((old.faces[f] - c.faces[f]) * .5));
        neo.faceDamage[f] *= 1 + (old.faceDamage[f] / FACE_ATTACKS[f].damage - 1) * .5;
    } neo.damage += Math.max(0, old.damage - c.damage - meta.bonus[old.klass]) * .5; neo.speed = Math.min(5, neo.speed + Math.max(0, old.speed - 1) * .5); const relicHealth = relicCount(old, 'kvass') * 30; neo.maxHp += Math.max(0, old.maxHp - c.hp - meta.workshop.health * 7 - relicHealth) * .5; neo.maxHp = Math.round(neo.maxHp); neo.hp = neo.maxHp; neo.mods = modifierDefaults(); for (const key of MODIFIER_KEYS)
        neo.mods[key] = Math.max(0, old.mods[key] * .5); neo.level = Math.max(1, Math.floor(1 + (old.level - 1) * .5)); neo.xpNeeded = memberXpNeeded(neo.level); neo.xp = Math.floor(old.xp * .5); }
    function recruitChoice(i) { const phase = state.phase; if (phase.mode !== 'recruit' || !Number.isInteger(i) || i < 0 || i >= phase.modal.options.length)
        return; const modal = phase.modal, opt = modal.options[i]; if (!opt)
        return; const { slot, replacing } = modal; const price = replacing ? Math.round(SLOTS[slot].price * .65 + 25) : SLOTS[slot].price; if (state.gold < price)
        return; state.gold -= price; const old = state.archers.find(a => a.slot === slot), neo = newArcher(slot, opt.klass, opt.name, opt); if (old) {
        inheritHalf(old, neo);
        for (const r of old.relics)
            state.relics.push(r);
        state.archers = state.archers.filter(a => a !== old);
    } window.__archerRig?.prepare(neo.klass, neo.appearance, neo.relics); state.archers.push(neo); roll(neo); state.archers.sort((a, b) => a.slot - b.slot); state.phase = { mode: 'playing', modal: { type: 'none' } }; state.last = performance.now(); }
    function openEquip(i) { if (state.phase.mode !== 'playing' || !Number.isInteger(i) || i < 0 || i >= state.relics.length || !state.archers.length)
        return; const relicId = state.relics[i]; if (!relicId || !RELICS.some(x => x.id === relicId))
        return; state.phase = { mode: 'equip', modal: { type: 'equip', relicIndex: i } }; }
    function equipRelic(slot) { const phase = state.phase; if (!isSlotId(slot) || phase.mode !== 'equip')
        return; const a = state.archers.find(x => x.slot === slot), i = phase.modal.relicIndex; if (!a || a.relics.length >= 6 || !Number.isInteger(i) || i < 0 || i >= state.relics.length)
        return; const id = state.relics[i]; if (!id)
        return; state.relics.splice(i, 1); a.relics.push(id); if (id === 'kvass') {
        a.maxHp += 30;
        a.hp += 30;
    } closeModal(); autoEquipRetryAt = 0; }
    function unequipRelic(slot, index) { const a = isSlotId(slot) ? state.archers.find(x => x.slot === slot) : undefined; if (!a || state.phase.mode !== 'playing' || !Number.isInteger(index) || index < 0 || index >= a.relics.length)
        return; const id = a.relics[index]; if (!id)
        return; a.relics.splice(index, 1); if (id === 'kvass') {
        a.maxHp = Math.max(1, a.maxHp - 30);
        a.hp = Math.min(a.hp, a.maxHp);
    } state.relics.push(id); }
    function closeModal() { if (state.phase.mode !== 'recruit' && state.phase.mode !== 'equip')
        return; if (state.phase.mode === 'equip')
        autoEquipRetryAt = state.elapsed + 12;
    else
        autoRecruitRetryAt = state.elapsed + 12; state.phase = { mode: 'playing', modal: { type: 'none' } }; state.last = performance.now(); }
    // Deterministic preview and exact matching spawn composition.
    function waveComposition(w) {
        const n = w + Math.floor((state.night - 1) * 2), a = { normal: 2 + Math.floor(n * .37), swift: 1 + Math.floor(n / 4), shield: Math.floor((n + 1) / 4), heavy: Math.floor(n / 5), brute: Math.floor((n - 1) / 7), shaman: Math.floor(n / 6), healer: Math.floor((n - 2) / 7) };
        if (w < 2)
            a.shield = 0;
        if (w < 3)
            a.heavy = 0;
        if (w < 4)
            a.brute = 0;
        if (w < 4)
            a.shaman = 0;
        if (w < 5)
            a.healer = 0;
        return a;
    }
    function beginWave(early = false) {
        if (state.phase.mode !== 'playing' || state.wave >= state.totalWaves)
            return;
        const alive = state.enemies.length > 0 || state.waveStreams.some(v => v.queue.length > 0), chained = early && alive;
        state.wave++;
        const counts = waveComposition(state.wave), arr = [];
        for (const type of ENEMY_KINDS)
            for (let i = 0; i < counts[type]; i++)
                arr.push(type);
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(rand(0, i + 1)), left = requiredAt(arr, i), right = requiredAt(arr, j);
            arr[i] = right;
            arr[j] = left;
        }
        // Each wave gets an independent spawner: forced waves can overlap and their loot is more valuable.
        const pressure = early ? Math.max(1, chained ? Math.min(5, 1 + state.waveStreams.length + Math.floor(state.enemies.length / 13)) : 1) : 0;
        const mul = 1 + pressure * .28;
        state.waveStreams.push({ wave: state.wave, queue: arr, delay: .1, reward: mul });
        if (early) {
            state.gold += Math.ceil(Math.max(0, state.nextWaveAt - state.elapsed) * (.35 + metaLevel('watch') * .04));
        }
        state.nextWaveAt = 8 + state.wave * (DURATION - 13) / state.totalWaves;
        if (early)
            showBark('РУСЫ', pressure ? `Две волны? Дважды позолотят! ×${fmt(mul)}` : 'Ящеры, не стойте в очереди!', 450, 395, 3);
    }
    function terrainMultiplier(x, y) {
        const half = roadHalf(y) + 8;
        let mult = Math.abs(x - roadCenterX(y)) < half ? 1 : .67;
        for (const tr of trees) {
            let dx = x - tr.x, dy = y - tr.y;
            if (dx * dx + dy * dy < 670)
                mult *= .64;
        }
        if (y > 396 && y < 445)
            return Math.max(.12, clamp(mult * .48, .24, 1) * (1 - Math.min(.32, metaLevel('ditch') * .08)));
        return clamp(mult, .24, 1);
    }
    function spawn(type, stream = null) {
        const w = stream?.wave || Math.max(1, state.wave), b = ENEMIES[type];
        let routePick = Math.random(), route = routePick < .40 ? 'road' : routePick < .70 ? 'forestL' : 'forestR';
        let x, y, targetX = rand(386, 514), targetY = 444, lane = rand(-.95, .95);
        if (route === 'road') {
            y = 242 + rand(0, 6);
            x = roadCenterX(y) + lane * roadHalf(y);
        }
        else if (route === 'forestL') {
            x = rand(20, 255);
            y = rand(238, 315);
        }
        else {
            x = rand(645, 880);
            y = rand(238, 315);
        }
        if (b.ranged) {
            y = rand(263, 298);
            x = route === 'forestL' ? rand(170, 260) : route === 'forestR' ? rand(640, 730) : rand(398, 502);
        }
        const hp = b.hp * (1 + .105 * (w - 1) + .25 * (state.night - 1));
        state.enemies.push({ id: state.nextId++, x, y, targetX, targetY, lane, route, wave: w, reward: stream?.reward || 1, speed: b.speed * (1.18 + .02 * (w - 1)) * rand(.96, 1.1), hp, maxHp: hp, kind: type, phase: rand(0, 6.28), radius: type === 'brute' ? 30 : type === 'heavy' ? 24 : type === 'swift' ? 16 : 20, healTimer: rand(0, 1.6), attacking: false, attackTimer: rand(.8, 2), attackFlash: 0, stunned: 0, ranged: !!b.ranged, spawnAt: state.elapsed, poison: 0, burn: 0, slow: 0, shred: 0, vulnerable: 0, poisonDps: 0, burnDps: 0, look: randomLizardLook() });
    }
    const ATTACKS = { normal: { period: 2.05, power: 1.05 }, swift: { period: 1.15, power: .74 }, shield: { period: 2.3, power: 1.7 }, heavy: { period: 2.5, power: 2.6 }, brute: { period: 3, power: 4.1 }, shaman: { period: 3, power: 1.3 }, healer: { period: 4, power: 1 } };
    function showBark(who, text, x, y, ttl = 2.5) { state.barks = state.barks.filter(b => Math.abs(b.x - x) > 145 || Math.abs(b.y - y) > 58); state.barks.push({ who, text, x, y, life: ttl, max: ttl }); if (state.barks.length > 4)
        state.barks.shift(); }
    function harmArcher(a, amount) {
        if (!state.archers.includes(a))
            return;
        const damage = amount * Math.pow(.7, relicCount(a, 'amulet')) * (1 - Math.min(.7, a.mods.armor + (a.relics.length ? a.mods.relicGuard : 0) + (metaBonus('armor') * .04 + metaBonus('guard') * .03)));
        a.hp -= damage;
        impact(a.x, 428, '#e6a679', 'hurt');
        if (a.hp <= 0) {
            state.fx.push({ kind: 'burst', x: a.x, y: a.y - 28, r: 9, color: '#f0b17e', life: .34, max: .34 });
            state.archers = state.archers.filter(x => x !== a);
            for (const relic of a.relics)
                state.relics.push(relic);
            showBark('РУСЫ', `${a.name} пал! Где запасная дружина?!`, a.x, a.y - 128, 3);
        }
    }
    function rangedAttack(e) {
        e.attackFlash = .35;
        const a = state.archers.length && Math.random() < .78 ? state.archers[Math.floor(rand(0, state.archers.length))] : null;
        const tx = a ? a.x : 450, ty = a ? 440 : 484;
        const dx = tx - e.x, dy = ty - e.y, len = Math.hypot(dx, dy) || 1;
        const speed = 200;
        state.spellShots.push({ x: e.x, y: e.y - 22, vx: dx / len * speed, vy: dy / len * speed, life: 2.5, targetSlot: a?.slot ?? null, damage: ATTACKS[e.kind].power * (1 + .07 * e.wave), kind: e.kind });
        if (Math.random() < .22)
            showBark('ЯЩЕР', e.kind === 'shaman' ? 'Ш-ш-шаманы зовут болото!' : 'Выпей зелёный отвар, рус!', e.x, e.y - 35, 2);
    }
    function gateHit(enemy) {
        const b = ATTACKS[enemy.kind];
        enemy.attackFlash = .34;
        const near = state.archers.filter(a => Math.abs(a.x - enemy.x) < 110);
        if (near.length && Math.random() < .56) {
            const target = requiredAt(near, Math.floor(rand(0, near.length)));
            harmArcher(target, b.power * (2.8 + .12 * enemy.wave));
        }
        else {
            state.lives = Math.max(0, state.lives - b.power * (1 + .045 * enemy.wave));
            state.gateFlash = .20;
            impact(clamp(enemy.x, 370, 530), 467, '#e3a17d', 'gate');
            for (let i = 0; i < 4; i++)
                state.fx.push({ kind: 'spark', x: clamp(enemy.x, 370, 530) + rand(-9, 9), y: 467, vx: rand(-42, 42), vy: rand(-75, -25), life: rand(.25, .52), max: .52, size: rand(2, 4), color: '#b98b61' });
        }
        if (state.lives <= 0)
            showEnd(false);
    }
    function impact(x, y, color = '#eebc83', accent = undefined) { state.fx.push({ kind: 'ring', x, y, r: 5, color, life: .3, max: .3, ...(accent ? { accent } : {}) }); for (let i = 0; i < 5; i++) {
        let a = rand(0, 6.28), v = rand(25, 75);
        state.fx.push({ kind: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: .38, max: .38, size: rand(1.5, 3), color: i % 2 ? '#e0a37b' : '#edcf96' });
    } }
    function damageEnemy(e, damage, arrow) {
        if (!state.enemies.includes(e))
            return;
        const b = ENEMIES[e.kind], owner = arrow.source, m = owner.mods;
        let actual = Math.max(.2, damage * (b.resist && arrow.type !== 'pierce' ? 1 - b.resist : 1));
        if (owner.klass === 'medium' && e.hp >= e.maxHp - .1)
            actual *= 1.35;
        actual *= Math.pow(1.28, relicCount(owner, 'perun'));
        actual *= 1 + Math.min(3, m.mult) + ((owner.relics.length && m.relicPower) || 0);
        if (m.synergy)
            actual *= 1 + Math.min(.8, m.synergy * state.archers.filter(x => x.klass === owner.klass && x.slot !== owner.slot).length);
        if (m.aura)
            actual *= 1 + Math.min(.5, m.aura * state.archers.filter(x => x.slot !== owner.slot && Math.abs(x.x - owner.x) < 195).length);
        if (m.boss && ['brute', 'shield', 'heavy'].includes(e.kind))
            actual *= 1 + m.boss;
        if (m.execute && e.hp / e.maxHp < .4)
            actual *= 1 + m.execute;
        if (m.opening && state.elapsed - (e.spawnAt || 0) < 6)
            actual *= 1 + m.opening;
        let critical = false;
        if (Math.random() < Math.min(.75, m.crit)) {
            actual *= 1.65 + m.critPower;
            critical = true;
        }
        if (m.shred) {
            e.shred = Math.min(.7, (e.shred || 0) + m.shred);
            e.shredTimer = 7;
        }
        if (m.poison) {
            e.statusOwnerId = owner.id;
            e.poison = Math.max(e.poison || 0, 4);
            e.poisonDps = Math.max(e.poisonDps || 0, m.poison * owner.damage * .8);
        }
        if (m.burn) {
            e.statusOwnerId = owner.id;
            e.burn = Math.max(e.burn || 0, 3.2);
            e.burnDps = Math.max(e.burnDps || 0, m.burn * owner.damage);
        }
        if (m.slow) {
            e.slow = Math.max(e.slow || 0, 4);
            e.slowPower = Math.max(e.slowPower || 0, Math.min(.75, m.slow));
        }
        if (m.stun && Math.random() < Math.min(.45, m.stun))
            e.stunned = Math.max(e.stunned, .7);
        if (m.vulnerable) {
            e.vulnerable = Math.min(.7, Math.max(e.vulnerable || 0, m.vulnerable));
            e.vulnerableTimer = 5;
        }
        if (m.fear && Math.random() < Math.min(.45, m.fear) && !e.ranged && !e.attacking)
            e.y = Math.max(242, e.y - 18);
        actual *= 1 + Math.min(.7, e.vulnerable || 0) + Math.min(.7, e.shred || 0);
        owner.damageDealt += actual;
        if (m.leech)
            owner.hp = Math.min(owner.maxHp, owner.hp + actual * m.leech);
        e.hp -= actual;
        impact(e.x, e.y, critical ? '#f4d078' : owner.klass === 'heavy' ? '#e6bd76' : '#c8e397', critical ? 'critical' : owner.klass === 'heavy' ? 'heavy' : undefined);
        if (owner.klass === 'heavy') {
            e.stunned = Math.max(e.stunned, .22);
            for (const other of [...state.enemies])
                if (other !== e && Math.hypot(other.x - e.x, other.y - e.y) < 34) {
                    other.hp -= actual * .11;
                    if (other.hp <= 0)
                        killEnemy(other, owner);
                }
        }
        if (e.hp <= 0)
            killEnemy(e, owner);
        if ((arrow.bounce || arrow.split) && arrow.chainDepth < 1) {
            const remain = state.enemies.filter(v => v.id !== e.id && !arrow.hits.includes(v.id));
            if (remain.length) {
                if (arrow.bounce && Math.random() < arrow.bounce) {
                    const t = requiredAt(remain, 0), theta = Math.atan2(t.y - e.y, t.x - e.x);
                    state.arrows.push({ ...arrow, x: e.x, y: e.y, vx: Math.cos(theta) * 580, vy: Math.sin(theta) * 580, life: 1, pierces: 1, hits: [...arrow.hits, e.id], bounce: 0, split: 0, chainDepth: 1, damage: arrow.damage * .6 });
                }
                if (arrow.split && Math.random() < arrow.split) {
                    for (const t of remain.slice(0, 2)) {
                        const theta = Math.atan2(t.y - e.y, t.x - e.x);
                        state.arrows.push({ ...arrow, x: e.x, y: e.y, vx: Math.cos(theta) * 600, vy: Math.sin(theta) * 600, life: 1, pierces: 1, hits: [...arrow.hits, e.id], bounce: 0, split: 0, chainDepth: 1, damage: arrow.damage * .45 });
                    }
                }
            }
        }
    }
    function killEnemy(e, owner = null) {
        if (!state.enemies.includes(e))
            return;
        state.enemies = state.enemies.filter(o => o !== e);
        const b = ENEMIES[e.kind];
        state.fx.push({ kind: 'burst', x: e.x, y: e.y - 12, r: 8, color: '#d4e58f', life: .34, max: .34 });
        state.kills++;
        if (state.archers.length) {
            const credited = owner && state.archers.includes(owner) ? owner : requiredAt(state.archers, Math.floor(rand(0, state.archers.length)));
            giveMemberXP(credited, Math.round(b.xp * e.reward * (1 + (credited.mods.wisdom || 0))));
        }
        state.gold += Math.round(b.gold * e.reward * (1 + (metaBonus('bounty') + metaBonus('loot')) * .05 + (owner?.mods.bounty || 0) + (b.ranged ? (owner?.mods.relicCoin || 0) : 0)));
        if (owner) {
            owner.hurryTimer = 5;
        }
        if (b.ranged && Math.random() < Math.min(.96, (.56 + meta.workshop.luck * .08 + metaBonus('relicFortune') * .05 + metaBonus('fortune2') * .03 + (owner?.mods.relicLuck || 0)))) {
            const r = requiredAt(RELICS, Math.floor(rand(0, RELICS.length)));
            state.relics.push(r.id);
            showBark('ДОБЫЧА', `Реликвия: ${r.name}`, e.x, e.y - 30, 3);
        }
        if (Math.random() < .06)
            showBark('РУСЫ', requiredAt(RUS_LINES, Math.floor(rand(0, RUS_LINES.length))), 450, 385, 2.2);
    }
    function distToSegment(px, py, ax, ay, bx, by) { const dx = bx - ax, dy = by - ay, q = dx * dx + dy * dy || 1, t = clamp(((px - ax) * dx + (py - ay) * dy) / q, 0, 1); return Math.hypot(px - (ax + dx * t), py - (ay + dy * t)); }
    function chooseEnemy(a) {
        const list = state.enemies.slice();
        if (!list.length)
            return null;
        const mode = a.targetMode || 'gate';
        const score = (e) => {
            if (mode === 'mage')
                return (e.ranged ? 10000 : 0) + e.y;
            if (mode === 'heavy')
                return e.maxHp;
            if (mode === 'fast')
                return e.speed;
            if (mode === 'low')
                return -e.hp;
            return (e.attacking ? 10000 : 0) + e.y;
        };
        list.sort((x, y) => score(y) - score(x));
        return list[0] ?? null;
    }
    function bowDrawPull(a) { const start = Math.max(0, a.die.cycleEnd * .65 - (21 * BOW_TIMING.drawFrame + BOW_TIMING.drawHold)), elapsed = Math.max(0, a.die.timer - start); return Math.min(20, Math.floor((elapsed + 1e-9) / BOW_TIMING.drawFrame)) / 20; }
    function archerBowOrigin(a) { const heavy = a.klass === 'heavy', short = a.klass === 'short', ap = a.appearance || randomAppearance(a.klass), scale = (heavy ? 1.55 : short ? .66 : 1) * ap.height, pull = a.bowPhase === 'draw' ? bowDrawPull(a) : a.bowPhase === 'release' ? 1 - easeOut(a.bowPhaseTime / RELEASE_DURATION) : a.bowPhase === 'recover' ? .2 * (1 - easeOut(a.bowPhaseTime / RECOVER_DURATION)) : .025 * (.5 + .5 * Math.sin(state.elapsed * 3.2 + a.slot)), strain = Math.max(0, (pull - .7) / .3), bodyX = -3 * pull - strain, bodyY = 2 * pull, angle = -.04 * pull - .04 * strain, shoulderY = -15 + (14 + 5 * pull) * Math.sin(angle) - 44 * Math.cos(angle) + bodyY, arrowY = shoulderY - 24 - 1.5 * strain - 6, nockX = 36 - 16 * pull, dx = nockX * ap.bodyW, dy = arrowY + 15, localX = dx * Math.cos(angle) - dy * Math.sin(angle) + bodyX, localY = dx * Math.sin(angle) + dy * Math.cos(angle) - 15 + bodyY; return [a.x + scale * (14 + localX * 124 / 180), a.y + scale * (4.86 + localY * 130 / 210)]; }
    function updateBow(a, dt) { a.bowPhaseTime += dt; if (a.bowPhase === 'release' && a.bowPhaseTime >= RELEASE_DURATION) {
        a.bowPhase = 'recover';
        a.bowPhaseTime -= RELEASE_DURATION;
    } if (a.bowPhase === 'recover' && a.bowPhaseTime >= RECOVER_DURATION) {
        a.bowPhase = 'idle';
        a.bowPhaseTime -= RECOVER_DURATION;
    } }
    function fireOne(a) {
        const d = a.die, face = d.face, spec = FACE_ATTACKS[face], enemy = (d.manualTargetId === null ? null : state.enemies.find(e => e.id === d.manualTargetId)) ?? chooseEnemy(a), [x, y] = archerBowOrigin(a);
        let mode = spec.mode;
        if (a.klass === 'short')
            mode = SHORT_ATTACK_MODES[mode] || mode;
        if (a.klass === 'heavy')
            mode = HEAVY_ATTACK_MODES[mode] || mode;
        const piercing = mode === 'pierce' || mode === 'spreadPierce' || mode === 'fieldPierce', three = mode === 'spread' || mode === 'spreadPierce', field = mode === 'field' || mode === 'fieldPierce';
        const targets = field ? state.enemies.slice().sort((l, r) => r.y - l.y).slice(0, 10) : (enemy ? [enemy] : []);
        const shoot = (target, offset = 0) => {
            const tx = target ? target.x + target.speed * .12 : 450 + rand(-25, 25), ty = target ? target.y - 16 : 275, theta = Math.atan2(ty - y, tx - x) + offset, v = CLASSES[a.klass].speed * (1 + a.mods.velocity);
            state.arrows.push({ x, y, vx: Math.cos(theta) * v, vy: Math.sin(theta) * v, life: 2.2, type: piercing ? 'pierce' : 'plain', source: a, targetId: target?.id ?? null, hits: [], pierces: (a.klass === 'short' ? 1 : (piercing ? (a.klass === 'heavy' ? 5 : spec.pierce) : 1) + Math.floor(a.mods.pierce)), damage: rawShotDamage(a, face), size: (a.klass === 'heavy' ? 2.1 : a.klass === 'short' ? .60 : 1) * (1 + a.mods.width), bounce: Math.min(.4, a.mods.bounce), split: Math.min(.4, a.mods.split), chainDepth: 0 });
        };
        if (field) {
            for (const e of targets)
                shoot(e);
        }
        else if (three) {
            for (const off of [-.18, 0, .18])
                shoot(targets[0], off);
        }
        else
            shoot(targets[0]);
        a.shots++;
        if (a.klass === 'short' && a.shots % 4 === 0) {
            shoot(targets[0], .08);
            shoot(targets[0], -.08);
        }
        if (Math.random() < Math.min(.5, a.mods.salvo))
            shoot(targets[0], rand(-.08, .08));
        a.shotFlash = .22;
        a.bowPull = .34;
        a.bowPhase = 'release';
        a.bowPhaseTime = 0;
    }
    function updateDice(a, dt) {
        let d = a.die;
        const end = d.cycleEnd, volleyStart = end * .65;
        d.timer = state.controlMode === 'manual' && !d.manualFire ? Math.min(volleyStart, d.timer + dt) : d.timer + dt;
        if (d.timer < end * .37)
            d.phase = 'rolling';
        else if (d.timer < end * .49)
            d.phase = 'landed';
        else if (d.timer < volleyStart)
            d.phase = 'reveal';
        else
            d.phase = 'salvo';
        if (d.timer >= volleyStart && (state.controlMode !== 'manual' || d.manualFire)) {
            const spacing = Math.min(CLASSES[a.klass].shotDelay * (a.shotDelayMult || 1), Math.max(.011, (end - volleyStart - .07) / Math.max(1, d.value)));
            const want = Math.min(d.value, Math.floor((d.timer - volleyStart) / spacing) + 1);
            while (d.fired < want) {
                fireOne(a);
                d.fired++;
            }
        }
        if (d.timer >= end) {
            const redo = Math.random() < Math.min(.50, a.mods.extraRoll);
            const oldFace = d.face;
            roll(a);
            if (redo) {
                d.face = oldFace;
                d.value = faceRepeats(a, oldFace);
                const f = FRONT_ORIENTATION[oldFace];
                d.endX = nearestAngle(f[0], d.startX + 720);
                d.endY = nearestAngle(f[1], d.startY + 720);
                d.finalX = d.endX;
                d.finalY = d.endY;
                d.cycleEnd *= .76;
            }
        }
    }
    // The complete card taxonomy is data rather than a single random r<11 branch.
    // Each item has a distinct combat or economy effect, not just a new title.
    const CARD_GROUPS = { dice: 'Кубик · значения и шанс', power: 'Урон · добивание', projectile: 'Стрела · траектория', status: 'Эффекты · контроль', target: 'Тактика · цели', tempo: 'Темп · ритм', survival: 'Защита · выживание', economy: 'Экономика · добыча', squad: 'Дружина · поддержка', relic: 'Реликвии · удача' };
    const CARD_TEMPLATES = [
        // 10 dice variants
        { id: 'one10', g: 'dice', n: 'Дедова стрела', art: 'bow', k: 'faceSet', faces: 1, v: 10, desc: 'Одна случайная грань взлетает в цене' },
        { id: 'two5', g: 'dice', n: 'Двойная береста', art: 'bow', k: 'faceSet', faces: 2, v: 5, desc: 'Две случайные грани сильнее' },
        { id: 'three3', g: 'dice', n: 'Три богатыря', art: 'star', k: 'faceSet', faces: 3, v: 3, desc: 'Ставка на тройной успех' },
        { id: 'six1', g: 'dice', n: 'Славянский размах', art: 'sun', k: 'faceSet', faces: 6, v: 1, desc: 'Ровное усиление каждого броска' },
        { id: 'two7', g: 'dice', n: 'Княжеский указ', art: 'bow', k: 'faceSet', faces: 2, v: 7, desc: 'Два особенно сильных исхода' },
        { id: 'odd2', g: 'dice', n: 'Нечётная рать', art: 'star', k: 'faceIndices', indices: [0, 2, 4], v: 2, desc: 'Грани 1, 3 и 5' },
        { id: 'even2', g: 'dice', n: 'Чётная дружина', art: 'star', k: 'faceIndices', indices: [1, 3, 5], v: 2, desc: 'Грани 2, 4 и 6' },
        { id: 'weak7', g: 'dice', n: 'Поднять отстающих', art: 'shield', k: 'weakFace', v: 7, desc: 'Усиливает слабейшую грань' },
        { id: 'strong5', g: 'dice', n: 'Кость воеводы', art: 'star', k: 'strongFace', v: 5, desc: 'Усиливает сильнейшую грань' },
        { id: 'fate', g: 'dice', n: 'Хитрая судьба', art: 'star', k: 'bias', v: .16, desc: '+16% шанса бросить самую мощную грань' },
        // 7 damage
        { id: 'damage', g: 'power', n: 'Гром Перуна', art: 'sword', k: 'damage', v: .50, desc: 'Каждая стрела бьёт сильнее' },
        { id: 'facePowerOne', g: 'power', n: 'Кованый наконечник', art: 'sword', k: 'facePowerOne', v: .45, desc: '+45% урона одной случайной грани, число атак не меняется' },
        { id: 'facePowerPair', g: 'power', n: 'Заговор на два острия', art: 'star', k: 'facePowerPair', v: .28, desc: '+28% урона двум случайным граням' },
        { id: 'facePowerThree', g: 'power', n: 'Тройная закалка', art: 'sword', k: 'facePowerThree', v: .16, desc: '+16% урона трём случайным граням' },
        { id: 'facePowerAll', g: 'power', n: 'Острота всех шести', art: 'sun', k: 'facePowerAll', v: .12, desc: '+12% урона каждой грани' },
        { id: 'facePowerWeak', g: 'power', n: 'Слабую грань не обидим', art: 'shield', k: 'facePowerWeak', v: .55, desc: '+55% урона самой слабой по попаданию грани' },
        { id: 'facePowerStrong', g: 'power', n: 'Любимец Перуна', art: 'star', k: 'facePowerStrong', v: .36, desc: '+36% урона самой сильной по попаданию грани' },
        { id: 'mult', g: 'power', n: 'Богатырский разгон', art: 'sword', k: 'mult', v: .14, desc: '+14% ко всему урону' },
        { id: 'crit', g: 'power', n: 'Острие судьбы', art: 'star', k: 'crit', v: .11, desc: '+11% вероятности критического попадания' },
        { id: 'critPower', g: 'power', n: 'Расколотый шлем', art: 'sword', k: 'critPower', v: .55, desc: 'Критические удары наносят больше' },
        { id: 'shred', g: 'power', n: 'Чешую долой', art: 'sword', k: 'shred', v: .09, desc: 'Попадания ослабляют броню на 9% за стак' },
        { id: 'execute', g: 'power', n: 'Контрольный колышек', art: 'sword', k: 'execute', v: .18, desc: '+18% урона целям с низким здоровьем' },
        { id: 'hunters', g: 'power', n: 'Охота на бугаёв', art: 'sword', k: 'boss', v: .28, desc: '+28% урона громилам, щитоящерам и копейщикам' },
        // 6 projectile
        { id: 'velocity', g: 'projectile', n: 'Ветер в оперенье', art: 'bow', k: 'velocity', v: .23, desc: '+23% скорости стрел' },
        { id: 'pierce', g: 'projectile', n: 'Игла сквозь чешую', art: 'bow', k: 'pierce', v: 1, desc: '+1 цель к пробиванию (и для обычных стрел)' },
        { id: 'width', g: 'projectile', n: 'Наконечник с ладонь', art: 'sword', k: 'width', v: .22, desc: '+22% радиуса попадания' },
        { id: 'bounce', g: 'projectile', n: 'Рикошет от лаптей', art: 'star', k: 'bounce', v: .12, desc: 'Шанс отскока стрелы к другой цели +12%' },
        { id: 'split', g: 'projectile', n: 'Расщепитель стрел', art: 'bow', k: 'split', v: .10, desc: '10% шанс разделиться на две стрелы после попадания' },
        { id: 'salvo', g: 'projectile', n: 'Лишняя тетива', art: 'bow', k: 'salvo', v: .16, desc: '16% шанс выпустить дополнительную стрелу' },
        // 6 status
        { id: 'poison', g: 'status', n: 'Зелёное против зелёных', art: 'star', k: 'poison', v: .10, desc: 'Попадания отравляют цель на 4 секунды' },
        { id: 'burn', g: 'status', n: 'Огнестрел Перуна', art: 'sun', k: 'burn', v: .12, desc: 'Поджигает ящеров: периодический урон' },
        { id: 'slow', g: 'status', n: 'Смола болотная', art: 'shield', k: 'slow', v: .13, desc: 'Замедляет передвижение врагов' },
        { id: 'stun', g: 'status', n: 'Звенящий лоб', art: 'star', k: 'stun', v: .07, desc: 'Шанс оглушить цель на 0.7 с' },
        { id: 'vulnerable', g: 'status', n: 'Метка чешуи', art: 'sword', k: 'vulnerable', v: .12, desc: 'Цель получает больше урона от других стрел' },
        { id: 'fear', g: 'status', n: 'Испуг ящера', art: 'sun', k: 'fear', v: .09, desc: 'Шанс отбросить врага назад' },
        // 5 targeting
        { id: 'focusHeavy', g: 'target', n: 'Бей самого толстого', art: 'sword', k: 'target', v: 'heavy', desc: 'Приоритет врагов с большим здоровьем' },
        { id: 'focusMage', g: 'target', n: 'Шаману по колпаку', art: 'star', k: 'target', v: 'mage', desc: 'Приоритет шаманов и знахарей' },
        { id: 'focusFast', g: 'target', n: 'Ловцы юрких', art: 'bow', k: 'target', v: 'fast', desc: 'Приоритет быстрейших врагов' },
        { id: 'focusLow', g: 'target', n: 'Добиватели', art: 'sword', k: 'target', v: 'low', desc: 'Сначала враги с минимальным оставшимся ХП' },
        { id: 'focusGate', g: 'target', n: 'Ни шагу к воротам', art: 'shield', k: 'target', v: 'gate', desc: 'Приоритет врагов, которые уже атакуют ворота' },
        // 5 tempo
        { id: 'speed', g: 'tempo', n: 'Русский разгон', art: 'sun', k: 'speed', v: .86, desc: 'Время броска и нового залпа −14%' },
        { id: 'hurry', g: 'tempo', n: 'После боя — бегом', art: 'sun', k: 'hurry', v: .10, desc: 'Убийства временно ускоряют броски' },
        { id: 'extraRoll', g: 'tempo', n: 'Кость-непоседа', art: 'star', k: 'extraRoll', v: .10, desc: '10% шанс повторить удачный залп' },
        { id: 'draw', g: 'tempo', n: 'Быстрый колчан', art: 'bow', k: 'draw', v: .22, desc: 'Сокращает задержку между стрелами' },
        { id: 'opening', g: 'tempo', n: 'Первый квас', art: 'sun', k: 'opening', v: .25, desc: '+25% урона по врагам свежей волны' },
        // 6 survival
        { id: 'hp', g: 'survival', n: 'Богатырская каша', art: 'hearts', k: 'hp', v: 24, desc: '+24 к максимуму здоровья и лечит' },
        { id: 'heal', g: 'survival', n: 'Квасная передышка', art: 'hearts', k: 'heal', v: 34, desc: 'Восстановить 34 здоровья' },
        { id: 'regen', g: 'survival', n: 'Отвар Добрыни', art: 'hearts', k: 'regen', v: .38, desc: 'Постоянно восстанавливает здоровье' },
        { id: 'armor', g: 'survival', n: 'Подкольчужный тулуп', art: 'shield', k: 'armor', v: .12, desc: 'Меньше входящего урона русу' },
        { id: 'leech', g: 'survival', n: 'Живительная стрела', art: 'hearts', k: 'leech', v: .065, desc: 'Удары лечат стрелка на долю урона' },
        { id: 'gateHeal', g: 'survival', n: 'Берестяная заплатка', art: 'shield', k: 'gateHeal', v: 24, desc: 'Починка ворот на 24 прочности' },
        // 5 economy
        { id: 'gold', g: 'economy', n: 'Ящерный налог', art: 'coin', k: 'gold', v: 36, desc: '+36 золота немедленно' },
        { id: 'xp', g: 'economy', n: 'Летопись побед', art: 'coin', k: 'xp', v: 20, desc: '+20 общего опыта немедленно' },
        { id: 'bounty', g: 'economy', n: 'Премия за хвосты', art: 'coin', k: 'bounty', v: .22, desc: 'Убийства приносят больше золота' },
        { id: 'wisdom', g: 'economy', n: 'Учёные русы', art: 'star', k: 'wisdom', v: .20, desc: 'Убийства приносят больше опыта' },
        { id: 'income', g: 'economy', n: 'Княжья рента', art: 'coin', k: 'income', v: .30, desc: 'Постоянный приток золота каждую секунду' },
        // 6 squad
        { id: 'teamDamage', g: 'squad', n: 'Дружинный клич', art: 'sword', k: 'teamDamage', v: .22, desc: 'Все нынешние лучники получают +урон' },
        { id: 'teamSpeed', g: 'squad', n: 'Песня Бояна', art: 'sun', k: 'teamSpeed', v: .94, desc: 'Все нынешние лучники бросают быстрее' },
        { id: 'teamHealth', g: 'squad', n: 'Родовая броня', art: 'shield', k: 'teamHealth', v: 12, desc: 'Все нынешние лучники получают здоровье' },
        { id: 'teamHeal', g: 'squad', n: 'Круг кваса', art: 'hearts', k: 'teamHeal', v: 20, desc: 'Лечение каждому русу в дозоре' },
        { id: 'synergy', g: 'squad', n: 'Братская связь', art: 'star', k: 'synergy', v: .05, desc: 'Урон усиливается за союзников того же класса' },
        { id: 'aura', g: 'squad', n: 'Плечом к плечу', art: 'shield', k: 'aura', v: .08, desc: 'Соседние русы усиливают урон друг друга' },
        // 4 relic and fortune
        { id: 'relicLuck', g: 'relic', n: 'Слёзы шамана', art: 'star', k: 'relicLuck', v: .09, desc: 'Шанс выпадения реликвий с магов выше' },
        { id: 'relicPower', g: 'relic', n: 'Священный чехол', art: 'star', k: 'relicPower', v: .18, desc: 'Дополнительный урон, если надета реликвия' },
        { id: 'relicGuard', g: 'relic', n: 'Оберег в обереге', art: 'shield', k: 'relicGuard', v: .10, desc: 'Дополнительная защита при надетой реликвии' },
        { id: 'relicCoin', g: 'relic', n: 'Налог на идолов', art: 'coin', k: 'relicCoin', v: .25, desc: 'Маги при гибели дают больше золота' }
    ];
    const CARD_TIER_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
    const CARD_TIERS = { common: { name: 'Обычная', chance: .54, mult: .60 }, uncommon: { name: 'Необычная', chance: .26, mult: .85 }, rare: { name: 'Редкая', chance: .13, mult: 1.12 }, epic: { name: 'Эпическая', chance: .055, mult: 1.5 }, legendary: { name: 'Легендарная', chance: .015, mult: 2.15 } };
    const RARITY_BY_ID = { one10: 'epic', two5: 'rare', three3: 'uncommon', six1: 'common', two7: 'epic', weak7: 'rare', strong5: 'rare', fate: 'legendary', damage: 'uncommon', facePowerOne: 'common', facePowerPair: 'uncommon', facePowerThree: 'rare', facePowerAll: 'epic', facePowerWeak: 'rare', facePowerStrong: 'epic', mult: 'epic', crit: 'uncommon', critPower: 'rare', shred: 'rare', execute: 'uncommon', hunters: 'uncommon', pierce: 'epic', bounce: 'rare', split: 'legendary', salvo: 'rare', poison: 'uncommon', burn: 'rare', slow: 'common', stun: 'rare', vulnerable: 'rare', fear: 'common', extraRoll: 'legendary', opening: 'rare', hp: 'common', regen: 'uncommon', leech: 'epic', gateHeal: 'uncommon', gold: 'common', xp: 'common', income: 'rare', teamDamage: 'epic', teamSpeed: 'rare', teamHealth: 'uncommon', teamHeal: 'common', synergy: 'legendary', aura: 'epic', relicLuck: 'rare', relicPower: 'epic', relicGuard: 'uncommon', relicCoin: 'common', odd2: 'common', even2: 'common', velocity: 'common', width: 'common', focusHeavy: 'common', focusMage: 'common', focusFast: 'common', focusLow: 'common', focusGate: 'common', speed: 'common', hurry: 'common', draw: 'common', heal: 'common', armor: 'common', bounty: 'common', wisdom: 'common' };
    function chooseCardTier() {
        const fate = metaBonus('fate'), runeskin = metaLevel('runeskin'), fortune2 = metaLevel('fortune2'), weights = { common: CARD_TIERS.common.chance, uncommon: CARD_TIERS.uncommon.chance, rare: CARD_TIERS.rare.chance, epic: CARD_TIERS.epic.chance, legendary: CARD_TIERS.legendary.chance };
        weights.common -= fate * .015 + runeskin * .02 + fortune2 * .01;
        weights.uncommon += runeskin * .02;
        weights.rare += fate * .0075 + fortune2 * .01;
        weights.epic += fate * .0045;
        weights.legendary += fate * .003;
        const entries = CARD_TIER_ORDER.map(id => [id, Math.max(0, weights[id])]), total = entries.reduce((sum, [, weight]) => sum + weight, 0);
        let tierRoll = Math.random() * total;
        for (const [id, weight] of entries) {
            tierRoll -= weight;
            if (tierRoll < 0)
                return id;
        }
        return entries.at(-1)?.[0] || 'common';
    }
    function scaledValue(v, tier, k) { if (typeof v !== 'number')
        return v; const q = CARD_TIERS[tier].mult; if (k === 'speed' || k === 'teamSpeed')
        return Math.max(.55, 1 - (1 - v) * q); if (['faceSet', 'faceIndices', 'weakFace', 'strongFace', 'hp', 'heal', 'teamHealth', 'teamHeal', 'gateHeal', 'gold', 'xp'].includes(k))
        return Math.max(1, Math.round(v * q)); return Number((v * q).toFixed(3)); }
    function pickUnique(n) { const a = [...FACE_INDICES]; for (let i = 5; i > 0; i--) {
        const j = Math.floor(rand(0, i + 1)), left = requiredAt(a, i), right = requiredAt(a, j);
        a[i] = right;
        a[j] = left;
    } return a.slice(0, n); }
    function linesFromChanges(a, changes) { return changes.map(ch => ({ sig: faceSymbolFor(a, ch.face), from: '×' + a.faces[ch.face], to: '×' + (a.faces[ch.face] + ch.plus), stat: 'залпы' })); }
    function damageCardFaces(a, kind) { const ids = pickUnique(6); if (kind === 'facePowerOne')
        return ids.slice(0, 1); if (kind === 'facePowerPair')
        return ids.slice(0, 2); if (kind === 'facePowerThree')
        return ids.slice(0, 3); if (kind === 'facePowerAll')
        return [...FACE_INDICES]; const values = FACE_INDICES.map(i => displayedShotDamage(a, i)); const n = kind === 'facePowerWeak' ? Math.min(...values) : Math.max(...values), index = values.indexOf(n); return isFaceIndex(index) ? [index] : []; }
    function linesFromDamageChanges(a, changes) { return changes.map(ch => ({ sig: faceSymbolFor(a, ch.face), from: '⚔' + formatDamage(displayedShotDamage(a, ch.face)), to: '⚔' + formatDamage(displayedShotDamage(a, ch.face) * (1 + ch.plus)), stat: 'урон' })); }
    const MODIFIER_KEYS = ['mult', 'crit', 'critPower', 'shred', 'execute', 'boss', 'velocity', 'pierce', 'width', 'bounce', 'split', 'salvo', 'poison', 'burn', 'slow', 'stun', 'vulnerable', 'fear', 'hurry', 'extraRoll', 'draw', 'opening', 'bias', 'regen', 'armor', 'leech', 'bounty', 'wisdom', 'income', 'synergy', 'aura', 'relicLuck', 'relicPower', 'relicGuard', 'relicCoin'];
    function modifierDefaults() { return { mult: 0, crit: 0, critPower: 0, shred: 0, execute: 0, boss: 0, velocity: 0, pierce: 0, width: 0, bounce: 0, split: 0, salvo: 0, poison: 0, burn: 0, slow: 0, stun: 0, vulnerable: 0, fear: 0, hurry: 0, extraRoll: 0, draw: 0, opening: 0, bias: 0, regen: 0, armor: 0, leech: 0, bounty: 0, wisdom: 0, income: 0, synergy: 0, aura: 0, relicLuck: 0, relicPower: 0, relicGuard: 0, relicCoin: 0 }; }
    function hasOwnKey(object, key) { return Object.prototype.hasOwnProperty.call(object, key); }
    function generateOption(kind, slot) {
        const personal = kind === 'personal', chosen = personal && slot !== null ? state.archers.find(a => a.slot === slot) : undefined;
        if (personal && !chosen)
            throw Error('Cannot create a personal upgrade without an archer');
        const klass = personal && chosen ? chosen.klass : 'all', roster = personal && chosen ? [chosen] : state.archers, target = roster[Math.floor(rand(0, roster.length))];
        let eligible = CARD_TEMPLATES.filter(c => personal ? !(['squad'].includes(c.g) || ['gateHeal', 'gold', 'income', 'teamDamage', 'teamSpeed', 'teamHealth', 'teamHeal'].includes(c.k)) : ((c.g === 'squad' || ['gateHeal', 'gold', 'income', 'bounty'].includes(c.k))));
        eligible = eligible.filter(c => !(c.k === 'pierce' && klass === 'short'));
        if (!eligible.length)
            eligible = CARD_TEMPLATES.slice(0, 6);
        const chosenTier = chooseCardTier(), pool = eligible.filter(c => RARITY_BY_ID[c.id] === chosenTier), candidates = pool.length ? pool : eligible, tpl = candidates[Math.floor(rand(0, candidates.length))];
        if (!tpl)
            throw Error('No eligible card templates are available');
        if (!target && klass !== 'all')
            throw new Error('Cannot create a personal upgrade without an archer');
        const tier = RARITY_BY_ID[tpl.id], base = { tier, color: klass === 'all' ? '#f2db9c' : CLASSES[target?.klass ?? 'medium'].color, name: tpl.n, art: tpl.art, changes: [], damageChanges: [], lines: [], note: tpl.desc };
        const scope = klass === 'all' ? 'team' : 'personal';
        let o;
        let strength;
        if (tpl.k === 'target') {
            const targetMode = tpl.v;
            strength = targetMode;
            if (scope === 'team')
                o = { ...base, card: { ...tpl, v: targetMode }, scope };
            else if (target)
                o = { ...base, card: { ...tpl, v: targetMode }, scope, slot: target.slot };
            else
                throw Error('Cannot create an upgrade without an eligible archer');
        }
        else {
            const scaled = scaledValue(tpl.v, tier, tpl.k);
            strength = scaled;
            if (scope === 'team')
                o = { ...base, card: { ...tpl, v: scaled }, scope };
            else if (target)
                o = { ...base, card: { ...tpl, v: scaled }, scope, slot: target.slot };
            else
                throw Error('Cannot create an upgrade without an eligible archer');
        }
        const ids = pickUnique(6);
        if (typeof strength === 'number' && target && tpl.k === 'faceSet')
            o.changes = ids.slice(0, tpl.faces).map(face => ({ face, plus: strength }));
        if (typeof strength === 'number' && target && tpl.k === 'faceIndices')
            o.changes = tpl.indices.map(face => ({ face, plus: strength }));
        if (typeof strength === 'number' && target && tpl.k === 'weakFace') {
            const min = Math.min(...target.faces), face = target.faces.indexOf(min);
            if (isFaceIndex(face))
                o.changes = [{ face, plus: strength }];
        }
        if (typeof strength === 'number' && target && tpl.k === 'strongFace') {
            const max = Math.max(...target.faces), face = target.faces.indexOf(max);
            if (isFaceIndex(face))
                o.changes = [{ face, plus: strength }];
        }
        if (o.changes.length && target)
            o.lines = linesFromChanges(target, o.changes);
        if (typeof strength === 'number' && target && tpl.k.startsWith('facePower')) {
            const affected = damageCardFaces(target, tpl.k);
            o.damageChanges = affected.map(face => ({ face, plus: strength }));
            o.lines = linesFromDamageChanges(target, o.damageChanges);
        }
        return o;
    }
    function relicInfo(id) { const r = RELICS.find(z => z.id === id); return r ? `${r.name} — ${r.desc}` : 'Пустая ячейка'; }
    function relicTable(a) { const items = a.relics.slice(0, 6); return items.length ? items.map((id, i) => `${i + 1}. ${relicInfo(id)}`).join('  ·  ') : 'Реликвий пока нет. Здесь будут все 6 ячеек с описанием.'; }
    function optionScore(o) {
        let score = 0;
        const tier = { common: 1, uncommon: 2, rare: 4, epic: 6, legendary: 8 }, kind = o.card.k, recipients = o.scope === 'team' ? state.archers : state.archers.filter(a => a.slot === o.slot);
        score += tier[o.tier] * 10;
        if (kind === 'heal' || kind === 'teamHeal') {
            const missing = recipients.reduce((sum, a) => sum + Math.max(0, a.maxHp - a.hp), 0), max = recipients.reduce((sum, a) => sum + a.maxHp, 0);
            if (missing < 1)
                return -100;
            score += 25 * missing / Math.max(1, max);
        }
        if (kind === 'gateHeal') {
            const missing = maxGate() - state.lives;
            if (missing < 1)
                return -100;
            score += 25 * missing / maxGate();
        }
        if ((kind === 'speed' || kind === 'teamSpeed') && recipients.length && recipients.every(a => a.speed >= 6))
            return -100;
        if (kind === 'mult' && recipients.length && recipients.every(a => a.mods.mult >= 3))
            return -100;
        if (kind === 'crit' && recipients.length && recipients.every(a => a.mods.crit >= .75))
            return -100;
        if (kind === 'damage' || kind === 'teamDamage')
            score += 18;
        if (kind === 'speed' || kind === 'teamSpeed')
            score += 14;
        if (kind === 'mult')
            score += 20;
        if (kind === 'crit' || kind === 'critPower')
            score += 10;
        if (kind === 'faceSet' || kind === 'weakFace' || kind === 'strongFace' || kind === 'faceIndices')
            score += 8 + o.changes.reduce((sum, change) => sum + change.plus, 0);
        if (kind.startsWith('facePower'))
            score += 9 + o.damageChanges.length * 2;
        if (kind === 'hp' || kind === 'teamHealth' || kind === 'heal' || kind === 'teamHeal')
            score += 4;
        if (kind === 'gold' || kind === 'income')
            score += state.archers.length < SLOT_IDS.length ? 20 : 2;
        if (kind === 'xp')
            score += 6;
        return score;
    }
    function chooseAutoUpgrade() { const phase = currentPhase(); if (phase.mode !== 'upgrade')
        return; const [first, second] = phase.modal.options; chooseUpgrade(optionScore(second) > optionScore(first) ? 1 : 0); }
    function recruitScore(slot, candidate) { const a = newArcher(slot, candidate.klass, candidate.name, candidate), diversity = state.archers.some(other => other.klass === candidate.klass) ? 1 : 1.08; return estimateDps(a) * diversity + a.maxHp * .012; }
    function relicScore(a, id) {
        const dps = estimateDps(a), hurt = 1 - clamp(a.hp / Math.max(1, a.maxHp), 0, 1), risk = 1 + hurt * 2;
        if (id === 'perun')
            return dps * .28;
        if (id === 'boots')
            return dps * .18;
        if (id === 'quiver')
            return dps * 12 / Math.max(6, a.faces.reduce((sum, value) => sum + value, 0));
        if (id === 'kvass')
            return (3 + 30 / Math.max(20, a.maxHp) * dps * .25) * risk;
        return (2 + dps * .12) * risk * Math.pow(.7, relicCount(a, 'amulet'));
    }
    function autoManage() {
        const mode = state.controlMode;
        if (mode === 'manual' || mode === 'shooting' || state.phase.mode !== 'playing')
            return;
        const automaticRoster = mode === 'quartermaster' || mode === 'full', automaticUpgrades = mode === 'full';
        const vacant = SLOT_IDS.filter(slot => !state.archers.some(a => a.slot === slot)).sort((a, b) => SLOTS[a].price - SLOTS[b].price);
        const affordable = vacant.find(slot => state.gold >= SLOTS[slot].price);
        if (affordable !== undefined && state.elapsed >= autoRecruitRetryAt) {
            openRecruit(affordable);
            const phase = currentPhase();
            if (automaticRoster && phase.mode === 'recruit') {
                let best = 0, bestScore = -Infinity;
                phase.modal.options.forEach((candidate, i) => { const score = recruitScore(affordable, candidate); if (score > bestScore) {
                    bestScore = score;
                    best = i;
                } });
                recruitChoice(best);
            }
            return;
        }
        if (state.xp >= state.xpNeeded) {
            showNextLevel('team');
            if (automaticUpgrades)
                chooseAutoUpgrade();
            return;
        }
        const ready = state.archers.find(a => a.xp >= a.xpNeeded);
        if (ready) {
            showNextLevel('personal', ready.slot);
            if (automaticUpgrades)
                chooseAutoUpgrade();
            return;
        }
        const relic = state.relics[0], eligible = state.archers.filter(a => a.relics.length < 6);
        if (relic && eligible.length && state.elapsed >= autoEquipRetryAt) {
            openEquip(0);
            if (automaticRoster && currentMode() === 'equip') {
                eligible.sort((a, b) => relicScore(b, relic) - relicScore(a, relic));
                const recipient = eligible[0];
                if (recipient)
                    equipRelic(recipient.slot);
            }
            return;
        }
        // Do not spend gold on training until every slot is occupied.
        if (vacant.length || !automaticRoster)
            return;
        for (const a of state.archers.slice().sort((l, r) => boostPrice(l) - boostPrice(r))) {
            const price = boostPrice(a);
            if (price > 0 && state.gold >= price * 1.45) {
                boostArcher(a.slot);
                if (automaticUpgrades)
                    chooseAutoUpgrade();
                return;
            }
        }
    }
    function applyOption(o) {
        const a = o.scope === 'personal' ? state.archers.find(archer => archer.slot === o.slot) : undefined;
        const recipients = o.scope === 'team' ? [...state.archers] : a ? [a] : [];
        if (o.card.k === 'target') {
            for (const archer of recipients)
                archer.targetMode = o.card.v;
            return;
        }
        const amount = o.card.v, kind = o.card.k;
        if (kind === 'gold') {
            state.gold += amount;
            return;
        }
        if (kind === 'xp') {
            if (a)
                giveMemberXP(a, amount);
            return;
        }
        if (kind === 'gateHeal') {
            state.lives = Math.min(maxGate(), state.lives + amount);
            return;
        }
        for (const t of recipients) {
            if (o.changes.length) {
                for (const c of o.changes)
                    t.faces[c.face] += c.plus;
                continue;
            }
            if (o.damageChanges?.length) {
                for (const c of o.damageChanges)
                    t.faceDamage[c.face] *= 1 + c.plus;
                continue;
            }
            if (kind === 'damage') {
                t.damage += amount;
                continue;
            }
            if (kind === 'speed') {
                t.speed = Math.min(6, t.speed / Math.max(.55, amount));
                continue;
            }
            if (kind === 'hp' || kind === 'teamHealth') {
                t.maxHp += amount;
                t.hp += amount;
                continue;
            }
            if (kind === 'heal' || kind === 'teamHeal') {
                t.hp = Math.min(t.maxHp, t.hp + amount);
                continue;
            }
            if (kind === 'teamDamage') {
                t.damage += amount;
                continue;
            }
            if (kind === 'teamSpeed') {
                t.speed = Math.min(6, t.speed / Math.max(.55, amount));
                continue;
            }
            if (kind === 'draw') {
                t.shotDelayMult = Math.max(.36, (t.shotDelayMult || 1) * (1 - amount));
                continue;
            }
            const key = kind === 'mult' ? 'mult' : kind;
            if (hasOwnKey(t.mods, key))
                t.mods[key] += amount;
        }
    }
    function memberXpNeeded(level) { return Math.round(12 + level * 5.5); }
    // One team level costs roughly five personal levels' worth of earned XP,
    // but it's a continuous pool, not a rigid every-fifth-level rule.
    function teamXpNeeded(level) { return Math.min(5.7, 4.45 + .22 * (level - 1)); }
    function giveMemberXP(a, amount) {
        if (!state.archers.includes(a) || !Number.isFinite(amount) || amount <= 0)
            return;
        const credited = amount * (1 + metaLevel('study') * .06 + metaLevel('mentor') * .05);
        a.xp += credited;
        // Normalized earned XP. Team requirements ≈ 4.5–5.7 personal levels.
        state.xp += credited / Math.max(1, a.xpNeeded);
    }
    function showNextLevel(kind = 'personal', slot = null) {
        if (state.phase.mode !== 'playing')
            return false;
        if (kind === 'personal' && (slot === null || !isSlotId(slot)))
            return false;
        let a = state.archers.find(archer => archer.slot === slot);
        if (kind === 'personal' && (!a || a.xp + 1e-6 < a.xpNeeded))
            return false;
        if (kind === 'team' && state.xp + 1e-6 < state.xpNeeded)
            return false;
        const targetSlot = kind === 'personal' && slot !== null && isSlotId(slot) ? slot : null;
        if (kind === 'personal' && targetSlot === null)
            return false;
        const first = generateOption(kind, targetSlot);
        let second = generateOption(kind, targetSlot);
        for (let z = 0; z < 12 && first.card.id === second.card.id; z++)
            second = generateOption(kind, targetSlot);
        const options = [first, second];
        if (kind === 'team')
            state.phase = { mode: 'upgrade', modal: { type: 'upgrade', kind: 'team', options } };
        else {
            if (targetSlot === null)
                return false;
            state.phase = { mode: 'upgrade', modal: { type: 'upgrade', kind: 'personal', slot: targetSlot, options } };
        }
        return true;
    }
    function upgrade() { return showNextLevel('team'); }
    function chooseUpgrade(i) {
        const phase = state.phase;
        if (phase.mode !== 'upgrade' || !Number.isInteger(i) || i < 0 || i >= phase.modal.options.length)
            return;
        const modal = phase.modal;
        const o = modal.options[i];
        if (!o)
            return;
        applyOption(o);
        if (modal.kind === 'personal') {
            const owner = state.archers.find(x => x.slot === modal.slot);
            if (owner) {
                owner.xp = Math.max(0, owner.xp - owner.xpNeeded);
                owner.level++;
                owner.xpNeeded = memberXpNeeded(owner.level);
                state.personalLevelCount++;
            }
        }
        else {
            state.xp = Math.max(0, state.xp - state.xpNeeded);
            state.level++;
            state.xpNeeded = teamXpNeeded(state.level);
        }
        state.phase = { mode: 'playing', modal: { type: 'none' } };
        state.last = performance.now();
    }
    function reset() {
        const night = meta.night;
        autoEquipRetryAt = 0;
        autoRecruitRetryAt = 0;
        Object.assign(state, { phase: { mode: 'playing', modal: { type: 'none' } }, elapsed: 0, lives: maxGate(), enemies: [], arrows: [], fx: [], labels: [], nextId: 1, gateFlash: 0, kills: 0, gold: 30 + meta.workshop.gold * 15 + metaBonus('treasury') * 12, archers: [], level: 1, xp: 0, xpNeeded: teamXpNeeded(1), personalLevelCount: 0, wave: 0, spawnQueue: [], spawnDelay: 0, nextWaveAt: 8, last: performance.now(), night, totalWaves: 12 + (night - 1) * 4, waveStreams: [], relics: [], damageNumbers: [], barks: [], barkTimer: 9, spellShots: [], goldMult: 1, bonusRunes: 0 });
        randomizeSlots();
        state.archers = [newArcher(2, 'medium')];
        roll(requiredAt(state.archers, 0));
    }
    function showEnd(win) { if (!['playing', 'upgrade', 'recruit', 'equip'].includes(state.phase.mode))
        return; const bonus = win ? Math.max(0, Math.floor((DURATION - state.elapsed) / 15)) : 0; state.bonusRunes = bonus; state.phase = { mode: win ? 'win' : 'lose', modal: { type: 'none' } }; earnMeta(win, bonus); }
    function pause() { if (state.phase.mode === 'playing') {
        state.phase = { mode: 'paused', modal: { type: 'none' } };
        pauseMessage = requiredAt(PAUSE_LINES, Math.floor(rand(0, PAUSE_LINES.length)));
    }
    else if (state.phase.mode === 'paused') {
        state.phase = { mode: 'playing', modal: { type: 'none' } };
        state.last = performance.now();
    } }
    const trees = [];
    let seed = 73;
    function seeded() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
    for (let i = 0; i < 34; i++) {
        const left = i < 17, tx = left ? 8 + seeded() * 300 : 592 + seeded() * 300, ty = 258 + seeded() * 184;
        trees.push({ x: tx, y: ty, s: .32 + (ty - 258) / 230 * .86 + seeded() * .12, shade: Math.floor(seeded() * 3), variant: Math.floor(seeded() * 6), lean: (seeded() - .5) * .2 });
    }
    trees.sort((a, b) => a.y - b.y);
    const stars = Array.from({ length: 35 }, () => ({ x: seeded() * 900, y: seeded() * 143, r: seeded() * 1.8 + .5 }));
    let characterOutline = false, characterOutlineDepth = 0;
    function inkShape() { ctx.strokeStyle = '#293632'; ctx.lineWidth = 1.1 + characterOutlineDepth * 1.15; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(); }
    function poly(points, fill) { if (points.length === 0)
        return; const first = requiredAt(points, 0); ctx.beginPath(); ctx.moveTo(first[0], first[1]); for (let i = 1; i < points.length; i++) {
        const point = requiredAt(points, i);
        ctx.lineTo(point[0], point[1]);
    } ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); if (characterOutline)
        inkShape(); }
    function rr(x, y, w, h, r, fill) { ctx.fillStyle = fill; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); if (characterOutline)
        inkShape(); }
    function line(x1, y1, x2, y2, width, color) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineWidth = width; ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.stroke(); }
    function circle(x, y, r, fill) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); if (characterOutline)
        inkShape(); }
    function drawTree(tree) {
        const tones = ['#294441', '#35534b', '#416052'], fill = requiredAt(tones, tree.shade), edge = tree.shade === 0 ? '#263f3d' : '#2c4842', depth = clamp((tree.y - 258) / 184, 0, 1), outline = (.65 + depth * 1.15) / tree.s;
        ctx.save();
        ctx.translate(tree.x, tree.y);
        ctx.rotate(tree.lean);
        ctx.scale(tree.s, tree.s);
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.strokeStyle = edge;
        ctx.lineWidth = outline;
        const trunk = tree.variant === 5 ? '#766e59' : '#5b5948';
        if (tree.variant === 0 || tree.variant === 3) {
            rr(-4, -11, 8, 20, 2, trunk);
            const tiers = tree.variant === 3 ? 4 : 3;
            for (let i = 0; i < tiers; i++) {
                const top = -84 + i * 18, w = tree.variant === 3 ? 17 + i * 4 : 19 + i * 7, bottom = -49 + i * 18;
                ctx.beginPath();
                ctx.moveTo(tree.variant === 3 ? -4 : 0, top);
                ctx.bezierCurveTo(-8, top + 10, -w * .45, top + 12, -w * .56, bottom);
                ctx.quadraticCurveTo(0, bottom + 5, w * .56, bottom);
                ctx.bezierCurveTo(w * .45, top + 12, 8, top + 10, tree.variant === 3 ? 4 : 0, top);
                ctx.closePath();
                ctx.fillStyle = i === 1 && tree.shade === 1 ? '#49675a' : fill;
                ctx.fill();
                ctx.stroke();
            }
        }
        else if (tree.variant === 1) {
            rr(-4, -10, 8, 20, 2, trunk);
            ctx.beginPath();
            ctx.moveTo(0, -89);
            ctx.bezierCurveTo(-11, -79, -32, -57, -35, -33);
            ctx.bezierCurveTo(-37, -17, -19, -9, 0, -12);
            ctx.bezierCurveTo(19, -9, 37, -19, 34, -34);
            ctx.bezierCurveTo(31, -58, 11, -80, 0, -89);
            ctx.closePath();
            ctx.fillStyle = fill;
            ctx.fill();
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(-27, -37);
            ctx.quadraticCurveTo(0, -28, 27, -37);
            ctx.strokeStyle = 'rgba(150,179,137,.42)';
            ctx.lineWidth = outline * .68;
            ctx.stroke();
        }
        else if (tree.variant === 2 || tree.variant === 4) {
            rr(-4, -11, 8, 20, 2, trunk);
            const blobs = tree.variant === 2 ? [[-20, -55, 21], [-2, -68, 24], [19, -53, 22], [0, -43, 26]] : [[-24, -48, 22], [-8, -66, 24], [14, -64, 22], [28, -47, 19], [1, -43, 27]];
            for (const [x, y, r] of blobs) {
                circle(x, y, r, fill);
                ctx.strokeStyle = edge;
                ctx.lineWidth = outline;
                ctx.stroke();
            }
            ctx.strokeStyle = 'rgba(154,181,138,.42)';
            ctx.lineWidth = outline * .72;
            line(-20, -51, -9, -57, outline * .72, 'rgba(154,181,138,.42)');
            line(0, -60, 13, -55, outline * .72, 'rgba(154,181,138,.42)');
        }
        else {
            rr(-3, -12, 6, 22, 2, trunk);
            rr(-2, -82, 4, 68, 1, '#8e896d');
            for (const mark of [-65, -49, -31])
                line(-2, mark, 2, mark + 2, outline * .85, '#534f43');
            for (const [x, y, r] of [[-19, -64, 17], [0, -75, 19], [18, -62, 17], [-3, -50, 22]]) {
                circle(x, y, r, fill);
                ctx.strokeStyle = edge;
                ctx.lineWidth = outline;
                ctx.stroke();
            }
        }
        ctx.restore();
    }
    function drawForestMasses() { ctx.save(); ctx.globalAlpha = .48; for (const side of [-1, 1])
        for (let i = 0; i < 6; i++) {
            const x = side < 0 ? 34 + i * 48 : 866 - i * 48, y = 278 + (i % 3) * 12, r = 37 + (i % 2) * 11;
            ctx.fillStyle = i % 2 ? '#315047' : '#2d4946';
            ctx.beginPath();
            ctx.ellipse(x, y, r, r * .38, -.12 * side, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(x + side * r * .52, y + 5, r * .68, r * .32, .08, 0, Math.PI * 2);
            ctx.fill();
        } ctx.restore(); }
    function roadHalf(y) { return 10 + Math.pow(clamp((y - 238) / 302, 0, 1), 1.45) * 100; }
    function roadSamples() { const path = [[[450, 236], [431, 266], [473, 286], [450, 316]], [[450, 316], [425, 346], [476, 371], [450, 405]], [[450, 405], [425, 450], [481, 495], [450, 540]]], out = []; for (const [p0, p1, p2, p3] of path) {
        for (let i = 0; i < 32; i++) {
            const u = i / 32, v = 1 - u, x = v * v * v * p0[0] + 3 * v * v * u * p1[0] + 3 * v * u * u * p2[0] + u * u * u * p3[0], y = v * v * v * p0[1] + 3 * v * v * u * p1[1] + 3 * v * u * u * p2[1] + u * u * u * p3[1];
            out.push([x, y]);
        }
    } out.push([450, 540]); return out; }
    function drawRoad(scale, offset, fill) { const points = roadSamples(), left = [], right = []; for (let i = 0; i < points.length; i++) {
        const [x, y] = requiredAt(points, i), before = requiredAt(points, Math.max(0, i - 1)), after = requiredAt(points, Math.min(points.length - 1, i + 1)), dx = after[0] - before[0], dy = after[1] - before[1], len = Math.hypot(dx, dy) || 1, half = Math.max(2, roadHalf(y) * scale + offset);
        left.push([x - dy / len * half, y + dx / len * half]);
        right.push([x + dy / len * half, y - dx / len * half]);
    } ctx.beginPath(); const first = requiredAt(left, 0); ctx.moveTo(first[0], first[1]); for (const p of left.slice(1))
        ctx.lineTo(p[0], p[1]); for (const p of right.slice().reverse())
        ctx.lineTo(p[0], p[1]); ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); }
    const centerline = roadSamples();
    function roadCenterX(y) { for (let i = 1; i < centerline.length; i++) {
        const a = requiredAt(centerline, i - 1), b = requiredAt(centerline, i);
        if (y <= b[1]) {
            const p = clamp((y - a[1]) / (b[1] - a[1] || 1), 0, 1);
            return a[0] + (b[0] - a[0]) * p;
        }
    } return 450; }
    function drawBackground(t) {
        // A clear land-level passage between the mountains and a road disappearing into it.
        const progress = clamp(t / DURATION, 0, 1), dawn = clamp((progress - .36) / .64, 0, 1);
        const gradient = ctx.createLinearGradient(0, 0, 0, 280);
        gradient.addColorStop(0, mixColor('#1b303e', '#8fb0b0', dawn));
        gradient.addColorStop(.63, mixColor('#344d55', '#e4b997', dawn));
        gradient.addColorStop(1, mixColor('#536c66', '#e6c7a2', dawn));
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 900, 300);
        const horizon = ctx.createLinearGradient(0, 210, 0, 540);
        horizon.addColorStop(0, mixColor('#48645b', '#8d9d77', dawn));
        horizon.addColorStop(1, '#3f5a4e');
        ctx.fillStyle = horizon;
        ctx.fillRect(0, 270, 900, 270);
        // The moon travels left across the sky, then sinks as dawn brightens.
        const mx = 760 - progress * 495, my = 57 + Math.sin(progress * Math.PI * .9) * 30 + progress * 80;
        ctx.globalAlpha = 1 - clamp((progress - .60) / .4, 0, 1);
        circle(mx, my, 30, '#e7ddba');
        circle(mx + 9, my - 8, 28, mixColor('#1b303e', '#8fb0b0', dawn));
        ctx.globalAlpha = 1;
        for (const st of stars) {
            ctx.globalAlpha = (1 - dawn) * .8;
            circle(st.x, st.y, st.r, '#a6bbb2');
        }
        ctx.globalAlpha = 1;
        // A sunrise, not a timer bar.
        if (dawn > .56) {
            ctx.globalAlpha = (dawn - .56) / .44 * .83;
            circle(635, 251 - (dawn - .56) * 68, 38, '#ffe2ae');
            ctx.globalAlpha = 1;
        }
        // Rounded, layered mountain silhouettes leave a clear saddle around the road.
        ctx.beginPath();
        ctx.moveTo(0, 238);
        ctx.bezierCurveTo(56, 214, 91, 220, 145, 181);
        ctx.bezierCurveTo(193, 145, 226, 218, 278, 197);
        ctx.bezierCurveTo(328, 176, 356, 222, 408, 235);
        ctx.bezierCurveTo(450, 241, 477, 235, 516, 226);
        ctx.bezierCurveTo(568, 208, 603, 155, 650, 178);
        ctx.bezierCurveTo(699, 205, 733, 150, 778, 170);
        ctx.bezierCurveTo(825, 194, 864, 160, 900, 188);
        ctx.lineTo(900, 300);
        ctx.lineTo(0, 300);
        ctx.closePath();
        ctx.fillStyle = '#4f6868';
        ctx.fill();
        ctx.strokeStyle = '#5b716d';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, 238);
        ctx.bezierCurveTo(56, 214, 91, 220, 145, 181);
        ctx.bezierCurveTo(193, 145, 226, 218, 278, 197);
        ctx.bezierCurveTo(328, 176, 356, 222, 408, 235);
        ctx.bezierCurveTo(450, 241, 477, 235, 516, 226);
        ctx.bezierCurveTo(568, 208, 603, 155, 650, 178);
        ctx.bezierCurveTo(699, 205, 733, 150, 778, 170);
        ctx.bezierCurveTo(825, 194, 864, 160, 900, 188);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, 270);
        ctx.lineTo(0, 210);
        ctx.bezierCurveTo(35, 193, 51, 159, 91, 180);
        ctx.bezierCurveTo(126, 135, 144, 111, 176, 150);
        ctx.bezierCurveTo(210, 190, 242, 209, 275, 177);
        ctx.bezierCurveTo(311, 149, 345, 191, 374, 224);
        ctx.bezierCurveTo(390, 242, 397, 250, 405, 270);
        ctx.closePath();
        ctx.fillStyle = '#364f53';
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(495, 270);
        ctx.bezierCurveTo(506, 246, 521, 229, 543, 209);
        ctx.bezierCurveTo(576, 181, 600, 132, 634, 148);
        ctx.bezierCurveTo(673, 164, 687, 206, 722, 182);
        ctx.bezierCurveTo(756, 157, 771, 117, 800, 144);
        ctx.bezierCurveTo(831, 170, 862, 143, 900, 159);
        ctx.lineTo(900, 276);
        ctx.closePath();
        ctx.fillStyle = '#364e51';
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(7, 211);
        ctx.bezierCurveTo(42, 183, 50, 157, 91, 180);
        ctx.bezierCurveTo(126, 135, 144, 111, 176, 150);
        ctx.bezierCurveTo(157, 143, 139, 155, 121, 192);
        ctx.bezierCurveTo(82, 178, 49, 181, 7, 226);
        ctx.closePath();
        ctx.fillStyle = '#5b7370';
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(563, 192);
        ctx.bezierCurveTo(592, 164, 611, 134, 634, 148);
        ctx.bezierCurveTo(651, 157, 651, 166, 665, 175);
        ctx.bezierCurveTo(629, 165, 600, 187, 580, 207);
        ctx.closePath();
        ctx.fillStyle = '#60746f';
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(771, 160);
        ctx.bezierCurveTo(781, 137, 791, 128, 800, 144);
        ctx.bezierCurveTo(807, 154, 803, 159, 814, 165);
        ctx.bezierCurveTo(797, 158, 785, 163, 771, 177);
        ctx.closePath();
        ctx.fillStyle = '#5d726e';
        ctx.fill();
        // Distant forest reads as joined masses; individual silhouettes start closer to the viewer.
        poly([[0, 250], [145, 238], [268, 254], [357, 244], [411, 238], [488, 238], [567, 247], [674, 240], [900, 255], [900, 540], [0, 540]], '#466052');
        drawForestMasses();
        // The slopes form a rounded pass. The road stays visible above the banks and winds through it.
        poly([[0, 271], [115, 251], [256, 284], [334, 258], [415, 263], [355, 540], [0, 540]], '#3e594f');
        poly([[485, 261], [566, 246], [689, 275], [782, 249], [900, 269], [900, 540], [545, 540]], '#3a554e');
        poly([[0, 342], [93, 323], [182, 352], [283, 328], [327, 365], [354, 540], [0, 540]], '#435e50');
        poly([[573, 347], [628, 318], [742, 357], [900, 313], [900, 540], [546, 540]], '#405a4f');
        drawRoad(1, 8, '#665e4d');
        drawRoad(1, 0, '#a08d6b');
        drawRoad(.62, -1, '#b6a47e');
        // Gravel perspective: tiny marks in the far distance, larger near the viewer.
        for (let i = 0; i < 27; i++) {
            const y = 263 + i * 9.9, spread = roadHalf(y) * .75;
            const x = roadCenterX(y) + Math.sin(i * 8.11) * spread;
            line(x, y, x + 2 + (y - 240) / 130, y + 1 + (y - 240) / 185, 1 + (y - 240) / 140, '#938469');
        }
        // Split-toe tracks curve along the road, small in the distance and clearer near the gate.
        for (let i = 0; i < 7; i++) {
            const y = 294 + i * 17, x = roadCenterX(y) + Math.sin(i * 1.9) * roadHalf(y) * .23, r = .75 + (y - 290) / 95;
            ctx.save();
            ctx.globalAlpha = .45;
            ctx.fillStyle = '#655e4d';
            for (const side of [-1, 1]) {
                ctx.beginPath();
                ctx.ellipse(x + side * 5, y + (i % 2) * 3, r * 1.6, r, -.32 * side, 0, Math.PI * 2);
                ctx.fill();
                for (let toe = 0; toe < 3; toe++) {
                    ctx.beginPath();
                    ctx.ellipse(x + side * 8 + toe * 2.2, y - 2.8, r * .48, r * .7, -.25, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
            ctx.restore();
        }
        for (const tree of trees)
            drawTree(tree);
        // Near-road rocks and low vegetation make the enemies feel grounded.
        for (let i = 0; i < 24; i++) {
            let y = 266 + i * 10.3, side = i % 2 ? 1 : -1;
            let x = 450 + side * (roadHalf(y) + 13 + Math.abs(Math.sin(i * 13)) * 22);
            circle(x, y, 1.5 + (y - 260) / 125, i % 3 ? '#6c8070' : '#81917a');
            if (i % 3 === 0) {
                line(x - 4, y + 1, x - 7, y - 3, 1.6, '#82987b');
                line(x + 2, y + 1, x + 7, y - 4, 1.6, '#82987b');
            }
        }
        // Water-filled defensive moat: slows enemies before the palisade.
        poly([[0, 415], [320, 414], [350, 430], [550, 430], [590, 414], [900, 415], [900, 448], [565, 447], [545, 451], [356, 451], [332, 447], [0, 448]], '#2e6173');
        for (let i = 0; i < 18; i++) {
            const x = 17 + i * 49, y = 425 + (i % 3) * 6;
            line(x, y, x + 19, y - 1, 1.5, '#70a0a2');
        }
        // Fortress foreground keeps its original clear, simple vector identity.
        rr(0, 446, 354, 63, 2, '#6b5145');
        rr(546, 446, 354, 63, 2, '#6b5145');
        for (let i = 0; i < 18; i++) {
            let x = i * 21 - 2;
            let xr = 550 + i * 21;
            poly([[x, 444], [x + 10, 429], [x + 20, 444], [x + 20, 503], [x, 503]], i % 2 ? '#946d54' : '#a17a5c');
            line(x + 16, 458, x + 16, 501, 2, '#785b4b');
            poly([[xr, 444], [xr + 10, 429], [xr + 20, 444], [xr + 20, 503], [xr, 503]], i % 2 ? '#946d54' : '#a17a5c');
        }
        rr(0, 481, 355, 9, 1, '#58483e');
        rr(545, 481, 355, 9, 1, '#58483e');
        rr(345, 463, 210, 77, 8, '#644b43');
        rr(354, 461, 192, 77, 6, '#87644f');
        for (let i = 0; i < 9; i++)
            line(367 + i * 21, 467, 367 + i * 21, 539, 2, '#aa8164');
        drawGateDamage();
        rr(350, 478, 202, 9, 2, '#b88d66');
        for (let x of [255, 645]) {
            rr(x - 28, 399, 56, 98, 5, '#9e795a');
            line(x - 12, 405, x - 12, 489, 2, '#755948');
            line(x + 13, 405, x + 13, 489, 2, '#755948');
            rr(x - 19, 414, 38, 25, 4, '#526252');
            rr(x - 14, 419, 28, 17, 3, '#e8a666');
            line(x - 20, 451, x + 20, 451, 3, '#c0946d');
            ctx.beginPath();
            ctx.moveTo(x - 42, 405);
            ctx.bezierCurveTo(x - 27, 391, x - 17, 375, x, 367);
            ctx.bezierCurveTo(x + 16, 377, x + 28, 392, x + 42, 405);
            ctx.quadraticCurveTo(x + 19, 400, x, 409);
            ctx.quadraticCurveTo(x - 19, 400, x - 42, 405);
            ctx.closePath();
            ctx.fillStyle = '#9e665c';
            ctx.fill();
            ctx.strokeStyle = '#3d3934';
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(x - 29, 398);
            ctx.quadraticCurveTo(x - 4, 386, x, 379);
            ctx.quadraticCurveTo(x + 18, 392, x + 31, 400);
            ctx.quadraticCurveTo(x + 15, 395, x, 402);
            ctx.quadraticCurveTo(x - 15, 395, x - 29, 398);
            ctx.closePath();
            ctx.fillStyle = '#bc8c70';
            ctx.fill();
            line(x, 370, x, 351, 2.5, '#d6ba8b');
            poly([[x, 351], [x + 25, 359], [x, 365]], '#b0bfa5');
        }
        ctx.fillStyle = '#2a3d43';
        ctx.fillRect(0, 518, 900, 22);
        for (let x = 0; x < 900; x += 37)
            line(x, 518, x + 13, 520, 2, '#657667');
        for (let i = 0; i < 22; i++) {
            const x = 15 + i * 42;
            line(x, 533, x - 4, 528, 2, '#799481');
            line(x, 533, x + 5, 525, 2, '#799481');
        }
    }
    function drawGateDamage() {
        const loss = clamp(1 - state.lives / (maxGate()), 0, 1);
        if (state.gateFlash > 0) {
            ctx.save();
            ctx.globalAlpha = (state.gateFlash / .20) * .23;
            rr(353, 461, 194, 78, 6, '#ffac74');
            ctx.restore();
        }
        const cracks = [[[374, 476], [391, 486], [381, 498], [402, 518], [396, 538]], [[423, 467], [412, 480], [428, 498], [415, 512], [426, 538]], [[475, 469], [488, 483], [471, 501], [491, 514], [481, 539]], [[521, 474], [503, 493], [526, 511], [506, 532]], [[383, 511], [367, 521], [390, 535]], [[451, 474], [460, 488], [446, 502], [462, 524], [455, 540]], [[533, 480], [518, 493], [538, 510], [527, 529]], [[496, 469], [486, 486], [500, 499], [489, 518]]];
        const count = Math.ceil(cracks.length * Math.pow(loss, .78));
        ctx.save();
        for (let i = 0; i < count; i++) {
            const points = requiredAt(cracks, i), first = requiredAt(points, 0), second = requiredAt(points, 1);
            ctx.beginPath();
            ctx.moveTo(first[0], first[1]);
            for (let j = 1; j < points.length; j++) {
                const point = requiredAt(points, j);
                ctx.lineTo(point[0], point[1]);
            }
            ctx.strokeStyle = `rgba(13,17,18,${.5 + .48 * loss})`;
            ctx.lineWidth = 2.5 + loss * 2;
            ctx.lineJoin = 'round';
            ctx.stroke();
            if (loss > .35 && i % 2 === 0) {
                ctx.beginPath();
                ctx.moveTo(second[0], second[1]);
                ctx.lineTo(second[0] + 12, second[1] + 5);
                ctx.stroke();
            }
        }
        if (loss > .50) {
            for (let i = 0; i < Math.floor(loss * 7); i++) {
                let x = 365 + i * 25, y = 485 + (i % 2) * 22;
                poly([[x, y], [x + 7, y + 2], [x + 3, y + 9]], '#2a2525');
            }
        }
        if (loss > .80) {
            ctx.fillStyle = `rgba(31,22,21,${(loss - .8) * 1.25})`;
            ctx.fillRect(355, 472, 192, 65);
        }
        ctx.restore();
    }
    function drawOutlinedLimb(x1, y1, x2, y2, width, fill) { line(x1, y1, x2, y2, width + 2.5, '#293632'); line(x1, y1, x2, y2, width, fill); }
    function drawArcher(a, animationTime = state.elapsed, showHealth = true, facing = 1) {
        const x = a.x, y = a.y, ap = a.appearance || randomAppearance(a.klass), sc = (a.klass === 'heavy' ? 1.55 : a.klass === 'short' ? .66 : 1) * ap.height;
        if (a.die.phase === 'rolling') {
            ctx.save();
            ctx.globalAlpha = .72;
            ctx.strokeStyle = CLASSES[a.klass].color;
            ctx.lineWidth = 2.2;
            ctx.setLineDash([4, 3]);
            ctx.beginPath();
            ctx.ellipse(x, y + 4, 18, 7, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
        const pull = a.bowPhase === 'draw' ? bowDrawPull(a) : 0;
        const progress = a.bowPhase === 'release' ? clamp(a.bowPhaseTime / RELEASE_DURATION, 0, 1) : a.bowPhase === 'recover' ? clamp(a.bowPhaseTime / RECOVER_DURATION, 0, 1) : a.bowPhase === 'idle' ? ((animationTime / (8 * BOW_TIMING.idleFrame) + a.slot * .11) % 1 + 1) % 1 : 0;
        const pose = { phase: a.bowPhase, pull, progress, reduced: introReducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches };
        const renderer = window.__archerRig, sprite = renderer?.getPoseImage(a.klass, ap, pose, a.relics);
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(sc * facing, sc);
        if (renderer && sprite?.complete && sprite.naturalWidth > 0) {
            ctx.drawImage(sprite, -48, -88, 124 * renderer.viewWidth / 180, 130);
            ctx.save();
            ctx.translate(14, 4.857142857);
            ctx.scale(124 / 180, 130 / 210);
            renderer.drawShotTracer(ctx, pose, sprite);
            ctx.restore();
        }
        ctx.restore();
        if (showHealth) {
            const hp = a.hp / a.maxHp, hy = y - 73 * sc;
            rr(x - 24, hy, 48, 5, 2, '#24393d');
            rr(x - 24, hy, 48 * clamp(hp, 0, 1), 5, 2, hp < .35 ? '#db7a6f' : '#98d69e');
        }
    }
    function drawKvassPouch(t, lift, sip) { ctx.save(); ctx.translate(0, -lift); ctx.rotate(sip ? -.13 + .05 * Math.sin(t * 7) : 0); poly([[11, 2], [18, -1], [31, 3], [33, 19], [27, 26], [13, 21]], '#a86d43'); line(14, 4, 29, 5, 2, '#ddad69'); rr(18, -5, 9, 8, 2, '#587b55'); rr(20, -8, 5, 4, 1, '#a47a50'); ctx.save(); ctx.font = '800 4.5px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = '#f5dca1'; ctx.fillText('КВАС', 23, 15); ctx.restore(); ctx.restore(); }
    function drawEnemy(e, t) {
        ctx.save();
        ctx.translate(e.x, e.y);
        const look = e.look || randomLizardLook();
        const depth = clamp((e.y - 237) / (447 - 237), 0, 1);
        const scale = (.44 + depth * .56) * (e.kind === 'brute' ? 1.35 : e.kind === 'heavy' ? 1.16 : e.kind === 'swift' ? .79 : e.kind === 'shield' ? 1.1 : 1);
        ctx.save();
        ctx.scale(scale, scale * .36);
        circle(0, 4, 22, '#244135');
        ctx.restore();
        ctx.translate(0, -32 * scale);
        ctx.scale(scale, scale);
        characterOutline = true;
        characterOutlineDepth = depth;
        let bob = e.attacking ? Math.sin(t * 2 + e.phase) * .8 : Math.sin(t * 9 + e.phase) * 2;
        circle(0, 25, 21, '#315540');
        const cloak = e.kind === 'shaman' ? '#91c46b' : e.kind === 'swift' ? '#7ebc6c' : e.kind === 'heavy' ? '#698b57' : e.kind === 'shield' ? '#7aa06f' : e.kind === 'brute' ? '#5c8352' : '#8ab26b';
        poly([[-19, -1], [-25, 30], [25, 30], [18, -1], [0, -19]], cloak);
        poly([[-15, 2], [0, 7], [16, 2], [12, 26], [-12, 26]], e.kind === 'heavy' || e.kind === 'brute' ? '#4f6a48' : '#527252');
        line(-12, 27 + bob, -10, 35 + bob, 7, '#3e5d37');
        line(12, 27 - bob, 10, 35 - bob, 7, '#3e5d37');
        poly([[-20, 8], [-36, 13], [-24, 21], [-11, 16]], '#56764d');
        circle(0, -12, 17, '#8dbb72');
        const sn = look.snout || 1;
        poly([[-18, -11], [-12, -28], [0, -35], [13, -27], [19, -10], [8, -14], [-8, -14]], '#456548');
        poly([[-6, -10], [3 * sn, -20 * look.jaw], [18 * sn, -14], [10, -2], [0, 0]], look.hue === 2 ? '#abd97d' : look.hue === 1 ? '#97ca75' : '#9ed57a');
        line(-2, -22, 4, -24, 2.2, '#3e4e38');
        line(8, -20, 13, -21, 2, '#3e4e38');
        const blink = e.id < 0 && t > 0 && (t + e.id * 1.7) % 9 > 8.86;
        if (blink) {
            line(-2, -18, 4, -18, 2, '#202d27');
            line(8, -17, 13, -17, 2, '#202d27');
        }
        else {
            circle(1, -18, 3.2, '#f5df9e');
            circle(e.id === -1 && introStoryBeat === 'react' ? 3.5 : 2, -18, 1.7, '#202d27');
            circle(10, -17, 2.7, '#f5df9e');
            circle(e.id === -1 && introStoryBeat === 'react' ? 12 : 11, -17, 1.5, '#202d27');
        }
        if (e.id === -1) {
            ctx.beginPath();
            ctx.moveTo(7, -7);
            ctx.quadraticCurveTo(18, -1, 25, -7);
            ctx.quadraticCurveTo(19, 3, 9, -2);
            ctx.closePath();
            ctx.fillStyle = '#522e2c';
            ctx.fill();
            poly([[14, -4], [18, -1], [17, -5]], '#f1dca2');
        }
        if (e.id === -2) {
            const sipping = introStoryBeat === 'sip' && introMood !== 'roll', lift = sipping ? 10 + Math.sin(t * 7) * 2 : introStoryBeat === 'pretend' ? 3 : 0;
            drawOutlinedLimb(5, 8, 11, 1 - lift * .5, 4, '#639054');
            drawOutlinedLimb(11, 1 - lift * .5, 17, -6 - lift, 3, '#639054');
            if (sipping)
                circle(18, -10, 2, '#633d38');
            ctx.save();
            ctx.globalAlpha *= 1 - introHideKvass;
            drawKvassPouch(t, lift, sipping);
            ctx.restore();
        }
        if (look.frill) {
            poly([[-16, -18], [-24, -8], [-20, 2], [-10, -4]], '#7db96f');
        }
        if (look.horn === 1)
            poly([[2, -31], [8, -44], [12, -28]], '#cbe29a');
        if (look.horn === 2) {
            poly([[-5, -32], [0, -44], [5, -31]], '#cbe29a');
            poly([[8, -29], [15, -41], [16, -26]], '#cbe29a');
        }
        circle(7, -12, 2.4, '#152914');
        if (e.kind === 'heavy' || e.kind === 'brute') {
            poly([[-8, -35], [8, -35], [19, -22], [-19, -22]], '#a2c47f');
            rr(-25, 1, 17, 29, 4, '#91a87c');
            line(-17, 7, -17, 23, 2, '#55694d');
        }
        if (e.kind === 'swift') {
            poly([[-27, -7], [-13, -5], [-16, 9]], '#c2da6f');
            poly([[16, -28], [29, -34], [20, -15]], '#ceeb86');
            line(17, 21, 35, 32, 4, '#75b06b');
        }
        if (e.kind === 'shield') {
            rr(-30, -14, 25, 48, 8, '#b8ca86');
            line(-17, -11, -17, 30, 2, '#5a806f');
            line(-27, 0, -7, 0, 2, '#6f9569');
        }
        if (e.kind === 'shaman' || e.kind === 'healer') {
            circle(0, -39, 6, e.kind === 'shaman' ? '#b1f5eb' : '#eff4a4');
            line(-24, 25, -27, -12, 3, e.kind === 'shaman' ? '#81dacf' : '#bde8a4');
            circle(-27, -15, 6, '#d8f0a4');
            if (e.kind === 'healer')
                circle(0, -39, 10, '#bddb74');
        }
        if (e.kind === 'brute') {
            poly([[-28, -29], [-11, -44], [0, -33], [11, -44], [28, -29], [17, -27], [-17, -27]], '#b3d388');
            poly([[-35, 7], [-19, -4], [-31, -18]], '#9fcb75');
            poly([[35, 7], [19, -4], [31, -18]], '#9fcb75');
        }
        if (e.kind === 'heavy') {
            line(21, -12, 32, -48, 4, '#b2bf91');
            poly([[31, -51], [23, -37], [36, -37]], '#e9d9a2');
        }
        if (e.attacking) {
            const strike = e.attackFlash > 0 ? 1 - e.attackFlash / .34 : 0;
            const swing = e.attackFlash > 0 ? Math.sin(strike * Math.PI) : .10 + Math.sin(t * 2.3 + e.phase) * .06;
            line(17, 2, 28 - swing * 12, -4 + swing * 21, 7, '#96ba73');
            line(28 - swing * 12, -4 + swing * 21, 37 - swing * 24, -21 + swing * 40, 3.7, e.kind === 'brute' ? '#bfd39c' : '#d8e6ab');
            if (e.attackFlash > .16)
                line(-9, 24, 9, 24, 3, '#e5aa7e');
        }
        if (e.hp < e.maxHp) {
            rr(-18, -40, 36, 4, 2, '#293d43');
            rr(-18, -40, 36 * e.hp / e.maxHp, 4, 2, '#b7df75');
        }
        if (e.poison > 0 || e.burn > 0) {
            const allBadges = [[e.poison > 0, '#94e9ab', 'poison'], [e.burn > 0, '#ffad69', 'burn']], badges = allBadges.filter(item => item[0]);
            for (let i = 0; i < badges.length; i++) {
                const [, color, type] = requiredAt(badges, i), bx = badges.length === 1 ? 28 : i === 0 ? -28 : 28, by = -38, rrad = 6;
                ctx.save();
                ctx.globalAlpha = .82 + .18 * Math.sin(t * 6 + e.phase);
                ctx.fillStyle = '#223b3b';
                ctx.beginPath();
                ctx.arc(bx, by, rrad, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = color;
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                if (type === 'poison') {
                    ctx.moveTo(bx, by - 3.8);
                    ctx.quadraticCurveTo(bx - 5, by + 2, bx, by + 4);
                    ctx.quadraticCurveTo(bx + 5, by + 2, bx, by - 3.8);
                    ctx.fillStyle = color;
                    ctx.fill();
                }
                else {
                    ctx.moveTo(bx, by + 3.6);
                    ctx.bezierCurveTo(bx - 4, by + 1, bx, by - 1, bx, by - 4);
                    ctx.bezierCurveTo(bx + 4, by - 1, bx + 2, by + 1, bx, by + 3.6);
                    ctx.fillStyle = color;
                    ctx.fill();
                }
                ctx.stroke();
                ctx.restore();
            }
        }
        if (e.id >= 0 && e.attacking && e.attackFlash > .16) {
            ctx.save();
            ctx.font = '900 15px system-ui';
            ctx.textAlign = 'center';
            ctx.lineJoin = 'round';
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#293632';
            ctx.strokeText('!', 0, -55);
            ctx.fillStyle = '#ffd28a';
            ctx.fillText('!', 0, -55);
            ctx.restore();
        }
        ctx.restore();
        characterOutline = false;
        characterOutlineDepth = 0;
    }
    function drawArrow(a) { const owner = a.source, color = owner.mods.burn ? '#ff9e5e' : owner.mods.poison ? '#8ce89e' : a.type === 'pierce' ? '#9fdcc6' : '#f5d7a9', sprite = window.__archerRig?.getProjectileImage(color); if (!sprite?.complete || sprite.naturalWidth === 0)
        return; ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(Math.atan2(a.vy, a.vx) + Math.PI / 2); ctx.scale(a.size, a.size); ctx.drawImage(sprite, -9, -24, 18, 48); ctx.restore(); }
    function drawEffects() {
        for (const f of state.fx) {
            const progress = 1 - clamp(f.life / f.max, 0, 1);
            ctx.globalAlpha = clamp(f.life / f.max, 0, 1);
            if (f.kind === 'ring') {
                const radius = f.r + progress * 18;
                ctx.beginPath();
                ctx.arc(f.x, f.y, radius, 0, Math.PI * 2);
                ctx.strokeStyle = f.color;
                ctx.lineWidth = f.accent === 'hurt' ? 4 : 3;
                ctx.stroke();
                if (f.accent === 'critical') {
                    ctx.save();
                    ctx.translate(f.x, f.y);
                    ctx.rotate(Math.PI / 4);
                    ctx.strokeStyle = '#fff0bc';
                    ctx.lineWidth = 2.5;
                    ctx.strokeRect(-radius * .55, -radius * .55, radius * 1.1, radius * 1.1);
                    ctx.restore();
                    ctx.font = '900 10px system-ui';
                    ctx.textAlign = 'center';
                    ctx.lineWidth = 2;
                    ctx.strokeStyle = '#293632';
                    ctx.strokeText('КРИТ', f.x, f.y - 22);
                    ctx.fillStyle = '#ffe3a0';
                    ctx.fillText('КРИТ', f.x, f.y - 22);
                    ctx.textAlign = 'start';
                }
                else if (f.accent === 'hurt') {
                    ctx.beginPath();
                    ctx.moveTo(f.x - 6, f.y);
                    ctx.lineTo(f.x + 6, f.y);
                    ctx.moveTo(f.x, f.y - 6);
                    ctx.lineTo(f.x, f.y + 6);
                    ctx.strokeStyle = '#ffe0ac';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                }
            }
            else if (f.kind === 'spark')
                circle(f.x, f.y, f.size, f.color);
            else {
                const radius = f.r + progress * 20;
                ctx.save();
                ctx.translate(f.x, f.y);
                ctx.rotate(progress * .6);
                ctx.strokeStyle = f.color;
                ctx.lineWidth = Math.max(1, 3 - progress * 1.5);
                for (let i = 0; i < 4; i++) {
                    ctx.rotate(Math.PI / 2);
                    ctx.beginPath();
                    ctx.moveTo(0, radius * .34);
                    ctx.lineTo(0, radius);
                    ctx.stroke();
                }
                ctx.beginPath();
                ctx.arc(0, 0, Math.max(1, radius * .2), 0, Math.PI * 2);
                ctx.fillStyle = f.color;
                ctx.fill();
                ctx.restore();
            }
        }
        ctx.globalAlpha = 1;
        ctx.textAlign = 'start';
    }
    function drawBarks() { for (const b of state.barks) {
        ctx.globalAlpha = clamp(b.life / .5, 0, 1);
        ctx.font = 'bold 12px system-ui';
        const txt = b.text.length > 45 ? b.text.slice(0, 44) + '…' : b.text;
        const w = Math.min(300, ctx.measureText(txt).width + 18), x = clamp(b.x, 0 + w / 2 + 6, 900 - w / 2 - 6), y = clamp(b.y, 88, 360);
        rr(x - w / 2, y - 34, w, 26, 7, '#203c40');
        ctx.textAlign = 'center';
        ctx.fillStyle = b.who === 'ЯЩЕР' ? '#b5ef8d' : '#f6dfad';
        ctx.fillText(txt, x, y - 17);
    } ctx.globalAlpha = 1; ctx.textAlign = 'start'; }
    function drawIntroFire(x, y, t) { const flicker = .88 + .12 * Math.sin(t * 12 + x); ctx.save(); const glow = ctx.createRadialGradient(x, y - 12, 2, x, y - 12, 54); glow.addColorStop(0, 'rgba(255,174,91,.42)'); glow.addColorStop(1, 'rgba(255,137,71,0)'); ctx.fillStyle = glow; ctx.fillRect(x - 55, y - 70, 110, 110); rr(x - 12, y - 3, 24, 5, 2, '#493a31'); rr(x - 10, y - 7, 20, 4, 2, '#76503b'); ctx.globalAlpha = flicker; ctx.beginPath(); ctx.moveTo(x, y - 8); ctx.bezierCurveTo(x - 13, y - 22, x - 3, y - 31, x, y - 41); ctx.bezierCurveTo(x + 3, y - 31, x + 13, y - 22, x, y - 8); ctx.fillStyle = '#f1a55f'; ctx.fill(); ctx.beginPath(); ctx.moveTo(x, y - 9); ctx.bezierCurveTo(x - 6, y - 19, x - 1, y - 24, x, y - 30); ctx.bezierCurveTo(x + 6, y - 21, x + 5, y - 16, x, y - 9); ctx.fillStyle = '#ffe2a4'; ctx.fill(); ctx.restore(); }
    function drawWatchingEyes(t, alert) {
        const points = [[88, 313], [177, 337], [746, 305], [815, 332]], pulse = .78 + .22 * Math.sin(t * 4.2);
        ctx.save();
        for (let i = 0; i < points.length; i++) {
            const [x, y] = requiredAt(points, i), alpha = (alert ? .82 : .35) * pulse;
            ctx.globalAlpha = alpha;
            ctx.fillStyle = '#1b302d';
            ctx.beginPath();
            ctx.ellipse(x, y, 22, 11, -.08, Math.PI, Math.PI * 2);
            ctx.lineTo(x + 20, y + 3);
            ctx.quadraticCurveTo(x, y + 15, x - 20, y + 3);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = alert ? '#ffe29a' : '#d8d390';
            ctx.beginPath();
            ctx.ellipse(x - 6, y, 4.8, 2.8, 0, 0, Math.PI * 2);
            ctx.ellipse(x + 7, y, 4.8, 2.8, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#243026';
            ctx.fillRect(x - 7, y - 2, 1.5, 4);
            ctx.fillRect(x + 6, y - 2, 1.5, 4);
        }
        ctx.restore();
    }
    function drawIntroForgeGlow(x, y, t, active) {
        ctx.save();
        const strength = active ? .48 : .12, glow = ctx.createRadialGradient(x, y, 3, x, y, active ? 112 : 65);
        glow.addColorStop(0, `rgba(255,178,91,${strength})`);
        glow.addColorStop(1, 'rgba(255,130,58,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(x - 120, y - 120, 240, 240);
        if (active) {
            for (let i = 0; i < 8; i++) {
                const q = (t * .28 + i * .137) % 1, sway = Math.sin(t * 2.2 + i * 1.8) * 7, px = x + sway + (i % 2 ? 11 : -11), py = y - 10 - q * 82;
                ctx.globalAlpha = (1 - q) * (.65 + .25 * Math.sin(t * 8 + i));
                circle(px, py, 1.2 + q * 1.1, i % 3 ? '#ffd796' : '#f18b55');
            }
        }
        ctx.restore();
    }
    function drawIntroFortressDecor(t, reduced) {
        // A few small foreground props; gameplay's background remains untouched.
        ctx.save();
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(260, 461);
        ctx.lineTo(278, 461);
        ctx.lineTo(276, 477);
        ctx.lineTo(269, 483);
        ctx.lineTo(262, 477);
        ctx.closePath();
        ctx.fillStyle = '#81503a';
        ctx.fill();
        ctx.strokeStyle = '#302e28';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(269, 463);
        ctx.lineTo(269, 479);
        ctx.moveTo(263, 469);
        ctx.lineTo(275, 469);
        ctx.strokeStyle = '#d3a76f';
        ctx.stroke();
        rr(703, 466, 23, 27, 4, '#745036');
        ctx.strokeStyle = '#2d302a';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(703, 473);
        ctx.lineTo(726, 473);
        ctx.moveTo(703, 486);
        ctx.lineTo(726, 486);
        ctx.strokeStyle = '#b59c6c';
        ctx.stroke();
        ctx.font = 'bold 6px system-ui';
        ctx.fillStyle = '#e5d09b';
        ctx.textAlign = 'center';
        ctx.fillText('КВАС', 714, 482);
        ctx.strokeStyle = '#cfb887';
        ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.moveTo(751 + i * 3, 488);
            ctx.lineTo(747 + i * 3, 466);
            ctx.stroke();
        }
        ctx.strokeStyle = '#3a3028';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(203, 485);
        ctx.lineTo(222, 483);
        ctx.lineTo(218, 488);
        ctx.lineTo(226, 490);
        ctx.stroke();
        if (!reduced) {
            ctx.strokeStyle = 'rgba(216,211,183,.22)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(326, 391);
            ctx.bezierCurveTo(317 + Math.sin(t * .4) * 3, 380, 337, 372, 329 + Math.sin(t * .5) * 4, 360);
            ctx.stroke();
        }
        ctx.restore();
    }
    function drawIntroAtmosphere(t, reduced) {
        ctx.save();
        ctx.fillStyle = 'rgba(151,179,174,.06)';
        for (let i = 0; i < 3; i++) {
            const x = ((i * 350 + (reduced ? 0 : t * 3)) % 1100) - 100, y = 75 + i * 36;
            ctx.beginPath();
            ctx.ellipse(x, y, 62, 9, 0, 0, Math.PI * 2);
            ctx.ellipse(x + 34, y - 4, 38, 8, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        if (!reduced && t % 9 < .7) {
            const p = (t % 9) / .7;
            ctx.globalAlpha = (1 - p) * .8;
            circle(326 + Math.sin(t * 8) * 3, 405 - p * 24, 1.4, '#ffd391');
        }
        ctx.restore();
    }
    let introBackdrop = null;
    function drawIntroScene(t) {
        if (!introBackdrop) {
            drawBackground(0);
            introBackdrop = document.createElement('canvas');
            introBackdrop.width = canvas.width;
            introBackdrop.height = canvas.height;
            introBackdrop.getContext('2d')?.drawImage(canvas, 0, 0);
        }
        else
            ctx.drawImage(introBackdrop, 0, 0, W, H);
        const reduced = introReducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches, storyTime = ((t % 26) + 26) % 26;
        introStoryBeat = reduced ? 'settle' : storyTime < 6 ? 'settle' : storyTime < 7.5 ? 'sip' : storyTime < 8.3 ? 'react' : storyTime < 9 ? 'notice' : storyTime < 10.5 ? 'draw' : storyTime < 11.7 ? 'freeze' : storyTime < 13 ? 'pretend' : 'settle';
        const drawStart = 19.6, releaseAt = drawStart + 21 * BOW_TIMING.drawFrame + BOW_TIMING.drawHold, recoverAt = releaseAt + RELEASE_DURATION, demoEnd = recoverAt + RECOVER_DURATION;
        const demo = !reduced && storyTime >= 19 && storyTime < demoEnd && (introMood === 'idle' || (introDemoActive && storyTime >= releaseAt));
        const ease = (v) => { const q = clamp(v, 0, 1); return q * q * (3 - 2 * q); };
        if (demo && !introDemoActive)
            introDemoStart = introAim;
        const demoPull = storyTime < drawStart ? introDemoStart * (1 - ease((storyTime - 19) / .6)) : storyTime < releaseAt ? Math.min(20, Math.floor((storyTime - drawStart + 1e-9) / BOW_TIMING.drawFrame)) / 20 : 0;
        const storyAim = introStoryBeat === 'draw' ? 1 : introStoryBeat === 'freeze' ? .94 : introStoryBeat === 'pretend' ? .32 : introStoryBeat === 'notice' ? .12 : 0, targetAim = reduced ? 0 : introMood === 'roll' ? 1 : demo ? demoPull : storyAim;
        const elapsed = introLastTime === null || t < introLastTime ? 1 / 60 : clamp(t - introLastTime, 0, .1);
        introLastTime = t;
        introAim = reduced ? 0 : demo ? demoPull : introAim + (targetAim - introAim) * (1 - Math.exp(-elapsed * 8));
        introDemoActive = demo;
        const phase = demo ? (storyTime < drawStart ? 'aim' : storyTime < releaseAt ? 'draw' : storyTime < recoverAt ? 'release' : 'recover') : introAim > .35 ? 'draw' : introAim > .05 ? 'aim' : 'idle';
        const pose = { phase, pull: introAim, progress: phase === 'release' ? (storyTime - releaseAt) / RELEASE_DURATION : phase === 'recover' ? (storyTime - recoverAt) / RECOVER_DURATION : 0, reduced };
        introHideKvass = reduced ? 0 : ease((storyTime - 11.7) / .25) * (1 - ease((storyTime - 13) / .35));
        drawIntroAtmosphere(t, reduced);
        drawIntroFortressDecor(t, reduced);
        drawIntroForgeGlow(645, 386, t, introMood === 'forge');
        drawIntroFire(326, 431, t);
        drawIntroFire(580, 431, t + 1.4);
        drawWatchingEyes(t, introMood === 'roll');
        // Slow ground mist, layered fires and silhouettes keep the quiet night alive.
        ctx.save();
        for (let i = 0; i < 5; i++) {
            const x = ((t * 12 + i * 251) % 1120) - 110, y = 342 + i * 25;
            ctx.globalAlpha = .075 + (i % 2) * .025;
            ctx.strokeStyle = '#b8c5a7';
            ctx.lineWidth = 8 + i;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.bezierCurveTo(x + 45, y - 10, x + 68, y + 10, x + 128, y - 3);
            ctx.stroke();
        }
        ctx.restore();
        const first = requiredAt(introEnemies, 0), second = requiredAt(introEnemies, 1), frozen = introStoryBeat === 'freeze' || introStoryBeat === 'pretend';
        const hide = !reduced && introMood === 'idle' ? ease((storyTime - 20.82) / .5) * (1 - ease((storyTime - 22.1) / .8)) : 0;
        first.x = 429 + (frozen ? 0 : Math.sin(t * .52) * 8) - hide * 35;
        first.attacking = introMood === 'roll' || introStoryBeat === 'react';
        first.attackFlash = first.attacking ? .22 : 0;
        second.x = 512 + (frozen ? 0 : Math.sin(t * .37 + 1.1) * 7) + hide * 35;
        for (const e of introEnemies.slice().sort((a, b) => a.y - b.y)) {
            ctx.save();
            ctx.globalAlpha = 1 - hide * .85;
            drawEnemy(e, t);
            ctx.restore();
        }
        if (introMood === 'idle' && (introStoryBeat === 'react' || introStoryBeat === 'pretend')) {
            const e = introStoryBeat === 'react' ? first : second, message = introStoryBeat === 'react' ? 'Эй, оставь квас!' : 'Я ничего не пил';
            rr(e.x - 35, e.y - 82, 128, 25, 8, 'rgba(21,39,37,.96)');
            ctx.strokeStyle = '#263a30';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.fillStyle = 'rgba(21,39,37,.96)';
            ctx.beginPath();
            ctx.moveTo(e.x + 15, e.y - 58);
            ctx.lineTo(e.x + 20, e.y - 49);
            ctx.lineTo(e.x + 29, e.y - 58);
            ctx.fill();
            ctx.font = '900 12px system-ui';
            ctx.fillStyle = '#e4f0a7';
            ctx.textAlign = 'center';
            ctx.fillText(message, e.x + 29, e.y - 65);
            ctx.textAlign = 'start';
        }
        if (!window.__archerRig?.draw(ctx, introArcher.x, introArcher.y, t, pose, undefined, { klass: introArcher.klass, appearance: introArcher.appearance, relics: introArcher.relics }))
            drawArcher(introArcher, t, false, -1);
    }
    function render() {
        if (['idle', 'win', 'lose'].includes(state.phase.mode)) {
            drawIntroScene(introReducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : performance.now() / 1000);
            return;
        }
        introBackdrop = null;
        drawBackground(state.elapsed);
        sceneBackgroundContext.drawImage(canvas, 0, 0, canvas.width / 6, canvas.height, 0, 0, sceneBackgroundCanvas.width / 2, sceneBackgroundCanvas.height);
        sceneBackgroundContext.drawImage(canvas, canvas.width * 5 / 6, 0, canvas.width / 6, canvas.height, sceneBackgroundCanvas.width / 2, 0, sceneBackgroundCanvas.width / 2, sceneBackgroundCanvas.height);
        for (const e of state.enemies.slice().sort((a, b) => a.y - b.y))
            drawEnemy(e, state.elapsed);
        for (const a of state.arrows)
            drawArrow(a);
        for (const p of state.spellShots) {
            circle(p.x, p.y, 5, p.kind === 'healer' ? '#c7ef83' : '#95debf');
            circle(p.x, p.y, 9, '#608d63');
        }
        for (const archer of state.archers)
            drawArcher(archer);
        drawEffects();
        drawBarks();
    }
    function update(dt) {
        if (state.phase.mode !== 'playing')
            return;
        state.elapsed += dt;
        if (state.elapsed >= state.nextWaveAt && state.wave < state.totalWaves)
            beginWave(false);
        for (const stream of [...state.waveStreams]) {
            stream.delay -= dt;
            if (stream.queue.length && stream.delay <= 0) {
                if (state.enemies.length < 160) {
                    const nextEnemy = stream.queue[0];
                    if (nextEnemy) {
                        spawn(nextEnemy, stream);
                        stream.queue.shift();
                    }
                }
                stream.delay = .28 + rand(0, .25);
            }
            if (!stream.queue.length)
                state.waveStreams.splice(state.waveStreams.indexOf(stream), 1);
        }
        state.gateFlash = Math.max(0, state.gateFlash - dt);
        state.lives = Math.min(maxGate(), state.lives + dt * metaBonus('gateRegen') * .07);
        if (state.wave > 0 && state.wave < state.totalWaves && state.enemies.length === 0 && state.waveStreams.every(w => !w.queue.length) && state.nextWaveAt > state.elapsed + .2)
            beginWave(true);
        if (state.wave >= state.totalWaves && state.enemies.length === 0 && state.waveStreams.every(w => !w.queue.length)) {
            showEnd(true);
            return;
        }
        autoManage();
        if (currentMode() !== 'playing')
            return;
        state.barkTimer -= dt;
        if (state.barkTimer <= 0) {
            state.barkTimer = rand(9, 19);
            if (state.enemies.length && Math.random() < .5) {
                const e = requiredAt(state.enemies, Math.floor(rand(0, state.enemies.length)));
                showBark('ЯЩЕР', requiredAt(LIZARD_LINES, Math.floor(rand(0, LIZARD_LINES.length))), e.x, e.y - 42, 2.2);
            }
            else if (state.archers.length) {
                const a = requiredAt(state.archers, Math.floor(rand(0, state.archers.length)));
                showBark('РУСЫ', requiredAt(RUS_LINES, Math.floor(rand(0, RUS_LINES.length))), a.x, a.y - 118, 2.2);
            }
        }
        for (const e of [...state.enemies]) {
            e.attackFlash = Math.max(0, e.attackFlash - dt);
            e.stunned = Math.max(0, e.stunned - dt);
            e.poison = Math.max(0, (e.poison || 0) - dt);
            e.burn = Math.max(0, (e.burn || 0) - dt);
            e.slow = Math.max(0, (e.slow || 0) - dt);
            e.shredTimer = Math.max(0, (e.shredTimer || 0) - dt);
            e.vulnerableTimer = Math.max(0, (e.vulnerableTimer || 0) - dt);
            if (!e.shredTimer)
                e.shred = 0;
            if (!e.vulnerableTimer)
                e.vulnerable = 0;
            if (e.poison > 0 || e.burn > 0) {
                e.hp -= dt * ((e.poison > 0 ? e.poisonDps : 0) + (e.burn > 0 ? e.burnDps : 0));
                if (e.hp <= 0) {
                    killEnemy(e, state.archers.find(a => a.id === e.statusOwnerId) || null);
                    continue;
                }
            }
            if (e.stunned > 0)
                continue;
            if (e.ranged) {
                e.attackTimer -= dt;
                if (e.attackTimer <= 0) {
                    e.attackTimer += ATTACKS[e.kind].period;
                    rangedAttack(e);
                }
                if (e.kind === 'healer') {
                    e.healTimer += dt;
                    if (e.healTimer >= 3.9) {
                        e.healTimer = 0;
                        for (const ally of state.enemies)
                            if (Math.hypot(ally.x - e.x, ally.y - e.y) < 140)
                                ally.hp = Math.min(ally.maxHp, ally.hp + 2.5);
                        impact(e.x, e.y, '#b0e98f');
                    }
                }
                continue;
            }
            if (!e.attacking) {
                if (e.route === 'road') {
                    const mult = terrainMultiplier(e.x, e.y) * (e.slow > 0 ? 1 - Math.min(.75, e.slowPower || 0) : 1);
                    e.y = Math.min(444, e.y + e.speed * dt * mult);
                    e.x = roadCenterX(e.y) + e.lane * roadHalf(e.y) + Math.sin(state.elapsed * .8 + e.phase) * Math.min(4, roadHalf(e.y) * .09);
                }
                else {
                    const dx = e.targetX - e.x, dy = e.targetY - e.y, len = Math.hypot(dx, dy) || 1, mult = terrainMultiplier(e.x, e.y) * (e.slow > 0 ? 1 - Math.min(.75, e.slowPower || 0) : 1);
                    e.x += dx / len * e.speed * dt * mult;
                    e.y += dy / len * e.speed * dt * mult;
                }
                if (e.y >= 444 || Math.hypot(e.x - e.targetX, e.y - e.targetY) < 8) {
                    e.attacking = true;
                    e.y = 444;
                    e.attackTimer = .45 + rand(.1, .6);
                }
            }
            else {
                e.attackTimer -= dt;
                if (e.attackTimer <= 0) {
                    gateHit(e);
                    e.attackTimer += ATTACKS[e.kind].period;
                    if (state.phase.mode !== 'playing')
                        return;
                }
            }
        }
        for (const p of [...state.spellShots]) {
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt;
            const hit = p.targetSlot != null ? state.archers.find(a => a.slot === p.targetSlot) : null;
            if (hit && Math.hypot(p.x - hit.x, p.y - 447) < 24) {
                harmArcher(hit, p.damage * 2.5);
                p.life = 0;
            }
            else if (p.y >= 466 || (!hit && p.y >= 440)) {
                state.lives = Math.max(0, state.lives - p.damage);
                state.gateFlash = .2;
                impact(450, 470, '#b6df8e');
                p.life = 0;
            }
            if (p.life <= 0 || p.x < -20 || p.x > 920 || p.y > 550)
                state.spellShots.splice(state.spellShots.indexOf(p), 1);
        }
        for (const a of state.archers) {
            a.shotFlash = Math.max(0, a.shotFlash - dt);
            a.bowPull = Math.max(0, a.bowPull - dt);
            updateBow(a, dt);
            if (relicCount(a, 'kvass'))
                a.hp = Math.min(a.maxHp, a.hp + dt * .35 * relicCount(a, 'kvass'));
            a.hp = Math.min(a.maxHp, a.hp + dt * a.mods.regen);
            a.hurryTimer = Math.max(0, a.hurryTimer - dt);
            state.gold += dt * a.mods.income;
            a.hp = Math.min(a.maxHp, a.hp + dt * (metaBonus('healing') * .06 + metaBonus('rest') * .05));
            updateDice(a, dt);
        }
        for (const a of [...state.arrows]) {
            const ox = a.x, oy = a.y;
            a.x += a.vx * dt;
            a.y += a.vy * dt;
            a.life -= dt;
            for (const e of [...state.enemies]) {
                if (e.hp <= 0 || a.hits.includes(e.id))
                    continue;
                const depth = .44 + clamp((e.y - 237) / 210, 0, 1) * .56;
                if (distToSegment(e.x, e.y - 23 * depth, ox, oy, a.x, a.y) < e.radius * depth + 3 + a.size) {
                    a.hits.push(e.id);
                    damageEnemy(e, a.damage, a);
                    a.pierces--;
                    if (a.pierces <= 0) {
                        a.life = 0;
                        break;
                    }
                }
            }
            if (a.life <= 0 || a.x < -40 || a.x > W + 40 || a.y < -50 || a.y > H + 40)
                state.arrows.splice(state.arrows.indexOf(a), 1);
            if (state.phase.mode !== 'playing')
                break;
        }
        for (const f of state.fx) {
            f.life -= dt;
            if (f.kind === 'spark') {
                f.x += f.vx * dt;
                f.y += f.vy * dt;
                f.vy += 95 * dt;
            }
        }
        state.fx = state.fx.filter(f => f.life > 0);
        for (const bark of state.barks)
            bark.life -= dt;
        state.barks = state.barks.filter(b => b.life > 0);
        if (state.lives <= 0)
            showEnd(false);
        else if (state.elapsed >= DURATION)
            showEnd(true);
    }
    window.addEventListener('keydown', ev => { if (ev.code === 'KeyP' && ['playing', 'paused'].includes(state.phase.mode)) {
        ev.preventDefault();
        pause();
    } });
    document.addEventListener('visibilitychange', () => { if (document.hidden && state.phase.mode === 'playing')
        pause(); });
    function frame(now) { const dt = Math.min(.05, Math.max(0, (now - (state.last || now)) / 1000)); state.last = now; if (state.phase.mode === 'playing')
        update(dt); render(); requestAnimationFrame(frame); }
    // Canvas receives a readonly live view and commands instead of the mutable simulation state.
    const uiState = readonlyView(state);
    window.__zastavaUi = { sceneCanvas: canvas, sceneBackgroundCanvas, state: uiState, introArcher: readonlyView(introArcher), setIntroMood, setIntroReducedMotion, setControlMode, manualVolley, canManualVolley, maxGate, faceRepeats, estimateDps, boostPrice, pause, get pauseMessage() { return pauseMessage; }, rawShotDamage, displayedShotDamage, formatDamage, faceInfo, faceModeFor, faceSymbolFor, relicInfo, relicTable, reset, update, SLOTS: readonlyView(SLOTS), openRecruit, recruitChoice, boostArcher, openEquip, closeModal, beginWave, chooseUpgrade, upgrade, showNextLevel, CLASSES: readonlyView(CLASSES), FACE_ATTACKS: readonlyView(FACE_ATTACKS), meta: readonlyView(meta), RELICS: readonlyView(RELICS), equipRelic, unequipRelic, META_NODES: readonlyView(META_NODES), metaLevel, metaPrice, buyMeta, CARD_GROUPS: readonlyView(CARD_GROUPS), activeStatuses, frontFace, modifierDefaults };
    requestAnimationFrame(frame);
})();
//# sourceMappingURL=game.js.map
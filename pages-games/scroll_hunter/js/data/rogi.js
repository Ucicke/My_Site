/* ================================================================
   SCROLL HUNTER · data/rogi.js
   Роги: загадки про сундуки и про комнату.

   Загадка про сундук — это не «там мимик», а художественная улика,
   из которой тип выводится самому:

   reveals: ['mimic']            — выдаёт мимика
             ['relic']            — выдаёт реликвию
             ['empty']            — выдаёт пустоту
             ['relic','empty']    — «не мимик»: реликвия или пусто
             ['mimic','relic']    — «не пусто»: мимик или реликвия

   Загадка про комнату — mode проверяется на фактах комнаты
   (см. core/rogi.js, roomRiddleTrue).
   ================================================================ */
'use strict';

/* ---------------------------------------------------------------
   Загадки про сундук
   --------------------------------------------------------------- */
const ROGI_CHEST_RIDDLES = [
    /* ---------- выдают мимика ---------- */
    { id: 'zapakh', reveals: ['mimic'], cat: 'senses', text: 'Пахнет сырым мясом и гнилью.' },
    { id: 'urchanie', reveals: ['mimic'], cat: 'senses', text: 'Сундук буквально бурчит у себя в животе. Проголодался.' },
    { id: 'skrechet', reveals: ['mimic'], cat: 'senses', text: 'Словно когти скребут по сухому дереву.' },
    { id: 'tyazholoe', reveals: ['mimic'], cat: 'senses', text: 'Из зазоров крышки пахнет застоявшейся слюной.' },
    { id: 'stuk', reveals: ['mimic'], cat: 'senses', text: 'Внутри глухо бьётся, будто копыта скребутся.' },
    { id: 'hlyup', reveals: ['mimic'], cat: 'senses', text: 'Изнутри донеслось влажное хлюпанье. Мерзость.' },
    { id: 'shepot', reveals: ['mimic'], cat: 'senses', text: 'Мне кажется, этот ящик бормочет что-то.' },
    { id: 'hrust', reveals: ['mimic'], cat: 'senses', text: 'Внутри хрустнуло, будто сухие кости.' },
    { id: 'temperatura', reveals: ['mimic'], cat: 'senses', text: 'Крышка подозрительно тёплая. Слишком тёплая для дерева.' },
    { id: 'dyhanie', reveals: ['mimic'], cat: 'senses', text: 'Замочная скважина слегка покрывается паром.' },
    { id: 'vibraciya', reveals: ['mimic'], cat: 'senses', text: 'Когда я прохожу мимо, кинжал в ножнах дрожит.' },
    { id: 'ultrazvuk', reveals: ['mimic'], cat: 'senses', text: 'Я свистнул, и ящик едва заметно вздрогнул.' },
    { id: 'serdtsebienie', reveals: ['mimic'], cat: 'senses', text: 'Там внутри что-то стучит: сто ударов в минуту.' },
    { id: 'ten', reveals: ['mimic'], cat: 'visual', text: 'Тень падает не под тем углом. Он живой.' },
    { id: 'vyros', reveals: ['mimic'], cat: 'visual', text: 'Будто вырос из пола — стык дерева с камнем без щели.' },
    { id: 'zuby', reveals: ['mimic'], cat: 'visual', text: 'На ободке остались вмятины от чужих клыков.' },
    { id: 'treshiny', reveals: ['mimic'], cat: 'visual', text: 'Дерево на углах свежее, без сколов. Ящик вырос здесь сам.' },
    { id: 'asimmetriya', reveals: ['mimic'], cat: 'visual', text: 'Левая петля шире правой — перекашивает от веса зубов.' },
    { id: 'pot', reveals: ['mimic'], cat: 'visual', text: 'Дерево сочится влагой. Сундуки так не потеют.' },
    { id: 'glazok', reveals: ['mimic'], cat: 'visual', text: 'Сучок на доске выглядит точь-в-точь как закрытый глаз.' },
    { id: 'carapiny', reveals: ['mimic'], cat: 'visual', text: 'Скважина исцарапана изнутри, а не снаружи.' },
    { id: 'naklon', reveals: ['mimic'], cat: 'visual', text: 'Ящик стоит идеально ровно, хотя пол под ним с наклоном.' },
    { id: 'maskirovka', reveals: ['mimic'], cat: 'visual', text: 'Покрашен чуть ярче остальных. Нас явно завлекают.' },
    { id: 'tyazhest', reveals: ['mimic'], cat: 'visual', text: 'Петли просели под весом чего-то массивного.' },
    { id: 'skvozyak', reveals: ['mimic'], cat: 'visual', text: 'Скважина всасывает воздух, а не выдувает.' },
    { id: 'drozh', reveals: ['mimic'], cat: 'visual', text: 'Металлическая ручка мелко дрожит без остановки.' },
    { id: 'sliz', reveals: ['mimic'], cat: 'visual', text: 'Под дном остался влажный, липкий след.' },
    { id: 'blesk', reveals: ['mimic'], cat: 'visual', text: 'Скважина отполирована до блеска — её постоянно лижут.' },
    { id: 'lishaynik', reveals: ['mimic'], cat: 'visual', text: 'Ящик покрыт трупным лишайником. Плохой знак.' },
    { id: 'shchelchok', reveals: ['mimic'], cat: 'visual', text: 'Защелка пружинит: там живая плоть подпирает.' },
    { id: 'sledopyt', reveals: ['mimic'], cat: 'visual', text: 'Вокруг сундука на полу подозрительные царапины.' },

    /* ---------- выдают реликвию ---------- */
    { id: 'bumaga', reveals: ['relic'], cat: 'senses', text: 'Из-под крышки тянется запах старой бумаги и чернил.' },
    { id: 'shurash', reveals: ['relic'], cat: 'senses', text: 'Внутри тихо шуршит бумага. Это свиток.' },
    { id: 'smola', reveals: ['relic'], cat: 'senses', text: 'Пахнет смолой и чем-то сладким. Вещь старая, но настоящая.' },
    { id: 'zamolot', reveals: ['relic'], cat: 'visual', text: 'Замок начищен и смазан: его закрывали, когда внутри было что-то ценное.' },
    { id: 'tyagholyy', reveals: ['relic'], cat: 'visual', text: 'Дерево просело там, где лежит предмет. Тяжёлое, но не зубастое.' },

    /* ---------- выдают пустоту ---------- */
    { id: 'ekho', reveals: ['empty'], cat: 'senses', text: 'Звук звонкий. Пусто.' },
    { id: 'lenty', reveals: ['empty'], cat: 'senses', text: 'Стукнул — и звук ушёл вниз, в пустоту.' },
    { id: 'kroshka', reveals: ['empty'], cat: 'senses', text: 'Внутри только каменная крошка и ржа.' },
    { id: 'verevka', reveals: ['empty'], cat: 'senses', text: 'На дне лишь пыль и обрывок верёвки.' },
    { id: 'chistyy', reveals: ['empty'], cat: 'visual', text: 'Пусто, зато чисто. Кто-то забрал содержимое аккуратно.' },
    { id: 'pesok', reveals: ['empty'], cat: 'visual', text: 'Там ничего, кроме сухого песка.' },

    /* ---------- «не мимик»: реликвия или пусто ---------- */
    { id: 'zhizni', reveals: ['relic', 'empty'], cat: 'senses', text: 'Не чувствую там ничего живого. Ни дыхания, ни тепла.' },
    { id: 'med', reveals: ['relic', 'empty'], cat: 'senses', text: 'Пахнет старой медью. Никакой падали.' },
    { id: 'kislot', reveals: ['relic', 'empty'], cat: 'senses', text: 'Кислый налёт — но это настоящее старое железо, не зубы.' },
    { id: 'tiho', reveals: ['relic', 'empty'], cat: 'senses', text: 'Ни звука, ни запаха. Ничего опасного.' },
    { id: 'drevno', reveals: ['relic', 'empty'], cat: 'visual', text: 'Замок ржавый, его давно не открывали.' },
    { id: 'chistoe', reveals: ['relic', 'empty'], cat: 'visual', text: 'Ни царапины вокруг, ни слюны в зазоре.' },
    { id: 'kamen', reveals: ['relic', 'empty'], cat: 'visual', text: 'Пахнет сухим камнем. Ничего живого.' },
    { id: 'kraska', reveals: ['relic', 'empty'], cat: 'visual', text: 'Краска облупилась, дерево сухое. Здесь давно никого нет.' },
    { id: 'ugly', reveals: ['relic', 'empty'], cat: 'visual', text: 'Углы острые, как и делали. Никто не грыз.' },
    { id: 'zazor', reveals: ['relic', 'empty'], cat: 'visual', text: 'Зазор у крышки слишком ровный для пасти монстра.' },

    /* ---------- «не пусто»: мимик или реликвия ---------- */
    { id: 'ves', reveals: ['mimic', 'relic'], cat: 'senses', text: 'Сундук явно не пустой — слишком тяжёлый.' },
    { id: 'vosk', reveals: ['mimic', 'relic'], cat: 'senses', text: 'Из щели пахнет застывшим воском. Что-то внутри есть.' }
];

/* ---------------------------------------------------------------
   Загадки про комнату
   --------------------------------------------------------------- */
const ROGI_ROOM_RIDDLES = [
    { id: 'odin', mode: 'one_mimic', cat: 'logic', text: 'В этой комнате ровно один мимик. Остальное — добыча или пустота.' },
    { id: 'levo', mode: 'more_left', cat: 'logic', text: 'Слева мимиков больше, чем справа.' },
    { id: 'pravo', mode: 'more_right', cat: 'logic', text: 'Справа мимиков больше, чем слева.' },
    { id: 'kray', mode: 'edge_safe', cat: 'logic', text: 'Крайние сундуки безопасны. Мимик сидит в середине.' },
    { id: 'chut', mode: 'even_mimic', cat: 'logic', text: 'Мимик сидит в сундуке с чётным порядковым номером.' },
    { id: 'zerna', mode: 'mirror_opposite', cat: 'logic', text: 'Первый и последний сундуки — полная противоположность.' },
    { id: 'dva raza', mode: 'double_ratio', cat: 'logic', text: 'Мимиков ровно вдвое больше, чем пустых сундуков.' },
    { id: 'bolshinstvo', mode: 'most_safe', cat: 'logic', text: 'Большая часть сундуков здесь безобидны.' },
    { id: 'krays', mode: 'edges_mimics', cat: 'logic', text: 'Все мимики этой комнаты забились к краям.' },
    { id: 'bез sokr', mode: 'edge_no_relic', cat: 'logic', text: 'По краям сокровищ нет — там либо пусто, либо смерть.' },
    { id: 'centr', mode: 'center_safe', cat: 'logic', text: 'В центре стола мимиков нет. Там можно дышать.' },
    { id: 'dvoika', mode: 'pair_one_mimic', cat: 'logic', text: 'Один из этих двух сундуков — мимик. Второй безопасен.' },
    { id: 'sosedi', mode: 'neighbours_safe', cat: 'logic', text: 'Соседи этого сундука безопасны — он единственный опасный среди них.' },
    { id: 'odin iz dvukh', mode: 'pair_empty', cat: 'logic', text: 'В этой паре ровно один пустой сундук.' }
];

/* Категории для группировки в интерфейсе */
const ROGI_CATS = {
    logic: { name: 'ЛОГИКА', color: '#8ecbff' },
    senses: { name: 'ЧУТЬЯ', color: '#2fd4a0' },
    visual: { name: 'ГЛАЗА', color: '#ffc93c' },
    tool: { name: 'ИНСТРУМЕНТЫ', color: '#c7b6ff' },
    bluff: { name: 'БЛЕФ', color: '#ff7a90' }
};

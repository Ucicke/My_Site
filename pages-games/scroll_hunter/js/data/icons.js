/* ================================================================
   SCROLL HUNTER · data/icons.js
   Векторные иконки (24×24, обводка currentColor) вместо эмодзи —
   они не зависят от шрифта системы и выглядят одинаково везде.
   ================================================================ */
'use strict';

const ICONS = {
    /* --- типы комнат --- */
    FIGHT: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M13 3h8v8l-9.5 9.5L7 16 13 3Z"/><path d="m5 19 3-3"/><path d="M4 20h4"/></svg>',
    ELITE: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a8 8 0 0 0-4.5 14.6V21h9v-3.4A8 8 0 0 0 12 3Z"/><circle cx="9.5" cy="11" r="1.1"/><circle cx="14.5" cy="11" r="1.1"/><path d="M10 21v-1.6M14 21v-1.6"/></svg>',
    CAMP: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3s5 4.2 5 8.4A5 5 0 0 1 7 11.4c0-2 1-3.1 1-3.1s1 1.1 2 1.1C9.6 6.9 9 5.7 12 3Z"/><path d="M5 21h14"/></svg>',
    CAMP_FINALE: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4 3 20h18L12 4Z"/><path d="M12 4v16"/><path d="M8 20 12 13l4 7"/></svg>',
    SHOP: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h16l-1 12H5L4 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>',
    TREASURE: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 4h12l3 5-9 11L3 9l3-5Z"/><path d="M3 9h18"/><path d="m9 4-3 5 6 11 6-11-3-5"/></svg>',
    DIG: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M13 4c3.6 1.7 6 4.6 6.5 8.5"/><path d="M13 4c-1.6 2.6-2.4 5.2-2.4 8"/><path d="M3 21 12 11"/></svg>',
    EVENT: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9.2 9a3 3 0 1 1 4.1 2.8c-.7.4-1.1 1-1.1 1.8v.4"/><circle cx="12.2" cy="17.5" r="1" fill="currentColor" stroke="none"/></svg>',
    BOSS: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 17h16l1-9-5 3-4-6-4 6-5-3 1 9Z"/><path d="M4 20h16"/></svg>',

    /* --- интерфейс --- */
    backpack: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6V5a4 4 0 0 1 8 0v1M5 10a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v10H5V10ZM8 13h8v5H8v-5ZM5 11H3v8h2m14-8h2v8h-2M10 9h4"/></svg>',
    key: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="12" r="4"/><path d="M12 12h8"/><path d="m17 12-2 2.5"/></svg>',
    sword: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M13 3h8v8l-9.5 9.5L7 16 13 3Z"/><path d="m5 19 3-3"/><path d="M4 20h4"/></svg>',
    coin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><path d="M12 8v8M14.5 9.8c-.6-.6-1.5-1-2.5-1-1.4 0-2.5.7-2.5 1.8s1 1.5 2.5 1.8 2.5.7 2.5 1.8-1.1 1.8-2.5 1.8c-1 0-1.9-.4-2.5-1"/></svg>',
    heart: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-8-4.9-8-10.4A4.6 4.6 0 0 1 12 8a4.6 4.6 0 0 1 8 2.6C20 16.1 12 21 12 21Z"/></svg>',
    soundOn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4Z"/><path d="M16.4 9.2a4 4 0 0 1 0 5.6"/><path d="M19 6.6a8 8 0 0 1 0 10.8"/></svg>',
    soundOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4Z"/><path d="m17 9.5 4 5M21 9.5l-4 5"/></svg>'
};

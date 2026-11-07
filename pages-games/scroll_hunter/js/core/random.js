/* Versioned, checkpointable random streams for independent game systems. */
(function (root, factory) {
    const api = factory(root);
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.GameRng = api;
})(typeof globalThis === 'undefined' ? this : globalThis, function (root) {
    'use strict';

    const CONTRACT_VERSION = 1;
    const STREAMS = Object.freeze(['map', 'events', 'loot', 'mechanics', 'visual', 'audio', 'ui']);
    let seed = 'uninitialized';
    const states = Object.create(null);

    function hash(value) {
        let result = 2166136261;
        for (const character of String(value)) result = Math.imul(result ^ character.charCodeAt(0), 16777619);
        return result >>> 0 || 0x6d2b79f5;
    }

    function normalizeSeed(value) {
        return String(value == null ? 'scroll-hunter' : value);
    }

    function start(value) {
        seed = normalizeSeed(value);
        for (const name of STREAMS) states[name] = hash(seed + ':' + name);
        return seed;
    }

    function createSeed() {
        return Math.floor(Math.random() * 0x100000000).toString(16);
    }

    function next(name = 'mechanics') {
        if (!STREAMS.includes(name)) throw new TypeError('unknown-rng-stream:' + name);
        if (!states[name]) start(seed);
        let value = states[name] >>> 0;
        value ^= value << 13; value ^= value >>> 17; value ^= value << 5;
        states[name] = value >>> 0 || 0x6d2b79f5;
        return states[name] / 0x100000000;
    }

    function int(name, min, max) {
        return Math.floor(next(name) * (max - min + 1)) + min;
    }

    function between(name, min, max) {
        return min + next(name) * (max - min);
    }

    function shuffle(name, list) {
        const output = list.slice();
        for (let index = output.length - 1; index > 0; index--) {
            const other = int(name, 0, index);
            [output[index], output[other]] = [output[other], output[index]];
        }
        return output;
    }

    function snapshot() {
        return { version:CONTRACT_VERSION, seed, streams:Object.fromEntries(STREAMS.map(name => [name, states[name] >>> 0])) };
    }

    function restore(value) {
        if (!value || value.version !== CONTRACT_VERSION || !value.streams ||
            !STREAMS.every(name => Number.isInteger(value.streams[name]) && value.streams[name] > 0 && value.streams[name] <= 0xffffffff)) return false;
        seed = normalizeSeed(value.seed);
        for (const name of STREAMS) states[name] = value.streams[name] >>> 0;
        return true;
    }

    function legacySeed(checkpoint) {
        const value = checkpoint || {};
        const identity = [value.week, value.stageIndex, value.state, value.currentNodeId,
            Array.isArray(value.eventDeckRemaining) ? value.eventDeckRemaining.join(',') : '',
            value.companion?.dungeon, value.gold, value.hp].join('|');
        return 'legacy-save-v1:' + hash(identity).toString(16);
    }

    start('scroll-hunter-default');
    return Object.freeze({ CONTRACT_VERSION, STREAMS, createSeed, start, next, int, between, shuffle, snapshot, restore, legacySeed });
});

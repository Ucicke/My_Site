/* Node entry point for the game's DOM-free play and simulation interfaces. */
'use strict';

const { createSession, createMemoryStorage } = require('./headless-session.js');
const { createScrollRuntime } = require('./headless-scroll-runtime.js');
const { runNaturalScenario, runNaturalScenarios } = require('./headless-campaign.js');

function createHeadlessAPI({ session: sessionOptions = {}, scrolls: scrollOptions = {} } = {}) {
    return Object.freeze({
        session: createSession(sessionOptions),
        scrolls: createScrollRuntime(scrollOptions),
        campaign: Object.freeze({ runScenario: runNaturalScenario, runScenarios: runNaturalScenarios })
    });
}

module.exports = { createHeadlessAPI, createMemoryStorage };

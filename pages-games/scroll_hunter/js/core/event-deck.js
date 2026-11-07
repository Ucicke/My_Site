/* ================================================================
   SCROLL HUNTER · core/event-deck.js
   Колода событий кампании без повторов до полного прохода.
   ================================================================ */
'use strict';

let eventDeckRemaining = [];
let lastDrawnEventId = null;

function eventDefinitionIds() {
    return [...EVENTS.map(event => event.id), ...(typeof TwoRoguesStory !== 'undefined' ? TwoRoguesStory.eventIds : [])];
}

function storyEventContext() {
    if (typeof companion === 'undefined' || !companion || typeof RogiAI === 'undefined') return null;
    const ai = RogiAI.ensure(companion);
    return { active:!!companion.active, ai, gold, hp, trust:rogiTrust, rogiFocus:ai.focus,
        scrolls:scrollInventory, storyFlags:campaignStoryFlags };
}

function eventAvailable(id, context) {
    if (!(typeof TwoRoguesStory !== 'undefined' && TwoRoguesStory.eventIds.includes(id))) return true;
    if (!context) return false;
    if (id === 'inspector-callback') return !!TwoRoguesStory.createScenario(id, context);
    return context.active !== false && !context.ai?.seen?.['two-rogues-story:' + id];
}

function eventForId(id, context) {
    if (typeof TwoRoguesStory !== 'undefined' && TwoRoguesStory.eventIds.includes(id)) {
        const scene = TwoRoguesStory.createScenario(id, context);
        if (!scene) return null;
        return { ...scene, storyEvent:true, choices:scene.choices.map(choice => ({
            ...choice, storyChoiceId:choice.id, apply:() => ({ storyEventChoiceId:choice.id })
        })) };
    }
    return EVENTS.find(item => item.id === id) || null;
}

function resetEventDeck() {
    eventDeckRemaining = [];
    lastDrawnEventId = null;
}

function queueStoryEvent(id, contextOverride = null) {
    const context = contextOverride || storyEventContext();
    if (!eventDeckRemaining.includes(id) && eventAvailable(id, context)) {
        eventDeckRemaining.push(id);
    }
}

function restoreEventDeck(remainingIds, lastId) {
    const knownIds = new Set(eventDefinitionIds());
    const uniqueIds = new Set();
    eventDeckRemaining = (Array.isArray(remainingIds) ? remainingIds : [])
        .filter(id => knownIds.has(id) && !uniqueIds.has(id) && uniqueIds.add(id));
    lastDrawnEventId = knownIds.has(lastId) ? lastId : null;
}

function drawDungeonEvent(contextOverride = null) {
    const context = contextOverride || storyEventContext();
    const availableIds = eventDefinitionIds().filter(id => eventAvailable(id, context));
    const knownIds = new Set(availableIds);
    eventDeckRemaining = eventDeckRemaining.filter(id => knownIds.has(id));
    if (!eventDeckRemaining.length) {
        eventDeckRemaining = shuffleIn('events', availableIds);
        if (eventDeckRemaining.length > 1 && eventDeckRemaining[eventDeckRemaining.length - 1] === lastDrawnEventId) {
            const swapIndex = randIntIn('events', 0, eventDeckRemaining.length - 2);
            const lastIndex = eventDeckRemaining.length - 1;
            [eventDeckRemaining[lastIndex], eventDeckRemaining[swapIndex]] =
                [eventDeckRemaining[swapIndex], eventDeckRemaining[lastIndex]];
        }
    }

    /* A callback earned by play is the next EVENT, even after a week resets its deck. */
    if (availableIds.includes('inspector-callback')) {
        eventDeckRemaining = eventDeckRemaining.filter(id => id !== 'inspector-callback');
        eventDeckRemaining.push('inspector-callback');
    }

    const id = eventDeckRemaining.pop();
    const event = eventForId(id, context);
    if (event) lastDrawnEventId = event.id;
    return event;
}

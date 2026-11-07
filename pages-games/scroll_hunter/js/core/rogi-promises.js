/* Promise lifecycle rules for Rogi. The AI supplies its state and event ports. */
'use strict';

const RogiPromiseDomain = (() => {
    const PROMISE_KINDS = new Set(['fairLoot', 'helpDebt', 'risk', 'noKnownDanger']);
    const FINANCIAL_KINDS = new Set(['fixed-gift', 'shared-goal', 'cover-shortfall', 'exit-shortfall']);

    function create({ ensure, event, finances, freePlayerGold }) {
        function ownsMemory(comp, type) {
            const ai = ensure(comp);
            return !!ai && ai.memory.some(item => item.type === type);
        }

        function recordPromise(comp, kind, terms = {}) {
            const ai = ensure(comp);
            if (!ai || !PROMISE_KINDS.has(kind) || ai.promises[kind]?.status === 'active') return false;
            if (kind !== 'helpDebt' && ai.seen['promise:' + kind]) return false;
            if (kind === 'helpDebt' && ai.promises[kind]?.dungeon === (Number(comp.dungeon) || 0)) return false;
            const financialKind = terms.kind || 'shared-goal';
            if (kind === 'helpDebt' && (!FINANCIAL_KINDS.has(financialKind) ||
                (financialKind === 'fixed-gift' && (!Number.isSafeInteger(terms.amount) || terms.amount <= 0)))) return false;

            ai.seen['promise:' + kind] = true;
            event(comp, 'promise-made', { key: kind });
            ai.promises[kind] = { status: 'active', createdAt: ai.eventNo, dungeon: Number(comp.dungeon) || 0, lastReview: null };
            if (kind === 'helpDebt') ai.promises[kind].contract = {
                kind: financialKind, amount: financialKind === 'fixed-gift' ? terms.amount : null,
                targetAtCreation: finances(comp).shortLiquid, contributions: 0,
                deadlineDungeon: Number(comp.dungeon) || 0, opportunityGold: freePlayerGold(), reviewFinalized: false
            };
            return true;
        }

        function resolvePromise(comp, kind, fulfilled) {
            const ai = ensure(comp), promise = ai && ai.promises[kind];
            if (!promise || promise.status !== 'active') return false;
            promise.status = fulfilled ? 'kept' : 'broken';
            promise.resolvedAt = ai.eventNo;
            const detail = { key: kind, contract: promise.contract ? { kind: promise.contract.kind, amount: promise.contract.amount } : null };
            event(comp, fulfilled ? 'promise-kept' : 'broken-promise', detail);
            return true;
        }

        function reviewFinancialPromise(comp, options = {}) {
            const ai = ensure(comp), promise = ai.promises.helpDebt;
            if (!promise || promise.status !== 'active') return;
            promise.contract ||= {
                kind: 'exit-shortfall', amount: null, contributions: 0,
                targetAtCreation: finances(comp).shortLiquid, deadlineDungeon: promise.dungeon, opportunityGold: 0
            };
            const contract = promise.contract, current = finances(comp), contribution = contract.contributions || 0;
            if (contract.reviewFinalized) return;
            contract.opportunityGold = Math.max(contract.opportunityGold || 0, options.playerAvailable ?? freePlayerGold());

            // Subtract the player's contribution to distinguish genuine aid from an unnecessary gift.
            // If the deadline passed without an opportunity, freeze that obligation across later weeks.
            const required = contract.overdueTarget ?? (contract.kind === 'fixed-gift'
                ? contract.amount
                : Math.max(0, current.debt - (current.cash + current.liquid - contribution)));
            const met = contract.kind === 'fixed-gift'
                ? contribution >= required
                : required > 0 && contribution >= required && (contract.overdueTarget != null || current.shortLiquid === 0);
            const due = (options.atExit && (Number(comp.dungeon) || 0) >= (contract.deadlineDungeon || 0)) ||
                (comp.settlement?.dungeon === comp.dungeon && comp.settlement.phase !== 'finalized' &&
                    (Number(comp.dungeon) || 0) >= (contract.deadlineDungeon || 0));

            if (met && (contract.kind !== 'exit-shortfall' || due)) {
                resolvePromise(comp, 'helpDebt', true);
                contract.reviewFinalized = true;
                return;
            }
            if (!due) return;
            if (contract.kind !== 'fixed-gift' && required === 0) {
                promise.status = 'not-needed';
                promise.resolvedAt = ai.eventNo;
                promise.lastReview = { outcome: 'not-needed', remainsActive: false, dungeon: comp.dungeon, eventNo: ai.eventNo };
                contract.reviewFinalized = true;
                return;
            }
            const remaining = Math.max(0, required - contribution);
            if (options.final && remaining > 0 && contract.opportunityGold >= remaining) {
                resolvePromise(comp, 'helpDebt', false);
                contract.reviewFinalized = true;
            } else {
                if (options.final && contract.overdueTarget == null) contract.overdueTarget = required;
                promise.lastReview = {
                    dungeon: comp.dungeon, eventNo: ai.eventNo,
                    outcome: options.final ? 'no-opportunity' : 'awaiting-help', required,
                    contributed: contribution, remaining, deadlinePassed: !!options.final, remainsActive: true
                };
            }
        }

        function trackEvidence(comp, type, detail = {}, eventNo = 0) {
            const ai = ensure(comp);
            for (const [kind, promise] of Object.entries(ai.promises)) {
                if (promise.status !== 'active' || eventNo <= promise.createdAt) continue;
                const isPlayer = detail.actor === 'player' || type.startsWith('player-');
                if (kind === 'risk' && type === 'player-risk' && isPlayer) resolvePromise(comp, kind, true);
                else if (kind === 'risk' && type === 'forced-risk' && detail.dangerous) resolvePromise(comp, kind, false);
                else if (kind === 'noKnownDanger' && type === 'player-known-danger' && isPlayer) resolvePromise(comp, kind, true);
                else if (kind === 'noKnownDanger' && type === 'known-danger' && detail.actor === 'rogi') resolvePromise(comp, kind, false);
                else if (kind === 'helpDebt' && type === 'debt-help') {
                    promise.contract ||= {
                        kind: 'exit-shortfall', contributions: 0, deadlineDungeon: promise.dungeon,
                        targetAtCreation: finances(comp).shortLiquid, opportunityGold: 0
                    };
                    promise.contract.contributions += Math.max(0, Number(detail.amount) || 0);
                    reviewFinancialPromise(comp);
                } else if (kind === 'fairLoot' && type === 'player-fair-deal') resolvePromise(comp, kind, true);
                else if (kind === 'fairLoot' && type === 'fair-deal' && detail.source === 'companion' && detail.decision === 'give') resolvePromise(comp, kind, true);
                else if (kind === 'fairLoot' && type === 'player-unfair-loot') resolvePromise(comp, kind, false);

                if (kind === 'helpDebt' && type === 'player-fair-deal' && detail.decision === 'buyout' && promise.contract?.kind === 'shared-goal') {
                    promise.contract.contributions += Math.max(0, Number(detail.amount) || 0);
                    reviewFinancialPromise(comp);
                }
            }
        }

        function endDungeon(comp, options = {}) {
            const ai = ensure(comp);
            if (!ai) return;
            reviewFinancialPromise(comp, { ...options, atExit: true });
            for (const [kind, promise] of Object.entries(ai.promises)) {
                if (promise.status !== 'active' || kind === 'helpDebt') continue;
                const events = ai.timeline.filter(item => item.no > promise.createdAt);
                const opportunities = {
                    fairLoot: ['valuable-find', 'player-fair-deal', 'player-unfair-loot'],
                    risk: ['player-risk', 'forced-risk'],
                    noKnownDanger: ['player-known-danger', 'known-danger']
                }[kind] || [];
                const opportunity = events.some(item => opportunities.includes(item.type));
                promise.lastReview = {
                    dungeon: Number(comp.dungeon) || 0, eventNo: ai.eventNo,
                    outcome: opportunity ? 'opportunity-unresolved' : 'no-opportunity', remainsActive: true
                };
            }
        }

        return Object.freeze({ ownsMemory, recordPromise, resolvePromise, reviewFinancialPromise, trackEvidence, endDungeon });
    }

    return Object.freeze({ create });
})();

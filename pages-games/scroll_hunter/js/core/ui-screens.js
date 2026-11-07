/* ================================================================
   SCROLL HUNTER · core/ui-screens.js
   Выбор рендерера для активного забега или мета-экрана.
   ================================================================ */
'use strict';

function renderStateUI(stage, tribute) {
    const metaStates = [STATES.INTRO, STATES.PROLOGUE, STATES.QUARTERMASTER, STATES.GAME_OVER, STATES.VICTORY];
    if (metaStates.includes(gameState)) renderMetaStateUI(stage, tribute);
    else renderRunStateUI(stage, tribute);
}

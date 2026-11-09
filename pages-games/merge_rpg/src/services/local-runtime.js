/* Small compatibility layer for the Astrocade APIs used by this game. */
(function () {
  const requestedMode = new URLSearchParams(window.location.search).get("mode");
  window.mode = requestedMode === "edit" ? "edit" : "play";

  function fitGameToViewport() {
    const width = document.documentElement.clientWidth || window.innerWidth;
    const height = document.documentElement.clientHeight || window.innerHeight;
    const landscape = width > height;
    const designWidth = landscape ? 1280 : 720;
    const designHeight = landscape ? 720 : 1280;
    const scale = Math.min(1, width / designWidth, height / designHeight);
    document.documentElement.style.setProperty("--game-design-width", `${designWidth}px`);
    document.documentElement.style.setProperty("--game-design-height", `${designHeight}px`);
    document.documentElement.style.setProperty("--game-scale", String(scale));
  }

  fitGameToViewport();
  window.addEventListener("resize", fitGameToViewport);
  window.addEventListener("orientationchange", fitGameToViewport);

  window.lib = {
    getAsset(id) {
      return window.localAssetMap[id];
    },
    log(message) {
      console.log("[The RPG]", message);
    },
    showGameParameters(settings) {
      console.info("[The RPG] Astrocade parameter panel is unavailable locally.", settings);
    }
  };
})();

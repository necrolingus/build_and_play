import { requestLevelPreview } from './api.js';
import { renderLevelToCanvas } from './renderer.js';

const showcaseCanvas = document.getElementById('home-showcase-canvas');

async function initHomeShowcase() {
  try {
    // Deterministic prebuilt 3-screen SNES Sunset showcase level
    const showcaseParams = {
      screens: 3,
      paletteIndex: 2,
      platformDensity: 65,
      gapFrequency: 20,
      groundElevation: 2,
      verticality: 7,
      interactingCount: 10,
      giftWeightCoin: 50,
      giftWeightExtraLife: 25,
      giftWeightInvincibility: 25,
      startingLives: 3,
      hazardDensity: 60,
      decorDensity: 85,
      seed: 777888
    };

    const { levelData } = await requestLevelPreview(showcaseParams);
    renderLevelToCanvas(showcaseCanvas, levelData, {
      showGrid: false,
      showScreenDividers: false,
      showGiftIcons: true
    });
  } catch (err) {
    console.error('Failed to render homepage showcase level:', err);
  }
}

initHomeShowcase();

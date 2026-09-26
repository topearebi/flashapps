/**
 * js/app.js
 * SpeedRecall Application Orchestrator & UI Controller
 */

import { store } from './state.js';
import { RecallEngine } from './engine.js';
import { Normalizer } from './normalizer.js';

// DOM Element Registry
const elements = {
  stage: document.getElementById('stage'),
  prompt: document.getElementById('cardPrompt'),
  subtitle: document.getElementById('cardSubtitle'),
  input: document.getElementById('recallInput'),
  errorBanner: document.getElementById('errorBanner'),
  expectedAnswer: document.getElementById('expectedAnswer'),
  deckSelect: document.getElementById('deckSelect'),
  modeSelect: document.getElementById('modeSelect'),
  drawer: document.getElementById('drawer'),
  drawerToggle: document.getElementById('drawerToggle'),
  drawerClose: document.getElementById('drawerClose'),
  matrixContainer: document.getElementById('matrixContainer'),
  statsActiveCount: document.getElementById('statsActiveCount')
};

// Engine Instance
const engine = new RecallEngine({
  normalizer: Normalizer,
  onCardChange: renderActiveCard,
  onErrorState: renderErrorState
});

// --- UI Rendering Pipelines ---

function renderDeckSelector() {
  if (!elements.deckSelect) return;
  const decks = store.getDeckList();
  const currentActiveId = store.state.activeDeckId;

  elements.deckSelect.innerHTML = '';
  for (const deck of decks) {
    const option = document.createElement('option');
    option.value = deck.id;
    option.textContent = `${deck.name} (${deck.count})`;
    if (deck.id === currentActiveId) {
      option.selected = true;
    }
    elements.deckSelect.appendChild(option);
  }
}

function renderModeSelector() {
  if (!elements.modeSelect) return;
  elements.modeSelect.value = store.state.activeMode || 'standard';
}

function renderActiveCard(card) {
  if (!card) {
    if (elements.prompt) elements.prompt.textContent = '—';
    if (elements.subtitle) elements.subtitle.textContent = 'No cards available in this pool.';
    return;
  }

  // Clear input & error banner
  if (elements.input) {
    elements.input.value = '';
    elements.input.classList.remove('input-error');
  }
  if (elements.errorBanner) {
    elements.errorBanner.hidden = true;
  }

  // Update card content
  if (elements.prompt) elements.prompt.textContent = card.prompt;
  if (elements.subtitle) elements.subtitle.textContent = card.subtitle || '';

  // Update footer statistics
  if (elements.statsActiveCount) {
    const pool = store.getActivePool();
    elements.statsActiveCount.textContent = pool.length;
  }

  // Focus typing arena
  focusInput();
}

function renderErrorState(card, expectedAnswer) {
  if (elements.errorBanner) {
    elements.errorBanner.hidden = false;
  }
  if (elements.expectedAnswer) {
    elements.expectedAnswer.textContent = expectedAnswer || (card.answers ? card.answers[0] : '');
  }
  if (elements.input) {
    elements.input.classList.add('input-error');
  }
}

function triggerSuccessFlash() {
  if (!elements.stage) return;
  elements.stage.classList.remove('stage-flash');
  // Trigger DOM reflow to re-fire CSS animation
  void elements.stage.offsetWidth;
  elements.stage.classList.add('stage-flash');
}

/**
 * Renders the DJT Matrix pills in the slide-out drawer
 */
function renderDrawerMatrix() {
  if (!elements.matrixContainer) return;
  elements.matrixContainer.innerHTML = '';

  const matrix = store.getDeckMatrix();
  const groups = Object.keys(matrix);

  if (groups.length === 0) {
    elements.matrixContainer.innerHTML = '<p class="drawer-empty">No cards found in active deck.</p>';
    return;
  }

  for (const groupName of groups) {
    const groupEl = document.createElement('div');
    groupEl.className = 'matrix-group';

    const groupTitle = document.createElement('h3');
    groupTitle.className = 'matrix-group-title';
    groupTitle.textContent = groupName;
    groupEl.appendChild(groupTitle);

    const units = matrix[groupName];
    for (const unitName of Object.keys(units)) {
      const unitEl = document.createElement('div');
      unitEl.className = 'matrix-unit';

      const unitLabel = document.createElement('span');
      unitLabel.className = 'matrix-unit-label';
      unitLabel.textContent = unitName;
      unitEl.appendChild(unitLabel);

      const pillsContainer = document.createElement('div');
      pillsContainer.className = 'matrix-pills';

      for (const card of units[unitName]) {
        const pill = document.createElement('span');
        pill.className = 'matrix-pill';
        pill.textContent = card.prompt;
        pill.title = `${card.prompt} - ${card.subtitle || ''} (Weight: ${card.weight})`;
        
        // Heatmap indicator: highlight high-error cards
        if (card.weight > 2.0) {
          pill.classList.add('pill-heavy');
        } else if (card.weight <= 0.5) {
          pill.classList.add('pill-mastered');
        }

        pillsContainer.appendChild(pill);
      }

      unitEl.appendChild(pillsContainer);
      groupEl.appendChild(unitEl);
    }

    elements.matrixContainer.appendChild(groupEl);
  }
}

function focusInput() {
  if (elements.input && document.activeElement !== elements.input) {
    // Only autofocus if user isn't interacting with a select, button, or drawer
    const isInteractingWithForm = ['SELECT', 'BUTTON', 'A'].includes(document.activeElement?.tagName);
    if (!isInteractingWithForm && (!elements.drawer || elements.drawer.hidden)) {
      elements.input.focus();
    }
  }
}

// --- Event Listeners & Input Flow ---

function initEventHandlers() {
  // 1. Keystroke evaluation loop
  if (elements.input) {
    elements.input.addEventListener('input', (e) => {
      const currentVal = e.target.value;
      if (engine.isAwaitingErrorAdvance) return;

      const matched = engine.evaluate(currentVal, store.state.activeMode);
      if (matched) {
        triggerSuccessFlash();
        store.recordResult(matched.id, true);
        engine.nextCard();
      }
    });

    elements.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (engine.isAwaitingErrorAdvance) {
          // Acknowledge error reveal and move forward
          engine.clearErrorAndAdvance();
        } else {
          // Surrender active card
          const failedCard = engine.getActiveCard();
          if (failedCard) {
            store.recordResult(failedCard.id, false);
            engine.surrenderActiveCard();
          }
        }
      }
    });
  }

  // 2. Window click auto-refocus
  window.addEventListener('click', (e) => {
    const isInteractive = e.target.closest('button, select, input, a, .nav-interactive, #drawer');
    if (!isInteractive) {
      focusInput();
    }
  });

  // 3. Deck Selector change
  if (elements.deckSelect) {
    elements.deckSelect.addEventListener('change', (e) => {
      store.setActiveDeck(e.target.value);
    });
  }

  // 4. Mode Selector change
  if (elements.modeSelect) {
    elements.modeSelect.addEventListener('change', (e) => {
      store.setEvaluationMode(e.target.value);
    });
  }

  // 5. Drawer Controls
  if (elements.drawerToggle && elements.drawer) {
    elements.drawerToggle.addEventListener('click', () => {
      elements.drawer.hidden = !elements.drawer.hidden;
      if (!elements.drawer.hidden) {
        renderDrawerMatrix();
      } else {
        focusInput();
      }
    });
  }

  if (elements.drawerClose && elements.drawer) {
    elements.drawerClose.addEventListener('click', () => {
      elements.drawer.hidden = true;
      focusInput();
    });
  }
}

// --- Store Lifecycle Event Bindings ---

store.addEventListener('deck-reconciled', () => {
  renderDeckSelector();
  renderDrawerMatrix();
  engine.setPool(store.getActivePool());
});

store.addEventListener('deck-changed', (e) => {
  renderDeckSelector();
  renderModeSelector();
  renderDrawerMatrix();
  engine.setPool(store.getActivePool());
});

store.addEventListener('mode-changed', () => {
  renderModeSelector();
});

store.addEventListener('card-weight-updated', () => {
  // Update matrix view if drawer is open
  if (elements.drawer && !elements.drawer.hidden) {
    renderDrawerMatrix();
  }
});

// --- Application Bootstrapping ---

async function bootstrap() {
  initEventHandlers();
  
  // Register service worker if available
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('./sw.js');
    } catch (err) {
      console.warn('[PWA] Service Worker registration failed:', err);
    }
  }

  // Ingest data and reconcile
  await store.init();

  renderDeckSelector();
  renderModeSelector();
  renderDrawerMatrix();

  // Load cards into roulette wheel
  engine.setPool(store.getActivePool());
  focusInput();
}

bootstrap();

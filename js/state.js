/**
 * js/state.js
 * SpeedRecall Reactive State Store & Non-Destructive Reconciliation Engine
 */

const STORAGE_KEY = 'speedrecall_v2';
const MANIFEST_PATH = './data/manifest.json';
const CURRENT_SCHEMA_VERSION = 3;

class StateStore extends EventTarget {
  constructor() {
    super();
    this.state = this._loadLocalState() || this._createDefaultState();
    this.manifest = null;
    this.isReconciling = false;
  }

  // --- Initial Setup & Persistence ---

  _createDefaultState() {
    return {
      schemaVersion: CURRENT_SCHEMA_VERSION,
      activeDeckId: null,
      activeMode: 'standard', // 'standard' | 'relaxed' | 'strict'
      customWeights: {},      // Persistent weights keyed by card ID: { [cardId]: weight }
      decks: {},              // Full deck objects: { [deckId]: deckData }
      metadata: {
        lastSync: null,
        installedAt: Date.now()
      }
    };
  }

  _loadLocalState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      
      // Ensure basic shape compatibility
      if (!parsed.decks) parsed.decks = {};
      if (!parsed.customWeights) parsed.customWeights = {};
      return parsed;
    } catch (err) {
      console.error('[State] Failed to parse local state:', err);
      return null;
    }
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      this.dispatchEvent(new CustomEvent('state-saved', { detail: this.state }));
    } catch (err) {
      console.error('[State] Failed to persist state to localStorage:', err);
    }
  }

  /**
   * Initializes store, triggers reconciliation with manifest, and sets active deck.
   */
  async init() {
    await this.reconcileWithRemoteManifest();

    // Select default deck if none is set
    if (!this.state.activeDeckId && this.manifest?.defaultDeckId) {
      this.setActiveDeck(this.manifest.defaultDeckId, false);
    } else if (!this.state.activeDeckId && Object.keys(this.state.decks).length > 0) {
      this.setActiveDeck(Object.keys(this.state.decks)[0], false);
    }

    this.save();
    this.dispatchEvent(new CustomEvent('state-ready', { detail: this.state }));
  }

  // --- Non-Destructive Manifest & Deck Reconciliation ---

  async reconcileWithRemoteManifest() {
    if (this.isReconciling) return;
    this.isReconciling = true;

    try {
      // Add timestamp query parameter to bypass intermediate caches
      const manifestRes = await fetch(`${MANIFEST_PATH}?t=${Date.now()}`);
      if (!manifestRes.ok) {
        console.warn('[State] Could not fetch manifest. Operating with cached state.');
        return;
      }

      this.manifest = await manifestRes.json();
      let hasChanges = false;

      // Ensure local schema matches or upgrades cleanly
      if (this.state.schemaVersion !== this.manifest.schemaVersion) {
        this.state.schemaVersion = this.manifest.schemaVersion;
        hasChanges = true;
      }

      // Reconcile each deck listed in manifest
      for (const deckRef of (this.manifest.decks || [])) {
        const existingDeck = this.state.decks[deckRef.id];

        try {
          const deckRes = await fetch(`${deckRef.file}?t=${Date.now()}`);
          if (!deckRes.ok) continue;

          const freshDeckData = await deckRes.json();

          if (!existingDeck) {
            // New deck detected: Ingest and attach any cached custom weights
            this._applyWeightsToDeck(freshDeckData);
            this.state.decks[deckRef.id] = freshDeckData;
            hasChanges = true;
            console.log(`[State] Ingested new deck: ${deckRef.name}`);
          } else {
            // Existing deck detected: Upsert cards non-destructively
            const wasUpdated = this._mergeDeckCards(existingDeck, freshDeckData);
            if (wasUpdated) {
              hasChanges = true;
              console.log(`[State] Reconciled deck data: ${deckRef.name}`);
            }
          }
        } catch (fetchErr) {
          console.warn(`[State] Failed fetching deck file ${deckRef.file}:`, fetchErr);
        }
      }

      if (hasChanges) {
        this.save();
        this.dispatchEvent(new CustomEvent('deck-reconciled', {
          detail: { decks: this.state.decks, activeDeckId: this.state.activeDeckId }
        }));
      }
    } catch (err) {
      console.warn('[State] Reconciliation encountered an issue:', err);
    } finally {
      this.isReconciling = false;
    }
  }

  /**
   * Merges incoming deck content into existing deck.
   * Preserves card error weights while updating card prompts, subtitles, categories, and answers.
   */
  _mergeDeckCards(existingDeck, upstreamDeck) {
    let modified = false;

    if (existingDeck.name !== upstreamDeck.name) {
      existingDeck.name = upstreamDeck.name;
      modified = true;
    }

    if (existingDeck.defaultMode !== upstreamDeck.defaultMode) {
      existingDeck.defaultMode = upstreamDeck.defaultMode;
      modified = true;
    }

    const existingCardMap = new Map((existingDeck.cards || []).map(c => [c.id, c]));
    const mergedCards = [];

    for (const freshCard of (upstreamDeck.cards || [])) {
      const current = existingCardMap.get(freshCard.id);

      if (current) {
        // Retain existing weight, but update definitions/answers/subtitles
        const cardWeight = this.state.customWeights[freshCard.id] ?? current.weight ?? 1.0;
        mergedCards.push({
          ...freshCard,
          weight: cardWeight
        });

        // Check if any card content changed
        if (
          current.prompt !== freshCard.prompt ||
          current.subtitle !== freshCard.subtitle ||
          current.group !== freshCard.group ||
          current.unit !== freshCard.unit ||
          JSON.stringify(current.answers) !== JSON.stringify(freshCard.answers)
        ) {
          modified = true;
        }
      } else {
        // Newly added card in existing deck
        const cardWeight = this.state.customWeights[freshCard.id] ?? freshCard.weight ?? 1.0;
        mergedCards.push({
          ...freshCard,
          weight: cardWeight
        });
        modified = true;
      }
    }

    if (mergedCards.length !== (existingDeck.cards || []).length) {
      modified = true;
    }

    existingDeck.cards = mergedCards;
    return modified;
  }

  _applyWeightsToDeck(deck) {
    if (!deck || !Array.isArray(deck.cards)) return;
    for (const card of deck.cards) {
      if (this.state.customWeights[card.id] !== undefined) {
        card.weight = this.state.customWeights[card.id];
      } else {
        card.weight = card.weight ?? 1.0;
      }
    }
  }

  // --- Card Weight Adjustment (Error Roulette Rules) ---

  recordResult(cardId, isCorrect) {
    const activeDeck = this.getActiveDeck();
    if (!activeDeck || !Array.isArray(activeDeck.cards)) return;

    const card = activeDeck.cards.find(c => c.id === cardId);
    if (!card) return;

    const currentWeight = card.weight ?? 1.0;
    let nextWeight;

    if (isCorrect) {
      nextWeight = Math.max(0.2, Number((currentWeight * 0.7).toFixed(3)));
    } else {
      nextWeight = Number((currentWeight + 1.5).toFixed(3));
    }

    card.weight = nextWeight;
    this.state.customWeights[cardId] = nextWeight;

    this.save();
    this.dispatchEvent(new CustomEvent('card-weight-updated', {
      detail: { cardId, weight: nextWeight, isCorrect }
    }));
  }

  // --- Active Deck & Mode Selection ---

  setActiveDeck(deckId, triggerSave = true) {
    if (!this.state.decks[deckId]) {
      console.warn(`[State] Deck ${deckId} does not exist.`);
      return;
    }

    this.state.activeDeckId = deckId;
    const deck = this.state.decks[deckId];
    if (deck.defaultMode) {
      this.state.activeMode = deck.defaultMode;
    }

    if (triggerSave) this.save();

    this.dispatchEvent(new CustomEvent('deck-changed', {
      detail: { deckId, deck: this.getActiveDeck() }
    }));
  }

  setEvaluationMode(mode) {
    if (!['standard', 'relaxed', 'strict'].includes(mode)) return;
    this.state.activeMode = mode;
    this.save();
    this.dispatchEvent(new CustomEvent('mode-changed', { detail: { mode } }));
  }

  getActiveDeck() {
    return this.state.decks[this.state.activeDeckId] || null;
  }

  getActivePool() {
    const deck = this.getActiveDeck();
    return deck && Array.isArray(deck.cards) ? deck.cards : [];
  }

  getDeckList() {
    return Object.entries(this.state.decks).map(([id, deck]) => ({
      id,
      name: deck.name || id,
      count: Array.isArray(deck.cards) ? deck.cards.length : 0,
      defaultMode: deck.defaultMode || 'standard'
    }));
  }

  /**
   * Generates a 2-level hierarchy (Group -> Unit) for the DJT Drawer Matrix
   */
  getDeckMatrix(deckId = this.state.activeDeckId) {
    const deck = this.state.decks[deckId];
    if (!deck || !Array.isArray(deck.cards)) return {};

    const matrix = {};
    for (const card of deck.cards) {
      const group = card.group || 'General';
      const unit = card.unit || 'Default';

      if (!matrix[group]) matrix[group] = {};
      if (!matrix[group][unit]) matrix[group][unit] = [];

      matrix[group][unit].push({
        id: card.id,
        prompt: card.prompt,
        subtitle: card.subtitle,
        weight: card.weight
      });
    }

    return matrix;
  }
}

export const store = new StateStore();

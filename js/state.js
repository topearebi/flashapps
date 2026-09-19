/**
 * js/state.js - Reactive State Store & Storage Abstraction
 * Manages localStorage synchronization, active pool derivation,
 * dynamic group/unit indexes, and weighted error updates.
 */

export class Store extends EventTarget {
  static STORAGE_KEY = "speedrecall_decks_v1";

  constructor(defaultDecks = {}) {
    super();
    this.defaultDecks = defaultDecks;
    this.decks = {};
    this.currentDeckId = "";
    this.activeMode = "pinyin-number";
    
    // Set of active category keys: Set<"GroupName::UnitName">
    this.selectedUnits = new Set();

    // Session Statistics
    this.stats = {
      correct: 0,
      attempts: 0,
      streak: 0
    };

    this.loadState();
  }

  /**
   * Initializes storage from localStorage or falls back to baseline defaults
   */
  loadState() {
    const raw = localStorage.getItem(Store.STORAGE_KEY);
    if (raw) {
      try {
        this.decks = JSON.parse(raw);
      } catch (err) {
        console.warn("Storage corruption detected. Reverting to defaults.", err);
        this.decks = structuredClone(this.defaultDecks);
      }
    } else {
      this.decks = structuredClone(this.defaultDecks);
      this.saveState();
    }

    const deckKeys = Object.keys(this.decks);
    this.currentDeckId = deckKeys[0] || "";
    
    if (this.currentDeckId && this.decks[this.currentDeckId]) {
      this.activeMode = this.decks[this.currentDeckId].defaultMode || "pinyin-number";
      this.selectAllUnitsForCurrentDeck();
    }
  }

  saveState() {
    try {
      localStorage.setItem(Store.STORAGE_KEY, JSON.stringify(this.decks));
      this.dispatchEvent(new CustomEvent("state-saved"));
    } catch (err) {
      console.error("Failed to write to localStorage:", err);
    }
  }

  getCurrentDeck() {
    return this.decks[this.currentDeckId] || null;
  }

  setDeck(deckId) {
    if (!this.decks[deckId]) return;
    this.currentDeckId = deckId;
    this.activeMode = this.decks[deckId].defaultMode || "pinyin-number";
    this.resetStats();
    this.selectAllUnitsForCurrentDeck();
    this.dispatchEvent(new CustomEvent("deck-changed", { detail: { deckId } }));
  }

  setMode(mode) {
    this.activeMode = mode;
    this.dispatchEvent(new CustomEvent("mode-changed", { detail: { mode } }));
  }

  /**
   * Builds an indexed map of Groups and Units for the current deck:
   * Returns: { [group: string]: Array<string> }
   */
  getCategoryHierarchy() {
    const deck = this.getCurrentDeck();
    if (!deck || !Array.isArray(deck.cards)) return {};

    const hierarchy = {};
    for (const card of deck.cards) {
      const group = card.group || "General";
      const unit = card.unit || "General";
      if (!hierarchy[group]) {
        hierarchy[group] = new Set();
      }
      hierarchy[group].add(unit);
    }

    // Convert internal Sets to Arrays for rendering
    const formatted = {};
    for (const [group, unitSet] of Object.entries(hierarchy)) {
      formatted[group] = Array.from(unitSet).sort();
    }
    return formatted;
  }

  selectAllUnitsForCurrentDeck() {
    this.selectedUnits.clear();
    const hierarchy = this.getCategoryHierarchy();
    for (const [group, units] of Object.entries(hierarchy)) {
      for (const unit of units) {
        this.selectedUnits.add(`${group}::${unit}`);
      }
    }
    this.dispatchEvent(new CustomEvent("categories-changed"));
  }

  deselectAllUnits() {
    this.selectedUnits.clear();
    this.dispatchEvent(new CustomEvent("categories-changed"));
  }

  toggleUnit(group, unit, isSelected) {
    const key = `${group}::${unit}`;
    if (isSelected) {
      this.selectedUnits.add(key);
    } else {
      this.selectedUnits.delete(key);
    }
    this.dispatchEvent(new CustomEvent("categories-changed"));
  }

  /**
   * Filters the active deck cards against selected Units
   * @returns {Array<Object>}
   */
  getActivePool() {
    const deck = this.getCurrentDeck();
    if (!deck || !Array.isArray(deck.cards)) return [];

    return deck.cards.filter((card) => {
      const key = `${card.group || "General"}::${card.unit || "General"}`;
      return this.selectedUnits.has(key);
    });
  }

  /**
   * Updates card weight dynamically:
   * Correct answers decrease error weight; incorrect answers increase error weight.
   */
  recordResult(cardId, isCorrect) {
    this.stats.attempts++;
    if (isCorrect) {
      this.stats.correct++;
      this.stats.streak++;
    } else {
      this.stats.streak = 0;
    }

    const deck = this.getCurrentDeck();
    if (deck) {
      const card = deck.cards.find((c) => c.id === cardId);
      if (card) {
        if (isCorrect) {
          // Decay weight toward floor of 0.2
          card.weight = Math.max(0.2, (card.weight || 1.0) * 0.7);
        } else {
          // Escalate weight
          card.weight = (card.weight || 1.0) + 1.5;
        }
        this.saveState();
      }
    }

    this.dispatchEvent(new CustomEvent("stats-updated", { detail: { ...this.stats } }));
  }

  resetStats() {
    this.stats = { correct: 0, attempts: 0, streak: 0 };
    this.dispatchEvent(new CustomEvent("stats-updated", { detail: { ...this.stats } }));
  }

  /**
   * Appends imported cards to the currently active deck
   */
  appendCards(newCards) {
    const deck = this.getCurrentDeck();
    if (!deck) return;

    deck.cards.push(...newCards);
    this.saveState();
    this.selectAllUnitsForCurrentDeck();
    this.dispatchEvent(new CustomEvent("deck-updated"));
  }

  /**
   * Replaces existing deck collection with parsed JSON data
   */
  replaceDecks(newDecks) {
    this.decks = newDecks;
    this.saveState();
    const firstDeckId = Object.keys(this.decks)[0] || "";
    this.setDeck(firstDeckId);
  }

  /**
   * Hard reset back to default static datasets
   */
  resetToDefaults() {
    this.decks = structuredClone(this.defaultDecks);
    this.saveState();
    const firstDeckId = Object.keys(this.decks)[0] || "";
    this.setDeck(firstDeckId);
  }
}

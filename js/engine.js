/**
 * js/engine.js
 * SpeedRecall Weighted Roulette Sampling Engine
 */

export class RecallEngine {
  constructor({ normalizer, onCardChange, onErrorState }) {
    this.normalizer = normalizer;
    this.onCardChange = onCardChange || (() => {});
    this.onErrorState = onErrorState || (() => {});

    this.pool = [];
    this.activeCard = null;
    this.previousCardId = null;
    this.isAwaitingErrorAdvance = false;
  }

  /**
   * Sets or refreshes the active card pool.
   */
  setPool(cards = []) {
    this.pool = Array.isArray(cards) ? cards : [];
    this.isAwaitingErrorAdvance = false;

    if (this.pool.length === 0) {
      this.activeCard = null;
      this.onCardChange(null);
      return;
    }

    // If current card is no longer in the new pool, select a new one
    if (!this.activeCard || !this.pool.some((c) => c.id === this.activeCard.id)) {
      this.nextCard();
    }
  }

  getActiveCard() {
    return this.activeCard;
  }

  /**
   * Samples next card using fitness-proportionate roulette selection.
   * Prevents immediate back-to-back repetition when pool size >= 2.
   */
  nextCard() {
    if (this.pool.length === 0) {
      this.activeCard = null;
      this.onCardChange(null);
      return;
    }

    if (this.pool.length === 1) {
      this.activeCard = this.pool[0];
      this.onCardChange(this.activeCard);
      return;
    }

    let candidate = null;
    let attempts = 0;

    // Up to 5 attempts to avoid immediate duplicate draw
    while (attempts < 5) {
      candidate = this._rouletteSample();
      if (!this.previousCardId || candidate.id !== this.previousCardId) {
        break;
      }
      attempts++;
    }

    this.activeCard = candidate;
    this.previousCardId = candidate.id;
    this.isAwaitingErrorAdvance = false;
    this.onCardChange(this.activeCard);
  }

  _rouletteSample() {
    let totalWeight = 0;
    for (let i = 0; i < this.pool.length; i++) {
      totalWeight += this.pool[i].weight ?? 1.0;
    }

    if (totalWeight <= 0) {
      return this.pool[Math.floor(Math.random() * this.pool.length)];
    }

    const randomThreshold = Math.random() * totalWeight;
    let accumulated = 0;

    for (let i = 0; i < this.pool.length; i++) {
      accumulated += this.pool[i].weight ?? 1.0;
      if (accumulated >= randomThreshold) {
        return this.pool[i];
      }
    }

    return this.pool[this.pool.length - 1];
  }

  /**
   * Tests input against active card answers.
   */
  evaluate(rawInput, mode = 'standard') {
    if (!this.activeCard || this.isAwaitingErrorAdvance) return null;
    if (!rawInput || rawInput.trim().length === 0) return null;

    const answers = this.activeCard.answers || [];
    for (const ans of answers) {
      if (this.normalizer.isMatch(rawInput, ans, mode)) {
        return this.activeCard;
      }
    }

    return null;
  }

  /**
   * Enters error surrender state.
   */
  surrenderActiveCard() {
    if (!this.activeCard || this.isAwaitingErrorAdvance) return;
    this.isAwaitingErrorAdvance = true;
    const expected = (this.activeCard.answers && this.activeCard.answers[0]) || '';
    this.onErrorState(this.activeCard, expected);
  }

  /**
   * Exits error surrender state and advances.
   */
  clearErrorAndAdvance() {
    if (!this.isAwaitingErrorAdvance) return;
    this.isAwaitingErrorAdvance = false;
    this.nextCard();
  }
}

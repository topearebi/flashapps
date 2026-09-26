/**
 * js/engine.js - SpeedRecall Review Engine
 * Orchestrates:
 *  - Deterministic fitness-proportionate card selection (roulette sampling)
 *  - Immediate keystroke matching via Normalizer
 *  - Error state pauses and explicit card advancement
 */

import { Normalizer } from "./normalizer.js";

export class RecallEngine extends EventTarget {
  constructor(store) {
    super();
    this.store = store;
    this.activeCard = null;
    this.awaitingErrorAdvance = false;

    // React to category or deck mutations from the store
    this.store.addEventListener("categories-changed", () => this.handlePoolChange());
    this.store.addEventListener("deck-changed", () => this.handlePoolChange());
    this.store.addEventListener("deck-updated", () => this.handlePoolChange());
  }

  /**
   * Samples the next card using fitness-proportionate roulette selection.
   * Cards with higher error weights have a proportionally higher probability of appearing.
   * Avoids immediate consecutive repetition when the active pool has more than 1 card.
   *
   * @returns {Object|null}
   */
  pickCard() {
    const pool = this.store.getActivePool();
    if (!pool || pool.length === 0) return null;
    if (pool.length === 1) return pool[0];

    const totalWeight = pool.reduce((acc, c) => acc + (c.weight || 1.0), 0);
    let randomSample = Math.random() * totalWeight;

    for (const card of pool) {
      randomSample -= (card.weight || 1.0);
      if (randomSample <= 0) {
        // Guard against direct immediate repeats
        if (this.activeCard && card.id === this.activeCard.id) {
          continue;
        }
        return card;
      }
    }

    // Fallback if loop finishes due to floating point precision
    return pool.find((c) => !this.activeCard || c.id !== this.activeCard.id) || pool[0];
  }

  /**
   * Advances the engine to the next card in the active pool
   */
  nextCard() {
    this.awaitingErrorAdvance = false;
    this.activeCard = this.pickCard();

    this.dispatchEvent(new CustomEvent("card-changed", {
      detail: {
        card: this.activeCard,
        poolSize: this.store.getActivePool().length
      }
    }));
  }

  /**
   * Re-evaluates current card validity when categories or decks change
   */
  handlePoolChange() {
    const pool = this.store.getActivePool();
    
    // If current card is no longer in the active pool, pick a new one
    if (!this.activeCard || !pool.some((c) => c.id === this.activeCard.id)) {
      this.nextCard();
    } else {
      this.dispatchEvent(new CustomEvent("pool-updated", {
        detail: { poolSize: pool.length }
      }));
    }
  }

  /**
   * Evaluates input in real-time on every keystroke
   * @param {string} rawInput
   * @returns {boolean} Whether an immediate match occurred
   */
  evaluateInput(rawInput) {
    if (this.awaitingErrorAdvance || !this.activeCard) {
      return false;
    }

    const mode = this.store.activeMode;
    const isCorrect = this.activeCard.answers.some((target) => 
      Normalizer.isMatch(rawInput, target, mode)
    );

    if (isCorrect) {
      this.handleSuccess();
      return true;
    }

    return false;
  }

  /**
   * Handles user surrendering or hitting Enter on an incorrect guess
   * @param {string} attemptedInput
   */
  handleFailure(attemptedInput = "") {
    if (!this.activeCard || this.awaitingErrorAdvance) return;

    this.awaitingErrorAdvance = true;
    this.store.recordResult(this.activeCard.id, false);

    this.dispatchEvent(new CustomEvent("evaluation-failure", {
      detail: {
        card: this.activeCard,
        attempted: attemptedInput,
        expected: this.activeCard.answers.join(" / ")
      }
    }));
  }

  handleSuccess() {
    this.store.recordResult(this.activeCard.id, true);

    this.dispatchEvent(new CustomEvent("evaluation-success", {
      detail: { card: this.activeCard }
    }));

    // Micro-delay gives a clear flash feedback without breaking rhythm
    setTimeout(() => {
      this.nextCard();
    }, 110);
  }

  /**
   * Dismisses the error reveal banner and moves to the next card
   */
  acknowledgeError() {
    if (this.awaitingErrorAdvance) {
      this.nextCard();
    }
  }
}

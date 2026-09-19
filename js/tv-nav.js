/**
 * js/tv-nav.js - 10-Foot Spatial Navigation Engine
 * Handles directional D-Pad navigation (Arrow keys / Remote DPAD)
 * across elements flagged with the `.nav-interactive` class.
 */

export class SpatialNavigator {
  constructor(rootContainerSelector = "#app") {
    this.root = document.querySelector(rootContainerSelector);
    this.interactiveSelector = ".nav-interactive:not([disabled]):not([aria-hidden='true'])";
    this.enabled = true;
    this.init();
  }

  init() {
    window.addEventListener("keydown", (e) => this.handleKeyDown(e));
  }

  /**
   * Evaluates keydown events for directional navigation
   * @param {KeyboardEvent} e
   */
  handleKeyDown(e) {
    if (!this.enabled) return;

    const directionMap = {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right"
    };

    const direction = directionMap[e.key];
    if (!direction) return;

    const activeElement = document.activeElement;

    // Allow native text cursor navigation inside textareas or inputs with user text
    if (
      activeElement &&
      (activeElement.tagName === "TEXTAREA" ||
        (activeElement.tagName === "INPUT" && activeElement.type === "text" && activeElement.value.length > 0))
    ) {
      // If user presses Up/Down in input, permit spatial breakout
      if (direction !== "up" && direction !== "down") {
        return;
      }
    }

    const candidates = this.getCandidates();
    if (candidates.length === 0) return;

    // If nothing currently focused, focus the first candidate or stage input
    if (!activeElement || !candidates.includes(activeElement)) {
      const defaultTarget = document.getElementById("recallInput") || candidates[0];
      defaultTarget.focus();
      e.preventDefault();
      return;
    }

    const nextTarget = this.findNearestTarget(activeElement, candidates, direction);
    if (nextTarget) {
      nextTarget.focus();
      e.preventDefault();
    }
  }

  /**
   * Retrieves all currently visible and focusable navigation targets
   * @returns {Array<HTMLElement>}
   */
  getCandidates() {
    const elements = Array.from(document.querySelectorAll(this.interactiveSelector));
    
    // Filter out hidden elements (e.g., inside closed dialogs)
    return elements.filter((el) => {
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).visibility !== "hidden";
    });
  }

  /**
   * Calculates the nearest interactable candidate in the specified 2D direction
   * using Euclidean distance and directional angle weighting.
   */
  findNearestTarget(currentEl, candidates, direction) {
    const currentRect = currentEl.getBoundingClientRect();
    const currentCenter = {
      x: currentRect.left + currentRect.width / 2,
      y: currentRect.top + currentRect.height / 2
    };

    let bestTarget = null;
    let shortestDistance = Infinity;

    for (const target of candidates) {
      if (target === currentEl) continue;

      const targetRect = target.getBoundingClientRect();
      const targetCenter = {
        x: targetRect.left + targetRect.width / 2,
        y: targetRect.top + targetRect.height / 2
      };

      const dx = targetCenter.x - currentCenter.x;
      const dy = targetCenter.y - currentCenter.y;

      // Filter candidates based on whether they sit in the intended direction
      const isValidDirection =
        (direction === "left" && dx < -5) ||
        (direction === "right" && dx > 5) ||
        (direction === "up" && dy < -5) ||
        (direction === "down" && dy > 5);

      if (!isValidDirection) continue;

      // Primary axis weighting to prioritize rectilinear movement
      let distance;
      if (direction === "left" || direction === "right") {
        distance = Math.hypot(dx, dy * 2.2);
      } else {
        distance = Math.hypot(dx * 2.2, dy);
      }

      if (distance < shortestDistance) {
        shortestDistance = distance;
        bestTarget = target;
      }
    }

    return bestTarget;
  }
}

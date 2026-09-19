/**
 * js/app.js - Application Orchestrator & UI Binding Layer
 * Bootstraps async manifest storage, hooks the 3-tier review loop,
 * renders DJT character preview pills, and connects GitHub Cloud Sync.
 */

import { Store } from "./state.js";
import { RecallEngine } from "./engine.js";
import { DataImporter } from "./importer.js";
import { SpatialNavigator } from "./tv-nav.js";
import { GitHubSync } from "./github-sync.js";

class AppController {
  constructor() {
    this.store = new Store();
    this.engine = new RecallEngine(this.store);
    this.spatialNav = new SpatialNavigator("#app");
    this.ghSync = new GitHubSync(this.store);

    this.dom = {
      deckSelect: document.getElementById("deckSelect"),
      modeSelect: document.getElementById("modeSelect"),
      btnToggleDrawer: document.getElementById("btnToggleDrawer"),
      btnCloseDrawer: document.getElementById("btnCloseDrawer"),
      drawerDialog: document.getElementById("drawerDialog"),
      unitCheckboxesGrid: document.getElementById("unitCheckboxesGrid"),
      btnSelectAllUnits: document.getElementById("btnSelectAllUnits"),
      btnDeselectAllUnits: document.getElementById("btnDeselectAllUnits"),
      statAccuracy: document.getElementById("statAccuracy"),
      statStreak: document.getElementById("statStreak"),
      statPoolSize: document.getElementById("statPoolSize"),
      flashcard: document.getElementById("flashcard"),
      cardPrompt: document.getElementById("cardPrompt"),
      cardSubtitle: document.getElementById("cardSubtitle"),
      recallInput: document.getElementById("recallInput"),
      feedbackRegion: document.getElementById("feedbackRegion"),
      tsvInputArea: document.getElementById("tsvInputArea"),
      btnImportTSV: document.getElementById("btnImportTSV"),
      btnExportJSON: document.getElementById("btnExportJSON"),
      inputFileJSON: document.getElementById("inputFileJSON"),
      btnResetDefaults: document.getElementById("btnResetDefaults"),
      // GitHub Cloud Sync Form Controls
      ghTokenInput: document.getElementById("ghTokenInput"),
      ghRepoInput: document.getElementById("ghRepoInput"),
      ghPathInput: document.getElementById("ghPathInput"),
      btnSaveSyncConfig: document.getElementById("btnSaveSyncConfig"),
      btnPullGitHub: document.getElementById("btnPullGitHub"),
      btnPushGitHub: document.getElementById("btnPushGitHub"),
      syncStatusIndicator: document.getElementById("syncStatusIndicator")
    };

    this.init();
  }

  async init() {
    this.bindUIEvents();
    this.bindEngineEvents();
    this.bindSyncEvents();

    // Asynchronously bootstrap baseline decks from data/manifest.json
    await this.store.init();

    this.populateDeckSelect();
    this.populateSyncInputs();
    this.renderCategoryMatrix();
    this.updateStatsDisplay();
    this.engine.nextCard();
  }

  populateDeckSelect() {
    this.dom.deckSelect.innerHTML = "";
    Object.entries(this.store.decks).forEach(([id, deck]) => {
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = deck.name;
      this.dom.deckSelect.appendChild(opt);
    });

    this.dom.deckSelect.value = this.store.currentDeckId;
    this.dom.modeSelect.value = this.store.activeMode;
  }

  populateSyncInputs() {
    if (!this.dom.ghTokenInput) return;
    this.dom.ghTokenInput.value = this.ghSync.config.token || "";
    this.dom.ghRepoInput.value = this.ghSync.config.repo || "";
    this.dom.ghPathInput.value = this.ghSync.config.filePath || "speedrecall-decks.json";
  }

  /**
   * Renders the DJT-style Category Matrix with Dynamic Character Preview Pills
   */
  renderCategoryMatrix() {
    const hierarchy = this.store.getCategoryHierarchy();
    this.dom.unitCheckboxesGrid.innerHTML = "";

    for (const [group, units] of Object.entries(hierarchy)) {
      // Group header tag
      const groupHeader = document.createElement("div");
      groupHeader.className = "group-section-title";
      groupHeader.textContent = group;
      this.dom.unitCheckboxesGrid.appendChild(groupHeader);

      for (const [unit, tokens] of Object.entries(units)) {
        const key = `${group}::${unit}`;

        const cardTile = document.createElement("div");
        cardTile.className = "unit-tile";

        // Unit interactive label & checkbox row
        const headerRow = document.createElement("label");
        headerRow.className = "unit-header-row nav-interactive";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = this.store.selectedUnits.has(key);
        checkbox.dataset.group = group;
        checkbox.dataset.unit = unit;

        checkbox.addEventListener("change", (e) => {
          this.store.toggleUnit(group, unit, e.target.checked);
        });

        const titleSpan = document.createElement("span");
        titleSpan.className = "unit-title-text";
        titleSpan.textContent = unit;

        headerRow.appendChild(checkbox);
        headerRow.appendChild(titleSpan);
        cardTile.appendChild(headerRow);

        // DJT Character Preview Pills (shows the exact tokens inside this unit)
        if (Array.isArray(tokens) && tokens.length > 0) {
          const pillsContainer = document.createElement("div");
          pillsContainer.className = "unit-preview-tokens";

          tokens.forEach((token) => {
            const pill = document.createElement("span");
            pill.className = "token-pill";
            pill.textContent = token;
            pillsContainer.appendChild(pill);
          });

          cardTile.appendChild(pillsContainer);
        }

        this.dom.unitCheckboxesGrid.appendChild(cardTile);
      }
    }
  }

  updateStatsDisplay() {
    const { correct, attempts, streak } = this.store.stats;
    const pct = attempts > 0 ? Math.round((correct / attempts) * 100) : 0;
    this.dom.statAccuracy.textContent = `${pct}%`;
    this.dom.statStreak.textContent = streak;
    this.dom.statPoolSize.textContent = this.store.getActivePool().length;
  }

  setSyncStatus(message, status = "info") {
    if (!this.dom.syncStatusIndicator) return;
    this.dom.syncStatusIndicator.className = `sync-status-indicator ${status}`;
    this.dom.syncStatusIndicator.textContent = message;
  }

  bindUIEvents() {
    // Keep focus inside input when clicking outside interactive elements
    window.addEventListener("click", (e) => {
      if (
        !this.dom.drawerDialog.open &&
        !e.target.closest("button, select, input, textarea, label, summary, details")
      ) {
        this.dom.recallInput.focus();
      }
    });

    // Zero-Friction Keystroke Evaluation
    this.dom.recallInput.addEventListener("input", (e) => {
      this.engine.evaluateInput(e.target.value);
    });

    // Enter Key Handler (Surrender / Next error step)
    this.dom.recallInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        if (this.engine.awaitingErrorAdvance) {
          this.engine.acknowledgeError();
        } else {
          this.engine.handleFailure(this.dom.recallInput.value);
        }
      }
    });

    // Deck Selector
    this.dom.deckSelect.addEventListener("change", (e) => {
      this.store.setDeck(e.target.value);
      this.dom.modeSelect.value = this.store.activeMode;
      this.renderCategoryMatrix();
    });

    // Mode Selector (3 Universal Tiers)
    this.dom.modeSelect.addEventListener("change", (e) => {
      this.store.setMode(e.target.value);
      this.dom.recallInput.focus();
    });

    // Drawer Modal Toggle
    this.dom.btnToggleDrawer.addEventListener("click", () => {
      this.dom.drawerDialog.showModal();
      this.dom.btnToggleDrawer.setAttribute("aria-expanded", "true");
    });

    this.dom.btnCloseDrawer.addEventListener("click", () => {
      this.dom.drawerDialog.close();
    });

    this.dom.drawerDialog.addEventListener("close", () => {
      this.dom.btnToggleDrawer.setAttribute("aria-expanded", "false");
      this.dom.recallInput.focus();
    });

    // Matrix Batch Selection
    this.dom.btnSelectAllUnits.addEventListener("click", () => {
      this.store.selectAllUnitsForCurrentDeck();
      this.renderCategoryMatrix();
    });

    this.dom.btnDeselectAllUnits.addEventListener("click", () => {
      this.store.deselectAllUnits();
      this.renderCategoryMatrix();
    });

    // TSV Batch Importer
    this.dom.btnImportTSV.addEventListener("click", () => {
      const raw = this.dom.tsvInputArea.value;
      if (!raw.trim()) return;

      const { valid, errors } = DataImporter.parseTSV(raw);
      if (valid.length > 0) {
        this.store.appendCards(valid);
        this.renderCategoryMatrix();
        this.dom.tsvInputArea.value = "";
        alert(`Successfully imported ${valid.length} card(s).`);
      }

      if (errors.length > 0) {
        alert(`Notice:\n${errors.slice(0, 5).join("\n")}${errors.length > 5 ? "\n..." : ""}`);
      }
    });

    // JSON Export / Import
    this.dom.btnExportJSON.addEventListener("click", () => {
      DataImporter.triggerJSONDownload(this.store.decks);
    });

    this.dom.inputFileJSON.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const { decks, error } = DataImporter.parseJSON(event.target.result);
        if (error) {
          alert(`Import Error: ${error}`);
          return;
        }
        this.store.replaceDecks(decks);
        this.populateDeckSelect();
        this.renderCategoryMatrix();
        alert("Deck library replaced successfully.");
      };
      reader.readAsText(file);
    });

    // Hard Reset
    this.dom.btnResetDefaults.addEventListener("click", async () => {
      if (confirm("Reset all decks to defaults? Custom added cards will be erased.")) {
        await this.store.resetToDefaults();
        this.populateDeckSelect();
        this.renderCategoryMatrix();
      }
    });
  }

  bindSyncEvents() {
    if (!this.dom.btnSaveSyncConfig) return;

    this.dom.btnSaveSyncConfig.addEventListener("click", () => {
      this.ghSync.saveConfig({
        token: this.dom.ghTokenInput.value.trim(),
        repo: this.dom.ghRepoInput.value.trim(),
        filePath: this.dom.ghPathInput.value.trim() || "speedrecall-decks.json"
      });
      this.setSyncStatus("GitHub settings saved to local device.", "success");
    });

    this.dom.btnPullGitHub.addEventListener("click", async () => {
      this.setSyncStatus("Connecting to GitHub...", "pending");
      const res = await this.ghSync.pullFromRemote();
      if (res.success) {
        this.populateDeckSelect();
        this.renderCategoryMatrix();
        this.setSyncStatus(res.message, "success");
      } else {
        this.setSyncStatus(res.message, "error");
      }
    });

    this.dom.btnPushGitHub.addEventListener("click", async () => {
      this.setSyncStatus("Pushing to GitHub...", "pending");
      const res = await this.ghSync.pushToRemote();
      if (res.success) {
        this.setSyncStatus(res.message, "success");
      } else {
        this.setSyncStatus(res.message, "error");
      }
    });
  }

  bindEngineEvents() {
    this.engine.addEventListener("card-changed", (e) => {
      const { card, poolSize } = e.detail;
      this.dom.statPoolSize.textContent = poolSize;
      this.dom.recallInput.value = "";
      this.dom.flashcard.classList.remove("state-success", "state-error");
      this.dom.feedbackRegion.textContent = "";
      this.dom.feedbackRegion.classList.remove("is-error");

      if (!card) {
        this.dom.cardPrompt.textContent = "—";
        this.dom.cardSubtitle.textContent = "No units selected. Open categories to pick a unit.";
        this.dom.recallInput.disabled = true;
        return;
      }

      this.dom.recallInput.disabled = false;
      this.dom.cardPrompt.textContent = card.prompt;
      this.dom.cardSubtitle.textContent = card.subtitle || "";

      // Adapt direction and script attributes
      const isArabic = /[\u0600-\u06FF]/.test(card.prompt);
      this.dom.cardPrompt.setAttribute("dir", isArabic ? "rtl" : "ltr");
      this.dom.cardPrompt.setAttribute("lang", isArabic ? "ar" : "zh");

      this.dom.recallInput.focus();
    });

    this.engine.addEventListener("evaluation-success", () => {
      this.dom.flashcard.classList.remove("state-error");
      this.dom.flashcard.classList.add("state-success");
      this.updateStatsDisplay();
    });

    this.engine.addEventListener("evaluation-failure", (e) => {
      const { expected } = e.detail;
      this.dom.flashcard.classList.add("state-error");
      this.dom.feedbackRegion.classList.add("is-error");
      this.dom.feedbackRegion.textContent = `Target: ${expected} (Press Enter to continue)`;
      this.updateStatsDisplay();
    });

    this.store.addEventListener("stats-updated", () => {
      this.updateStatsDisplay();
    });
  }
}

// Bootstrap once DOM content is ready
window.addEventListener("DOMContentLoaded", () => {
  new AppController();
});

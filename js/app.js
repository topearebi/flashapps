/**
 * js/app.js - Application Orchestrator & UI Binding Layer
 * Bootstraps the application, mounts baseline decks, hooks input
 * evaluation events, and coordinates UI transitions.
 */

import { Store } from "./state.js";
import { RecallEngine } from "./engine.js";
import { DataImporter } from "./importer.js";
import { SpatialNavigator } from "./tv-nav.js";

// Baseline Seed Datasets (Mandarin HSK 1 & French Verbs)
const DEFAULT_DECKS = {
  "zh-hsk1": {
    name: "Mandarin (HSK 1 Basics)",
    defaultMode: "pinyin-number",
    cards: [
      { id: "zh-1", group: "Pronouns", unit: "Personal", prompt: "你", subtitle: "you", answers: ["ni3"], weight: 1.0 },
      { id: "zh-2", group: "Pronouns", unit: "Personal", prompt: "我", subtitle: "I / me", answers: ["wo3"], weight: 1.0 },
      { id: "zh-3", group: "Pronouns", unit: "Personal", prompt: "他", subtitle: "he / him", answers: ["ta1"], weight: 1.0 },
      { id: "zh-4", group: "Greetings", unit: "Common", prompt: "好", subtitle: "good / well", answers: ["hao3"], weight: 1.0 },
      { id: "zh-5", group: "Numbers", unit: "1 to 5", prompt: "一", subtitle: "one", answers: ["yi1"], weight: 1.0 },
      { id: "zh-6", group: "Numbers", unit: "1 to 5", prompt: "二", subtitle: "two", answers: ["er4"], weight: 1.0 },
      { id: "zh-7", group: "Numbers", unit: "1 to 5", prompt: "三", subtitle: "three", answers: ["san1"], weight: 1.0 },
      { id: "zh-8", group: "Verbs", unit: "Actions", prompt: "认识", subtitle: "to know / recognize", answers: ["ren4shi", "ren4shi5"], weight: 1.0 },
      { id: "zh-9", group: "Verbs", unit: "Actions", prompt: "行", subtitle: "capable / ok", answers: ["xing2"], weight: 1.0 }
    ]
  },
  "fr-verbs": {
    name: "French (Common Verbs)",
    defaultMode: "latin-clean",
    cards: [
      { id: "fr-1", group: "Auxiliary", unit: "Present", prompt: "être (je)", subtitle: "to be", answers: ["suis"], weight: 1.0 },
      { id: "fr-2", group: "Auxiliary", unit: "Present", prompt: "être (nous)", subtitle: "to be", answers: ["sommes"], weight: 1.0 },
      { id: "fr-3", group: "Auxiliary", unit: "Present", prompt: "avoir (j')", subtitle: "to have", answers: ["ai"], weight: 1.0 },
      { id: "fr-4", group: "Auxiliary", unit: "Present", prompt: "avoir (nous)", subtitle: "to have", answers: ["avons"], weight: 1.0 },
      { id: "fr-5", group: "Regular -er", unit: "Present", prompt: "aimer (ils)", subtitle: "to like / love", answers: ["aiment"], weight: 1.0 }
    ]
  }
};

class AppController {
  constructor() {
    this.store = new Store(DEFAULT_DECKS);
    this.engine = new RecallEngine(this.store);
    this.spatialNav = new SpatialNavigator("#app");

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
      btnResetDefaults: document.getElementById("btnResetDefaults")
    };

    this.bindUIEvents();
    this.bindEngineEvents();
    this.initRender();
  }

  initRender() {
    this.populateDeckSelect();
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

  /**
   * Generates the dynamic DJT Kana style category checkbox matrix
   */
  renderCategoryMatrix() {
    const hierarchy = this.store.getCategoryHierarchy();
    this.dom.unitCheckboxesGrid.innerHTML = "";

    for (const [group, units] of Object.entries(hierarchy)) {
      for (const unit of units) {
        const key = `${group}::${unit}`;
        const label = document.createElement("label");
        label.className = "unit-checkbox-label nav-interactive";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = this.store.selectedUnits.has(key);
        checkbox.dataset.group = group;
        checkbox.dataset.unit = unit;

        checkbox.addEventListener("change", (e) => {
          this.store.toggleUnit(group, unit, e.target.checked);
        });

        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(`${group} — ${unit}`));
        this.dom.unitCheckboxesGrid.appendChild(label);
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

  bindUIEvents() {
    // Persistent Focus Lock: keep focus in input if clicked on non-interactive regions
    window.addEventListener("click", (e) => {
      if (
        !this.dom.drawerDialog.open &&
        !e.target.closest("button, select, input, textarea, label, summary, details")
      ) {
        this.dom.recallInput.focus();
      }
    });

    // Zero-Latency Keystroke Evaluation
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

    // Mode Selector
    this.dom.modeSelect.addEventListener("change", (e) => {
      this.store.setMode(e.target.value);
      this.dom.recallInput.focus();
    });

    // Modal Drawer Controls
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

    // Batch Category Controls
    this.dom.btnSelectAllUnits.addEventListener("click", () => {
      this.store.selectAllUnitsForCurrentDeck();
      this.renderCategoryMatrix();
    });

    this.dom.btnDeselectAllUnits.addEventListener("click", () => {
      this.store.deselectAllUnits();
      this.renderCategoryMatrix();
    });

    // TSV Importer
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
    this.dom.btnResetDefaults.addEventListener("click", () => {
      if (confirm("Reset all decks to factory defaults? Custom added cards will be erased.")) {
        this.store.resetToDefaults();
        this.populateDeckSelect();
        this.renderCategoryMatrix();
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
        this.dom.cardSubtitle.textContent = "No units selected. Open settings to check categories.";
        this.dom.recallInput.disabled = true;
        return;
      }

      this.dom.recallInput.disabled = false;
      this.dom.cardPrompt.textContent = card.prompt;
      this.dom.cardSubtitle.textContent = card.subtitle || "";

      // Adapt direction and language attributes
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

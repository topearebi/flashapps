/**
 * js/importer.js - Data Ingestion & Schema Validation Layer
 * Parses and sanitizes:
 *  - Delimited text (TSV / plain-text lines)
 *  - Structured JSON deck backup files
 */

export class DataImporter {
  /**
   * Parses raw delimited text (TSV) into validated card models.
   * Expected format per line:
   * Group \t Unit \t Prompt \t Subtitle \t Answer(s)
   *
   * @param {string} rawText
   * @returns {{ valid: Array<Object>, errors: Array<string> }}
   */
  static parseTSV(rawText) {
    const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const valid = [];
    const errors = [];

    lines.forEach((line, index) => {
      // Discard comment lines
      if (line.startsWith("#")) return;

      const columns = line.split("\t").map((c) => c.trim());

      // Validation: Minimum required columns: Prompt & Answer (if group/unit omitted)
      if (columns.length < 2) {
        errors.push(`Line ${index + 1}: Insufficient columns. Minimum: Prompt and Answer.`);
        return;
      }

      let group = "General";
      let unit = "Unit 1";
      let prompt = "";
      let subtitle = "";
      let rawAnswers = "";

      if (columns.length >= 5) {
        [group, unit, prompt, subtitle, rawAnswers] = columns;
      } else if (columns.length === 4) {
        [group, unit, prompt, rawAnswers] = columns;
      } else if (columns.length === 3) {
        [unit, prompt, rawAnswers] = columns;
      } else {
        [prompt, rawAnswers] = columns;
      }

      if (!prompt || !rawAnswers) {
        errors.push(`Line ${index + 1}: Missing prompt or target answer.`);
        return;
      }

      // Split comma-separated aliases and sanitize
      const answers = rawAnswers
        .split(",")
        .map((a) => a.trim())
        .filter(Boolean);

      if (answers.length === 0) {
        errors.push(`Line ${index + 1}: No valid accepted answers found.`);
        return;
      }

      valid.push({
        id: `card-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        group: group || "General",
        unit: unit || "General",
        prompt,
        subtitle: subtitle || "",
        answers,
        weight: 1.0
      });
    });

    return { valid, errors };
  }

  /**
   * Validates and normalizes imported JSON deck structure
   * @param {string} jsonString
   * @returns {{ decks: Object|null, error: string|null }}
   */
  static parseJSON(jsonString) {
    try {
      const data = JSON.parse(jsonString);

      if (!data || typeof data !== "object" || Array.isArray(data)) {
        return { decks: null, error: "Root must be an object keyed by deck IDs." };
      }

      const sanitizedDecks = {};

      for (const [deckId, deck] of Object.entries(data)) {
        if (!deck.name || !Array.isArray(deck.cards)) {
          return {
            decks: null,
            error: `Deck "${deckId}" missing required "name" (string) or "cards" (array).`
          };
        }

        const validCards = deck.cards
          .filter((card) => card && card.prompt && Array.isArray(card.answers) && card.answers.length > 0)
          .map((card, idx) => ({
            id: card.id || `card-${Date.now()}-${idx}`,
            group: String(card.group || "General").trim(),
            unit: String(card.unit || "General").trim(),
            prompt: String(card.prompt).trim(),
            subtitle: card.subtitle ? String(card.subtitle).trim() : "",
            answers: card.answers.map((a) => String(a).trim()).filter(Boolean),
            weight: typeof card.weight === "number" && card.weight > 0 ? card.weight : 1.0
          }));

        sanitizedDecks[deckId] = {
          name: String(deck.name).trim(),
          defaultMode: deck.defaultMode || "pinyin-number",
          cards: validCards
        };
      }

      return { decks: sanitizedDecks, error: null };
    } catch (err) {
      return { decks: null, error: `Malformed JSON: ${err.message}` };
    }
  }

  /**
   * Generates a downloadable JSON export of the current deck store
   * @param {Object} decks
   * @param {string} filename
   */
  static triggerJSONDownload(decks, filename = `speedrecall-backup-${Date.now()}.json`) {
    const blob = new Blob([JSON.stringify(decks, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }
}

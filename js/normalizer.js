/**
 * js/normalizer.js
 * Pure, deterministic string normalizer supporting:
 *  - Mandarin Pinyin (Number tone, Tone mark, Plain)
 *  - Latin/Romance languages (NFD accent stripping)
 *  - Arabic/Generic transliteration (Whitespace & character normalization)
 */

export const EvaluationModes = Object.freeze({
  PINYIN_NUMBER: "pinyin-number", // e.g. "hao3", "lv4" (strips diacritics, expects digits)
  PINYIN_TONE: "pinyin-tone",     // e.g. "hǎo", "lǜ" (strict accent evaluation)
  PINYIN_PLAIN: "pinyin-plain",   // e.g. "hao", "lu" / "lv" (strips tones completely)
  LATIN_CLEAN: "latin-clean",     // e.g. "reponse" matches "réponse" (NFD diacritic strip)
  STRICT: "strict"                // Exact character-by-character trimmed comparison
});

export class Normalizer {
  /**
   * Primary entry point to compare user input with a target answer
   * @param {string} userInput - Raw string directly from the input element
   * @param {string} targetAnswer - Canonical answer stored in the card model
   * @param {string} mode - One of EvaluationModes
   * @returns {boolean}
   */
  static isMatch(userInput, targetAnswer, mode = EvaluationModes.PINYIN_NUMBER) {
    if (!userInput || !targetAnswer) return false;

    switch (mode) {
      case EvaluationModes.PINYIN_NUMBER:
        return this.toPinyinNumber(userInput) === this.toPinyinNumber(targetAnswer);

      case EvaluationModes.PINYIN_PLAIN:
        return this.toPinyinPlain(userInput) === this.toPinyinPlain(targetAnswer);

      case EvaluationModes.PINYIN_TONE:
        return this.toPinyinTone(userInput) === this.toPinyinTone(targetAnswer);

      case EvaluationModes.LATIN_CLEAN:
        return this.toLatinClean(userInput) === this.toLatinClean(targetAnswer);

      case EvaluationModes.STRICT:
      default:
        return this.toStrict(userInput) === this.toStrict(targetAnswer);
    }
  }

  /**
   * Normalizes for Mandarin Numbered Tones:
   * - Maps 'ü' to 'v'
   * - Strips tone diacritics if entered erroneously
   * - Removes internal and external whitespace
   * - Converts tone 5 (neutral) to empty string for consistent compound comparisons
   */
  static toPinyinNumber(str) {
    return str
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "")
      .replace(/ü/g, "v")
      // Normalize NFD and strip diacritics if any crept into number mode
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      // Convert neutral tone 5 to omission so "ba4ba5" equals "ba4ba"
      .replace(/5/g, "");
  }

  /**
   * Normalizes for Plain/Untoned Speed Drills:
   * - Strips all tone digits (1-5)
   * - Strips all Unicode diacritics
   * - Collapses 'ü' to 'v' (also accepts standard 'u' equivalence)
   * - Strips whitespace
   */
  static toPinyinPlain(str) {
    return str
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "")
      .replace(/[1-5]/g, "")
      .replace(/ü/g, "v")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  /**
   * Normalizes for Pinyin with Diacritics:
   * - Preserves accent marks (using NFC canonical composition)
   * - Lowercases and strips all spaces
   * - Normalizes alternative forms of ü
   */
  static toPinyinTone(str) {
    return str
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "")
      .normalize("NFC");
  }

  /**
   * Normalizes for Romance languages (French, Spanish, etc.):
   * - Strips accents using Unicode NFD decomposition (é -> e, ç -> c, ñ -> n)
   * - Collapses internal multi-spaces to a single space
   * - Lowercases and trims
   */
  static toLatinClean(str) {
    return str
      .toLowerCase()
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ");
  }

  /**
   * Basic exact match fallback:
   * - Lowercase, trim edges, collapse internal multi-spaces
   */
  static toStrict(str) {
    return str
      .toLowerCase()
      .trim()
      .replace(/\s+/g, " ");
  }
}

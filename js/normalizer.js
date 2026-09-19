/**
 * js/normalizer.js - Universal Evaluation & String Transformation Core
 * 
 * Consolidates evaluation into 3 cross-language tiers:
 *  - STANDARD: Frictionless recall. Strips accents/diacritics, maps standard
 *              keyboard approximations (ü -> v), retains structural numbers.
 *  - RELAXED:  Maximum speed. Drops numbers, diacritics, accents, and punctuation.
 *  - STRICT:   Literal orthography. Preserves exact accents, tone marks, and digits.
 */

export const EvaluationModes = Object.freeze({
  STANDARD: "standard", // Smart friction-free (default)
  RELAXED: "relaxed",   // Pure speed (toneless, unaccented)
  STRICT: "strict"      // Exact orthography
});

export class Normalizer {
  /**
   * Primary entry point comparing candidate input with an expected target answer.
   * 
   * @param {string} userInput - Raw string from user input
   * @param {string} targetAnswer - Canonical answer stored in the card model
   * @param {string} mode - One of EvaluationModes (default: STANDARD)
   * @returns {boolean}
   */
  static isMatch(userInput, targetAnswer, mode = EvaluationModes.STANDARD) {
    if (!userInput || !targetAnswer) return false;

    switch (mode) {
      case EvaluationModes.RELAXED:
        return this.toRelaxed(userInput) === this.toRelaxed(targetAnswer);

      case EvaluationModes.STRICT:
        return this.toStrict(userInput) === this.toStrict(targetAnswer);

      case EvaluationModes.STANDARD:
      default:
        return this.toStandard(userInput) === this.toStandard(targetAnswer);
    }
  }

  /**
   * Standard Mode: Frictionless Typing
   * - Lowercases and trims outer whitespace
   * - Collapses internal whitespace sequences into a single space
   * - Replaces 'ü' and 'ǖ'/'ǘ'/'ǚ'/'ǜ' with 'v' for standard keyboard input
   * - Normalizes diacritics to numeric tone digits if tone marks were entered
   * - Strips residual Latin accents (é -> e, ç -> c, ñ -> n) via NFD decomposition
   * - Normalizes neutral tone 5 to empty string so 'ba4ba5' equals 'ba4ba'
   */
  static toStandard(str) {
    let s = str.trim().toLowerCase();

    // Map explicit ü variants to v before decomposition
    s = s.replace(/[üǖǘǚǜ]/g, "v");

    // Convert diacritic pinyin to tone numbers if diacritics were used
    s = this.diacriticPinyinToNumeric(s);

    // Strip remaining Latin diacritics (é -> e, etc.)
    s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    // Normalize whitespace & tone 5 representation
    return s
      .replace(/\s+/g, "")
      .replace(/5/g, "");
  }

  /**
   * Relaxed Mode: Pure Rapid Recall
   * - Passes through the standard normalization pipeline
   * - Strips all tone numbers (1-5)
   * - Strips common punctuation
   */
  static toRelaxed(str) {
    return this.toStandard(str)
      .replace(/[1-5]/g, "")
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?]/g, "");
  }

  /**
   * Strict Mode: Exact Orthography
   * - Lowercases and trims edges
   * - Collapses multiple spaces to a single standard space
   * - Preserves all accents, diacritics, and tone numbers exactly as authored
   */
  static toStrict(str) {
    return str
      .toLowerCase()
      .trim()
      .replace(/\s+/g, " ")
      .normalize("NFC");
  }

  /**
   * Utility helper: Converts tone-marked vowels into standard trailing number pinyin.
   * e.g., 'hǎo' -> 'hao3', 'xué' -> 'xue2', 'lǜ' -> 'lv4'
   */
  static diacriticPinyinToNumeric(str) {
    const toneMap = {
      // First tone (Macron)
      'ā': 'a1', 'ē': 'e1', 'ī': 'i1', 'ō': 'o1', 'ū': 'u1', 'ǖ': 'v1',
      // Second tone (Acute)
      'á': 'a2', 'é': 'e2', 'í': 'i2', 'ó': 'o2', 'ú': 'u2', 'ǘ': 'v2',
      // Third tone (Caron)
      'ǎ': 'a3', 'ě': 'e3', 'ǐ': 'i3', 'ǒ': 'o3', 'ǔ': 'u3', 'ǚ': 'v3',
      // Fourth tone (Grave)
      'à': 'a4', 'è': 'e4', 'ì': 'i4', 'ò': 'o4', 'ù': 'u4', 'ǜ': 'v4'
    };

    let result = str;
    let detectedTone = "";

    // Search for accented vowels and swap with their base letter + tone number
    for (const [accented, replacement] of Object.entries(toneMap)) {
      if (result.includes(accented)) {
        const baseChar = replacement[0];
        detectedTone = replacement[1];
        result = result.replace(new RegExp(accented, "g"), baseChar);
      }
    }

    // If a diacritic was converted and no explicit number is present at the end, append it
    if (detectedTone && !/[1-5]/.test(result)) {
      result += detectedTone;
    }

    return result;
  }
}

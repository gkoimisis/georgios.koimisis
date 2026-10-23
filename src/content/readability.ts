/** Flesch-Kincaid grade level with a simple syllable heuristic (good enough to flag outliers). */

function syllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (w.length === 0) return 0;
  if (w.length <= 3) return 1;
  const trimmed = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  const groups = trimmed.match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}

export interface Readability {
  words: number;
  sentences: number;
  grade: number;
}

export function readability(text: string): Readability {
  const clean = text.replace(/\{[^}]+\}/g, 'amount').replace(/[$%0-9][0-9.,%]*/g, 'number');
  const sentences = Math.max(1, (clean.match(/[.!?]+(\s|$)/g) ?? []).length);
  const words = clean.split(/\s+/).filter((w) => /[a-z]/i.test(w));
  const syl = words.reduce((s, w) => s + syllables(w), 0);
  const n = Math.max(1, words.length);
  const grade = 0.39 * (n / sentences) + 11.8 * (syl / n) - 15.59;
  return { words: words.length, sentences, grade: Math.round(grade * 10) / 10 };
}

export function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

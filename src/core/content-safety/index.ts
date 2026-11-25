/** Mandatory for model output, independent of the optional mild-profanity setting. */
export function normalizeLanguage(text: string): string {
  return text.normalize('NFKD').toLowerCase().replace(/[\p{M}\p{Cf}\u0000-\u0008\u000b-\u001f\u007f-\u009f]/gu, '')
    .replace(/!(?=[a-z])/g, 'i')
    .replace(/[0@13457$]/g, c => ({ '0': 'o', '@': 'a', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '$': 's' })[c]!);
}

const blockedWords = /\b(?:retard\w*|tard|spaz\w*|spastic\w*|mongoloid\w*|nigg\w*|negro\w*|coon\w*|fag(?:s|got\w*)?|homo(?:s|sexuals)?|dykes?|kike\w*|chink\w*|gook\w*|spics?|wetbacks?|beaners?|paki(?:s)?|ragheads?|towelheads?|trann(?:y|ies)|shemales?|sex(?:ual\w*|y|ting)?|porn\w*|hentai|xxx|nudes?|naked|penis\w*|vagina\w*|puss(?:y|ies)|cocks?|dicks?|tits?|boobs?|breasts?|nipples?|ballsack\w*|testicles?|scrotum|anus|anal|cum(?:ming|shot\w*)?|semen|orgasm\w*|masturbat\w*|blowjobs?|handjobs?|erectio\w*|ejaculat\w*|rap(?:e|es|ed|ing|ist\w*)|incest\w*|pedophil\w*|paedophil\w*|necrophil\w*|bestiality|fuck\w*|cunt\w*)\b/i;
const selfHarm = /\b(?:kys|kill\s+(?:your\s*self|urself|yourselves)|go\s+(?:and\s+)?die|you\s+(?:should|deserve\s+to)\s+die|end\s+your\s+(?:own\s+)?life|take\s+your\s+(?:own\s+)?life|hurt\s+yourself|cut\s+yourself|commit\s+suicide|do\s+(?:us|everyone)\s+a\s+favou?r\s+and\s+die)\b/i;
const insultWords = 'stupid|idiot\\w*|moron\\w*|dumb(?:ass)?|imbecile\\w*|loser\\w*|worthless|pathetic|brain\\s*dead|bitch\\w*|asshole\\w*|arsehole\\w*|bastard\\w*|jerk\\w*|douchebag\\w*';
const insults = new RegExp(`\\b(?:${insultWords})\\b`, 'i');
const directedInsult = new RegExp(`\\b(?:you|your|youre|ur|u)\\b.{0,60}\\b(?:${insultWords})\\b|\\b(?:${insultWords})\\b.{0,25}\\b(?:you|your)\\b`, 'i');

export function disallowedModelText(text: string): boolean {
  const normalized = normalizeLanguage(text);
  // Also catch punctuation-separated spellings (r.e.t.a.r.d, k-y-s).
  const joined = normalized.replace(/(?<=[a-z])[._*\-]+(?=[a-z])/g, '');
  if ([normalized, joined].some(value => blockedWords.test(value) || selfHarm.test(value.replace(/[^a-z\s]/g, ' ')))) return true;
  const words = normalized.match(/[\p{L}\p{N}]+/gu) ?? [];
  if (!insults.test(normalized)) return false;
  return words.length <= 8 || directedInsult.test(normalized.replace(/\s+/g, ' '));
}

/** Inspect every string, including tool arguments and summary topics. */
export function disallowedModelOutput(value: unknown): boolean {
  if (typeof value === 'string') return disallowedModelText(value);
  if (Array.isArray(value)) return value.some(disallowedModelOutput);
  return value !== null && typeof value === 'object' && Object.entries(value).some(([key, item]) => disallowedModelText(key) || disallowedModelOutput(item));
}
export class DisallowedOutputError extends Error {
  constructor() { super('Disallowed model output'); }
}

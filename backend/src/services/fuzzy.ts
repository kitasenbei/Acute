/**
 * A small fzf-style fuzzy matcher, in the spirit of fff
 * (https://github.com/dmtrKovalenko/fff): match the query as a *subsequence*
 * of the target (so "btncmp" hits "ButtonComponent"), and score the match by
 * rewarding consecutive runs and word boundaries rather than scattered hits.
 *
 * It's a single greedy forward pass — not the optimal Smith-Waterman that fff's
 * SIMD core uses, but the same ideas (boundary/camel/consecutive bonuses,
 * smart-case, leading-gap penalty) and plenty good for live filename search.
 */

const SCORE_MATCH = 16
const BONUS_BOUNDARY = 8 // match right after a separator (/ _ - . space …)
const BONUS_CAMEL = 7 // lower→Upper or non-digit→digit transition
const BONUS_CONSECUTIVE = 8 // adjacent to the previous matched char
const PENALTY_LEADING_GAP = 0.5 // per skipped char before the first match

type CharClass = 'lower' | 'upper' | 'digit' | 'other'

function classOf(ch: string): CharClass {
  if (ch >= 'a' && ch <= 'z') return 'lower'
  if (ch >= 'A' && ch <= 'Z') return 'upper'
  if (ch >= '0' && ch <= '9') return 'digit'
  return 'other'
}

/** Bonus for a match landing on a "boundary" — segment start or camelCase hump. */
function boundaryBonus(prev: CharClass | null, cur: CharClass): number {
  if (prev === null || prev === 'other') return BONUS_BOUNDARY
  if (prev === 'lower' && cur === 'upper') return BONUS_CAMEL
  if (prev !== 'digit' && cur === 'digit') return BONUS_CAMEL
  return 0
}

/**
 * Score `query` against `text`, or return null if `query` isn't a subsequence.
 * Smart-case: case-insensitive unless the query itself contains an uppercase.
 */
export function fuzzyScore(query: string, text: string): number | null {
  if (!query) return 0
  const smart = /[A-Z]/.test(query)
  const q = smart ? query : query.toLowerCase()
  const hay = smart ? text : text.toLowerCase()

  let qi = 0
  let score = 0
  let consecutive = false
  let firstMatch = -1

  for (let ti = 0; ti < hay.length && qi < q.length; ti++) {
    if (hay[ti] === q[qi]) {
      if (firstMatch < 0) firstMatch = ti
      const prev = ti === 0 ? null : classOf(text[ti - 1])
      let s = SCORE_MATCH + boundaryBonus(prev, classOf(text[ti]))
      if (consecutive) s += BONUS_CONSECUTIVE
      score += s
      consecutive = true
      qi++
    } else {
      consecutive = false
    }
  }

  if (qi < q.length) return null // not a full subsequence — no match
  return score - firstMatch * PENALTY_LEADING_GAP
}

/**
 * Rank an entry for a query. Every space-separated part must match the path
 * (AND); matches that also land in the filename get an extra boost, an exact
 * filename wins outright, and shorter paths break ties.
 */
export function scoreEntry(query: string, relPath: string, name: string): number | null {
  const q = query.trim()
  const parts = q.split(/\s+/).filter(Boolean)
  if (!parts.length) return null

  // A plain query matches just the *name* — the recursive walk already finds
  // nested entries, so matching the full path would drag in a whole folder's
  // subtree merely because an ancestor folder's name matched. Only when the
  // query looks path-like (contains a slash) do we match the relative path.
  const target = q.includes('/') ? relPath : name

  let score = 0
  for (const part of parts) {
    const s = fuzzyScore(part, target)
    if (s === null) return null // a required part didn't match → drop the entry
    score += s
  }

  // An exact filename match is the strongest possible signal — comparing both
  // the full name and the name without its extension (so "report" tops "report.txt").
  if (parts.length === 1) {
    const lower = name.toLowerCase()
    const stem = lower.replace(/\.[^.]+$/, '')
    if (lower === parts[0].toLowerCase() || stem === parts[0].toLowerCase()) score += 200
  }

  // Gently prefer shallower / shorter paths.
  return score - relPath.length * 0.3
}

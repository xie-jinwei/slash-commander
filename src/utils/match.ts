import micromatch from 'micromatch'
import {removeList} from './list'

function match(
  candidates: string[],
  patterns: string[],
  ignore: boolean
): {matched: boolean; matches: string[]} {
  const matches = micromatch(candidates, patterns)
  if (!ignore && matches.length > 0) {
    return {matched: true, matches: matches}
  } else if (ignore && matches.length !== candidates.length) {
    return {matched: true, matches: removeList(candidates, matches)}
  }
  return {matched: false, matches: []}
}

export function Match(
  candidates: string[] | null,
  patterns: string[] | null,
  ignorePatterns: string[] | null
): {matched: boolean; matches: string[]} {
  if (!patterns && !ignorePatterns) {
    return {matched: true, matches: candidates ? candidates : []}
  } else if (patterns) {
    return candidates
      ? match(candidates, patterns, false)
      : {matched: false, matches: []}
  } else if (ignorePatterns) {
    return candidates
      ? match(candidates, ignorePatterns, true)
      : {matched: false, matches: []}
  } else {
    throw new Error('cannot set pattern and ignore pattern at the same time')
  }
}

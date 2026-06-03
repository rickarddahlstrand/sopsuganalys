/**
 * Ventil -> avfallsfraktion-mappning.
 *
 * Info-kolumnen i Sheet9/Sheet11 innehaller fraktionsnamnet som prefix
 * fore ev. kommatecken och extra beskrivning. Observerade monster:
 *   "Rest,"              -> Rest
 *   "Plastic,"           -> Plastic
 *   "Organic,"           -> Organic
 *   "Rest, verksamhet"   -> Rest
 *   "Plastic, verksamhet"-> Plastic
 *   "Rest, h"            -> Rest
 *
 * Sheet5 "Fraction"-kolumnen listar fraktionsnamn utan komma ("Rest",
 * "Plastic", "Organic") och anvands som kanonisk lista.
 *
 * Om Info saknas eller inte matchar nagon Sheet5-fraktion returneras null
 * (kallare behandlar det som "okand fraktion").
 */

export const FRACTION_NAMES_SV = {
  Rest: 'Restavfall',
  Plastic: 'Plast',
  Organic: 'Matavfall',
  Paper: 'Papper',
  Cardboard: 'Kartong',
}

function normalize(text) {
  return String(text || '').trim()
}

function extractFractionFromInfo(info) {
  const s = normalize(info)
  if (!s) return null
  const first = s.split(',')[0].trim()
  if (!first) return null
  return first
}

/**
 * Bygg en Map<valveId, fraction> fran redan parsade rapportfiler.
 *
 * Strategin:
 *   1. Samla alla unika fraktionsnamn fran Sheet5 (kanonisk uppsattning).
 *   2. Skanna Sheet9 + Sheet11 Info-kolumnen for varje ventil.
 *   3. Om Info-prefixet matchar en Sheet5-fraktion → mappa.
 *   4. Om ingen match → lat mappningen vara undefined (getValveFraction returnerar null).
 *
 * Samma ventil kan forekomma i manga filer — vi tar forsta giltiga Info-match
 * eftersom fraktion inte vaxlar mellan manader.
 */
export function buildValveFractionMap(parsedFiles) {
  const map = new Map()
  if (!parsedFiles || parsedFiles.length === 0) return map

  const knownFractions = new Set()
  for (const file of parsedFiles) {
    const fracs = file.sheets?.sheet5?.fractions || []
    for (const row of fracs) {
      const name = normalize(row.fraction)
      if (name) knownFractions.add(name)
    }
  }

  for (const file of parsedFiles) {
    for (const row of file.sheets?.sheet9 || []) {
      if (!row.id || map.has(row.id)) continue
      const frac = extractFractionFromInfo(row.info)
      if (frac && (knownFractions.size === 0 || knownFractions.has(frac))) {
        map.set(row.id, frac)
      }
    }
    for (const row of file.sheets?.sheet11 || []) {
      if (!row.id || map.has(row.id)) continue
      const frac = extractFractionFromInfo(row.info)
      if (frac && (knownFractions.size === 0 || knownFractions.has(frac))) {
        map.set(row.id, frac)
      }
    }
  }

  return map
}

/**
 * Slar upp en ventils fraktion. Returnerar null om okand.
 */
export function getValveFraction(valveId, fractionMap) {
  if (!valveId || !fractionMap) return null
  return fractionMap.get(valveId) || null
}

/**
 * Svensk rubrik for en fraktion — fallback till original om okand.
 */
export function fractionLabelSv(fraction) {
  if (!fraction) return null
  return FRACTION_NAMES_SV[fraction] || fraction
}

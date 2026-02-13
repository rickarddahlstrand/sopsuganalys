/**
 * Module-level footnote registry for PDF export.
 * InfoButton registers text here during printMode render,
 * pdfExport.js reads and renders footnotes at the end of the PDF.
 */
let footnotes = []
let textToNum = new Map()

export function resetFootnotes() {
  footnotes = []
  textToNum = new Map()
}

export function registerFootnote(text) {
  if (textToNum.has(text)) return textToNum.get(text)
  const num = footnotes.length + 1
  footnotes.push({ num, text })
  textToNum.set(text, num)
  return num
}

export function getFootnotes() {
  return [...footnotes]
}

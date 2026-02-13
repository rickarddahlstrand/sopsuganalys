import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { getFootnotes, resetFootnotes } from './footnoteStore'
import { getVersionString } from '../components/layout/Footer'

// Yield to browser so CSS animations (spinner) keep running
const yieldToBrowser = () => new Promise(r => setTimeout(r, 0))

/**
 * Collect element boundary positions within a section for smart page breaks.
 * Returns sorted array of canvas-pixel positions where it's safe to break.
 */
function getBreakPoints(section, scale) {
  const sectionRect = section.getBoundingClientRect()
  const points = [0]

  for (const child of section.children) {
    const rect = child.getBoundingClientRect()
    const top = Math.round((rect.top - sectionRect.top) * scale)
    points.push(top)

    // Also collect grandchildren inside grid containers (individual chart cards)
    if (child.classList?.contains('grid')) {
      for (const gc of child.children) {
        const gcRect = gc.getBoundingClientRect()
        points.push(Math.round((gcRect.top - sectionRect.top) * scale))
      }
    }
  }

  points.push(Math.round(sectionRect.height * scale))
  return [...new Set(points)].sort((a, b) => a - b)
}

/**
 * Find the best break point that doesn't cut through content.
 * Returns a canvas-pixel position <= srcY + maxStripPx.
 */
function findSafeBreakPoint(srcY, maxStripPx, breakPoints) {
  const target = srcY + maxStripPx
  let best = target

  // Find the highest break point that fits within target
  for (let i = breakPoints.length - 1; i >= 0; i--) {
    if (breakPoints[i] <= target && breakPoints[i] > srcY) {
      best = breakPoints[i]
      break
    }
  }

  // If the best point wastes >40% of the page, just cut at target
  if ((best - srcY) < maxStripPx * 0.6) return target
  return best
}

/**
 * Export visible sections to PDF
 * @param {string} facilityName - Name of the facility
 * @param {Function} onProgress - Progress callback (progress%, sectionName)
 */
export async function exportToPdf(facilityName, onProgress = () => {}) {
  const sections = document.querySelectorAll('[data-section]')
  if (sections.length === 0) {
    throw new Error('Inga sektioner att exportera')
  }

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const pageWidth = pdf.internal.pageSize.getWidth()
  const pageHeight = pdf.internal.pageSize.getHeight()
  const margin = 12
  const contentWidth = pageWidth - margin * 2
  const headerHeight = 22
  const footerHeight = 12
  const usableHeight = pageHeight - margin - headerHeight - footerHeight - margin

  // Force light mode: remove 'dark' class from <html>
  const htmlEl = document.documentElement
  const hadDark = htmlEl.classList.contains('dark')
  if (hadDark) htmlEl.classList.remove('dark')

  // Force single-column chart grids for wider bars in PDF (target only 2-col chart grids, not KPI grids)
  const printStyle = document.createElement('style')
  printStyle.setAttribute('data-pdf-export', '')
  printStyle.textContent = `
    [data-section] .md\\:grid-cols-2 {
      grid-template-columns: 1fr !important;
    }
    [data-section] .md\\:grid-cols-2 > * {
      grid-column: span 1 !important;
    }
  `
  document.head.appendChild(printStyle)

  // Wait for grid layout change + Nivo ResizeObserver to re-render charts at full width
  onProgress(2, 'F\u00f6rbereder layout...')
  await new Promise(r => setTimeout(r, 600))

  try {
    // Add header to first page
    addHeader(pdf, facilityName, pageWidth, margin)

    let currentY = margin + headerHeight
    const sectionsArray = Array.from(sections)
    const totalSections = sectionsArray.length

    for (let i = 0; i < totalSections; i++) {
      const section = sectionsArray[i]
      const sectionId = section.getAttribute('data-section')
      const sectionTitle = section.querySelector('h2')?.textContent || sectionId

      // Progress: 0-85% for section capture, 85-100% for footnotes/about/save
      const baseProgress = (i / totalSections) * 85
      onProgress(Math.round(baseProgress), `Renderar: ${sectionTitle}`)
      await yieldToBrowser()

      // Collect element boundaries for smart page breaks (before html2canvas clones)
      const breakPoints = getBreakPoints(section, 2)

      // Capture the actual rendered section
      const canvas = await html2canvas(section, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 1280,
        allowTaint: true,
        onclone: (clonedDoc) => {
          // Force single-column on chart grids only (not KPI grids)
          clonedDoc.querySelectorAll('[data-section] .grid').forEach(el => {
            if (el.classList.contains('md:grid-cols-2')) {
              el.style.gridTemplateColumns = '1fr'
              // Remove col-span on children
              for (const child of el.children) {
                child.style.gridColumn = 'span 1'
              }
            }
          })
          // Clip sections to prevent overflow
          clonedDoc.querySelectorAll('[data-section]').forEach(el => {
            el.style.overflow = 'hidden'
            el.style.maxWidth = '100%'
          })
          // Clip chart containers and scrollable areas
          clonedDoc.querySelectorAll('.overflow-x-auto, .overflow-hidden, .overflow-auto, [class*="rounded-"]').forEach(el => {
            el.style.overflow = 'hidden'
          })
          // Fix SVG rendering
          clonedDoc.querySelectorAll('svg').forEach(svg => {
            svg.style.overflow = 'visible'
          })
          // Fix text vertical alignment in table cells
          clonedDoc.querySelectorAll('td, th').forEach(el => {
            el.style.verticalAlign = 'middle'
            el.style.lineHeight = '1.5'
            el.style.paddingTop = '6px'
            el.style.paddingBottom = '6px'
            el.style.boxSizing = 'border-box'
          })
          // Ensure flex containers in cells align content center
          clonedDoc.querySelectorAll('td > div, th > div').forEach(el => {
            el.style.display = 'flex'
            el.style.alignItems = 'center'
            el.style.gap = '4px'
          })
        }
      })

      const captureProgress = baseProgress + (0.5 / totalSections) * 85
      onProgress(Math.round(captureProgress), `Bearbetar: ${sectionTitle}`)
      await yieldToBrowser()

      const imgData = canvas.toDataURL('image/jpeg', 0.85)
      const imgWidth = contentWidth
      const imgHeight = (canvas.height * imgWidth) / canvas.width

      const pxPerMm = canvas.width / imgWidth
      const availableHeight = pageHeight - footerHeight - margin - currentY

      if (imgHeight <= availableHeight) {
        // Fits on remaining page
        pdf.addImage(imgData, 'JPEG', margin, currentY, imgWidth, imgHeight)
        currentY += imgHeight + 2
      } else {
        // Slice into strips with smart page breaks
        let srcY = 0

        // First strip: fill remaining space on current page
        const firstStripMaxPx = Math.floor(availableHeight * pxPerMm)
        const firstBreakPx = findSafeBreakPoint(srcY, firstStripMaxPx, breakPoints)
        const firstStripPx = firstBreakPx - srcY

        if (firstStripPx > 15 * pxPerMm) {
          // Only place if there's meaningful space (>15mm)
          const firstStripMm = firstStripPx / pxPerMm
          const strip = sliceCanvas(canvas, srcY, firstStripPx)
          const stripData = strip.toDataURL('image/jpeg', 0.85)
          pdf.addImage(stripData, 'JPEG', margin, currentY, imgWidth, firstStripMm)
          srcY = firstBreakPx
        }

        // Remaining strips on new pages
        while (srcY < canvas.height) {
          addFooter(pdf, pageWidth, pageHeight, margin)
          pdf.addPage()
          addHeader(pdf, facilityName, pageWidth, margin)
          currentY = margin + headerHeight

          const remainingPx = canvas.height - srcY
          const fullStripMaxPx = Math.floor(usableHeight * pxPerMm)

          let thisStripPx
          if (remainingPx <= fullStripMaxPx) {
            thisStripPx = remainingPx
          } else {
            const breakPx = findSafeBreakPoint(srcY, fullStripMaxPx, breakPoints)
            thisStripPx = breakPx - srcY
          }

          const thisStripMm = thisStripPx / pxPerMm
          const strip = sliceCanvas(canvas, srcY, thisStripPx)
          const stripData = strip.toDataURL('image/jpeg', 0.85)
          pdf.addImage(stripData, 'JPEG', margin, currentY, imgWidth, thisStripMm)

          srcY += thisStripPx
          currentY += thisStripMm + 2
          await yieldToBrowser()
        }
      }

      // Subtle separator between sections (not after last)
      if (i < totalSections - 1 && currentY < pageHeight - footerHeight - 10) {
        pdf.setDrawColor(226, 232, 240)
        pdf.setLineWidth(0.2)
        pdf.line(margin + 20, currentY, pageWidth - margin - 20, currentY)
        currentY += 2
      }

      const endProgress = baseProgress + (1 / totalSections) * 85
      onProgress(Math.round(endProgress), `Klar: ${sectionTitle}`)
      await yieldToBrowser()
    }

    // Add footer to last content page
    addFooter(pdf, pageWidth, pageHeight, margin)

    // --- Footnotes pages ---
    const footnotes = getFootnotes()
    if (footnotes.length > 0) {
      onProgress(88, 'Skriver f\u00f6rklaringar...')
      await yieldToBrowser()
      addFootnotePages(pdf, footnotes, facilityName, pageWidth, pageHeight, margin, headerHeight, footerHeight)
    }

    // --- About page (last page) ---
    onProgress(94, 'L\u00e4gger till information...')
    await yieldToBrowser()
    addAboutPage(pdf, facilityName, pageWidth, pageHeight, margin, headerHeight, footerHeight)

    onProgress(100, 'Sparar fil...')
    await yieldToBrowser()

    // Generate filename
    const date = new Date().toISOString().split('T')[0]
    const safeName = (facilityName || 'rapport').replace(/[^a-zA-Z0-9\u00e5\u00e4\u00f6\u00c5\u00c4\u00d6\s-]/g, '').replace(/\s+/g, '_')
    const filename = `Servicerapport_${safeName}_${date}.pdf`

    pdf.save(filename)
  } finally {
    // Restore dark mode if it was active
    if (hadDark) htmlEl.classList.add('dark')
    // Remove print-export style override
    printStyle.remove()
    resetFootnotes()
  }
}

/** Slice a horizontal strip from a canvas */
function sliceCanvas(source, srcY, height) {
  const strip = document.createElement('canvas')
  strip.width = source.width
  strip.height = height
  const ctx = strip.getContext('2d')
  ctx.drawImage(source, 0, srcY, source.width, height, 0, 0, source.width, height)
  return strip
}

function addFootnotePages(pdf, footnotes, facilityName, pageWidth, pageHeight, margin, headerHeight, footerHeight) {
  pdf.addPage()
  addHeader(pdf, facilityName, pageWidth, margin)

  let y = margin + headerHeight

  // Title
  pdf.setFontSize(14)
  pdf.setTextColor(15, 23, 42)
  pdf.text('F\u00f6rklaringar', margin, y + 5)
  y += 12

  pdf.setDrawColor(226, 232, 240)
  pdf.setLineWidth(0.3)
  pdf.line(margin, y - 2, pageWidth - margin, y - 2)
  y += 4

  for (const note of footnotes) {
    const numText = `${note.num}.`
    const bodyText = note.text.replace(/\n+/g, ' ').trim()
    const textX = margin + 8
    const maxTextWidth = pageWidth - margin * 2 - 8

    pdf.setFontSize(8)
    const lines = pdf.splitTextToSize(bodyText, maxTextWidth)
    const blockHeight = lines.length * 3.5 + 2

    if (y + blockHeight > pageHeight - footerHeight - margin) {
      addFooter(pdf, pageWidth, pageHeight, margin)
      pdf.addPage()
      addHeader(pdf, facilityName, pageWidth, margin)
      y = margin + headerHeight
    }

    // Footnote number (bold blue)
    pdf.setFontSize(8)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(37, 99, 235)
    pdf.text(numText, margin, y)

    // Footnote text
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(71, 85, 105)
    pdf.text(lines, textX, y)

    y += blockHeight + 1
  }

  addFooter(pdf, pageWidth, pageHeight, margin)
}

function addHeader(pdf, facilityName, pageWidth, margin) {
  const date = new Date().toLocaleDateString('sv-SE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  pdf.setFontSize(18)
  pdf.setTextColor(15, 23, 42)
  pdf.text('Servicerapportanalys', margin, margin + 7)

  if (facilityName) {
    pdf.setFontSize(12)
    pdf.setTextColor(71, 85, 105)
    pdf.text(facilityName, margin, margin + 14)
  }

  pdf.setFontSize(10)
  pdf.setTextColor(148, 163, 184)
  pdf.text(`Exporterad ${date}`, pageWidth - margin, margin + 7, { align: 'right' })

  pdf.setDrawColor(226, 232, 240)
  pdf.setLineWidth(0.5)
  pdf.line(margin, margin + 18, pageWidth - margin, margin + 18)
}

function addAboutPage(pdf, facilityName, pageWidth, pageHeight, margin, headerHeight, footerHeight) {
  pdf.addPage()
  addHeader(pdf, facilityName, pageWidth, margin)

  let y = margin + headerHeight

  // Title
  pdf.setFontSize(14)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(15, 23, 42)
  pdf.text('Om rapporten', margin, y + 5)
  y += 12

  pdf.setDrawColor(226, 232, 240)
  pdf.setLineWidth(0.3)
  pdf.line(margin, y - 2, pageWidth - margin, y - 2)
  y += 6

  // Tool description — Swedish chars via direct Unicode
  pdf.setFontSize(10)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(51, 65, 85)

  const descLines = pdf.splitTextToSize(
    'Denna rapport har genererats av Sopsuganalys, ett analysverktyg f\u00f6r driftrapporter ' +
    'fr\u00e5n sopsuganl\u00e4ggningar. Verktyget l\u00e4ser servicerapporter och genererar statistik, ' +
    'trender, rekommendationer och rapporter. All analys sker lokalt i webbl\u00e4saren ' +
    'och ingen data l\u00e4mnar anv\u00e4ndarens dator.',
    pageWidth - margin * 2
  )
  pdf.text(descLines, margin, y)
  y += descLines.length * 5 + 8

  // Info items
  const version = getVersionString()
  const siteUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const items = [
    { label: 'Verktyg', value: 'Sopsuganalys' },
    { label: 'Version', value: version },
    { label: 'Skapad av', value: 'Rickard Dahlstrand' },
    ...(siteUrl ? [{ label: 'Webbsida', value: siteUrl, url: siteUrl }] : []),
    { label: 'K\u00e4llkod', value: 'github.com/rickarddahlstrand/sopsuganalys', url: 'https://github.com/rickarddahlstrand/sopsuganalys' },
    { label: 'Licens', value: 'Creative Commons Erk\u00e4nnande 4.0 Internationell (CC BY 4.0)', url: 'https://creativecommons.org/licenses/by/4.0/' },
  ]

  for (const item of items) {
    pdf.setFontSize(9)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(100, 116, 139)
    pdf.text(item.label, margin, y)

    pdf.setFont('helvetica', 'normal')
    const valueX = margin + 28
    if (item.url) {
      pdf.setTextColor(37, 99, 235)
      pdf.textWithLink(item.value, valueX, y, { url: item.url })
    } else {
      pdf.setTextColor(15, 23, 42)
      pdf.text(item.value, valueX, y)
    }
    y += 7
  }

  y += 6

  // License notice
  pdf.setDrawColor(226, 232, 240)
  pdf.setLineWidth(0.2)
  pdf.line(margin, y - 2, pageWidth - margin, y - 2)
  y += 4

  pdf.setFontSize(8)
  pdf.setFont('helvetica', 'normal')
  pdf.setTextColor(148, 163, 184)
  const licenseLines = pdf.splitTextToSize(
    'Detta verk \u00e4r licensierat under Creative Commons Erk\u00e4nnande 4.0 Internationell (CC BY 4.0). ' +
    'Du f\u00e5r fritt dela och bearbeta materialet s\u00e5 l\u00e4nge l\u00e4mplig attribution ges. ' +
    'Fullst\u00e4ndig licenstext: creativecommons.org/licenses/by/4.0/',
    pageWidth - margin * 2
  )
  pdf.text(licenseLines, margin, y)

  addFooter(pdf, pageWidth, pageHeight, margin)
}

function addFooter(pdf, pageWidth, pageHeight, margin) {
  const pageNum = pdf.internal.getNumberOfPages()

  pdf.setDrawColor(226, 232, 240)
  pdf.setLineWidth(0.3)
  pdf.line(margin, pageHeight - margin - 6, pageWidth - margin, pageHeight - margin - 6)

  pdf.setFontSize(9)
  pdf.setTextColor(148, 163, 184)
  pdf.text(`Sida ${pageNum}`, pageWidth / 2, pageHeight - margin, { align: 'center' })
}

import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

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

  // Add header to first page
  addHeader(pdf, facilityName, pageWidth, margin)

  let currentY = margin + headerHeight
  const sectionsArray = Array.from(sections)

  for (let i = 0; i < sectionsArray.length; i++) {
    const section = sectionsArray[i]
    const sectionId = section.getAttribute('data-section')
    const sectionTitle = section.querySelector('h2')?.textContent || sectionId

    // Report progress with section name
    const progress = Math.round((i / sectionsArray.length) * 95)
    onProgress(progress, `Bearbetar: ${sectionTitle}`)

    // Create a clone of the section to style it for PDF
    const clone = section.cloneNode(true)
    clone.style.position = 'absolute'
    clone.style.left = '-9999px'
    clone.style.top = '0'
    clone.style.width = '1100px'
    clone.style.backgroundColor = '#ffffff'
    clone.style.color = '#1e293b'
    clone.style.padding = '20px'

    // Force light mode styles on clone
    clone.querySelectorAll('*').forEach(el => {
      el.classList.remove('dark')
      // Override dark mode text colors
      const computed = window.getComputedStyle(el)
      if (computed.color.includes('rgb(')) {
        // Keep the color but ensure it's readable on white
        const color = computed.color
        if (isLightColor(color)) {
          el.style.color = '#334155' // slate-700
        }
      }
    })

    // Fix specific elements for PDF rendering
    clone.querySelectorAll('.dark\\:text-slate-400, .dark\\:text-slate-300, .dark\\:text-slate-200').forEach(el => {
      el.style.color = '#475569' // slate-600
    })
    clone.querySelectorAll('.dark\\:bg-slate-800, .dark\\:bg-slate-900, .dark\\:bg-slate-700').forEach(el => {
      el.style.backgroundColor = '#f8fafc' // slate-50
    })

    document.body.appendChild(clone)

    try {
      // Capture with html2canvas
      const canvas = await html2canvas(clone, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 1100,
        allowTaint: true,
        // Wait for images/charts to render
        onclone: (clonedDoc) => {
          // Additional style fixes in cloned document
          clonedDoc.querySelectorAll('svg').forEach(svg => {
            svg.style.overflow = 'visible'
          })
        }
      })

      const imgData = canvas.toDataURL('image/png')
      const imgWidth = contentWidth
      const imgHeight = (canvas.height * imgWidth) / canvas.width

      // Check if we need a new page
      const availableHeight = pageHeight - footerHeight - currentY

      if (imgHeight > availableHeight) {
        // If image is taller than available space
        if (currentY > margin + headerHeight + 10) {
          // Add to new page if we've already added content
          addFooter(pdf, pageWidth, pageHeight, margin)
          pdf.addPage()
          addHeader(pdf, facilityName, pageWidth, margin)
          currentY = margin + headerHeight
        }

        // If single section is larger than a page, scale it down or split
        if (imgHeight > pageHeight - headerHeight - footerHeight - margin * 2) {
          // Scale down to fit
          const maxHeight = pageHeight - headerHeight - footerHeight - margin * 2
          const scaledWidth = (imgWidth * maxHeight) / imgHeight
          const xOffset = margin + (contentWidth - scaledWidth) / 2
          pdf.addImage(imgData, 'PNG', xOffset, currentY, scaledWidth, maxHeight)
          currentY += maxHeight + 8
        } else {
          pdf.addImage(imgData, 'PNG', margin, currentY, imgWidth, imgHeight)
          currentY += imgHeight + 8
        }
      } else {
        // Fits on current page
        pdf.addImage(imgData, 'PNG', margin, currentY, imgWidth, imgHeight)
        currentY += imgHeight + 8
      }

      // Check if we need new page for next section
      if (currentY > pageHeight - footerHeight - 30 && i < sectionsArray.length - 1) {
        addFooter(pdf, pageWidth, pageHeight, margin)
        pdf.addPage()
        addHeader(pdf, facilityName, pageWidth, margin)
        currentY = margin + headerHeight
      }

    } finally {
      document.body.removeChild(clone)
    }
  }

  // Add footer to last page
  addFooter(pdf, pageWidth, pageHeight, margin)

  onProgress(100, 'Sparar fil...')

  // Generate filename
  const date = new Date().toISOString().split('T')[0]
  const safeName = (facilityName || 'rapport').replace(/[^a-zA-Z0-9åäöÅÄÖ\s-]/g, '').replace(/\s+/g, '_')
  const filename = `Servicerapport_${safeName}_${date}.pdf`

  pdf.save(filename)
}

function addHeader(pdf, facilityName, pageWidth, margin) {
  const date = new Date().toLocaleDateString('sv-SE', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  // Title
  pdf.setFontSize(18)
  pdf.setTextColor(15, 23, 42) // slate-900
  pdf.text('Servicerapportanalys', margin, margin + 7)

  // Facility name
  if (facilityName) {
    pdf.setFontSize(12)
    pdf.setTextColor(71, 85, 105) // slate-600
    pdf.text(facilityName, margin, margin + 14)
  }

  // Date
  pdf.setFontSize(10)
  pdf.setTextColor(148, 163, 184) // slate-400
  pdf.text(`Exporterad ${date}`, pageWidth - margin, margin + 7, { align: 'right' })

  // Divider line
  pdf.setDrawColor(226, 232, 240) // slate-200
  pdf.setLineWidth(0.5)
  pdf.line(margin, margin + 18, pageWidth - margin, margin + 18)
}

function addFooter(pdf, pageWidth, pageHeight, margin) {
  const pageNum = pdf.internal.getNumberOfPages()
  const totalPages = pdf.internal.getNumberOfPages()

  // Divider line
  pdf.setDrawColor(226, 232, 240) // slate-200
  pdf.setLineWidth(0.3)
  pdf.line(margin, pageHeight - margin - 6, pageWidth - margin, pageHeight - margin - 6)

  // Page number
  pdf.setFontSize(9)
  pdf.setTextColor(148, 163, 184) // slate-400
  pdf.text(`Sida ${pageNum}`, pageWidth / 2, pageHeight - margin, { align: 'center' })
}

// Helper to check if a color is light (would be hard to read on white)
function isLightColor(color) {
  const match = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
  if (!match) return false
  const [, r, g, b] = match.map(Number)
  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.7
}

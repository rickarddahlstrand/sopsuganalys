import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

/**
 * Export visible sections to PDF
 * @param {string} facilityName - Name of the facility
 * @param {Function} onProgress - Progress callback (0-100)
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
  const margin = 10
  const contentWidth = pageWidth - margin * 2
  const headerHeight = 20
  const footerHeight = 10

  // Add header to first page
  addHeader(pdf, facilityName, pageWidth, margin)

  let currentY = margin + headerHeight
  const sectionsArray = Array.from(sections)

  for (let i = 0; i < sectionsArray.length; i++) {
    const section = sectionsArray[i]
    onProgress(Math.round((i / sectionsArray.length) * 100))

    // Capture section
    const canvas = await html2canvas(section, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: 1200,
    })

    const imgData = canvas.toDataURL('image/png')
    const imgWidth = contentWidth
    const imgHeight = (canvas.height * imgWidth) / canvas.width

    // Check if we need a new page
    if (currentY + imgHeight > pageHeight - footerHeight) {
      addFooter(pdf, pageWidth, pageHeight, margin)
      pdf.addPage()
      addHeader(pdf, facilityName, pageWidth, margin)
      currentY = margin + headerHeight
    }

    // Add image
    pdf.addImage(imgData, 'PNG', margin, currentY, imgWidth, imgHeight)
    currentY += imgHeight + 5
  }

  // Add footer to last page
  addFooter(pdf, pageWidth, pageHeight, margin)

  onProgress(100)

  // Generate filename
  const date = new Date().toISOString().split('T')[0]
  const safeName = (facilityName || 'rapport').replace(/[^a-zA-Z0-9åäöÅÄÖ]/g, '_')
  const filename = `${safeName}_${date}.pdf`

  pdf.save(filename)
}

function addHeader(pdf, facilityName, pageWidth, margin) {
  const date = new Date().toLocaleDateString('sv-SE')

  pdf.setFontSize(16)
  pdf.setTextColor(30, 41, 59) // slate-800
  pdf.text('Servicerapportanalys', margin, margin + 6)

  if (facilityName) {
    pdf.setFontSize(11)
    pdf.setTextColor(100, 116, 139) // slate-500
    pdf.text(facilityName, margin, margin + 12)
  }

  pdf.setFontSize(9)
  pdf.setTextColor(148, 163, 184) // slate-400
  pdf.text(`Exporterad ${date}`, pageWidth - margin, margin + 6, { align: 'right' })

  // Divider line
  pdf.setDrawColor(226, 232, 240) // slate-200
  pdf.setLineWidth(0.3)
  pdf.line(margin, margin + 16, pageWidth - margin, margin + 16)
}

function addFooter(pdf, pageWidth, pageHeight, margin) {
  const pageNum = pdf.internal.getNumberOfPages()

  pdf.setFontSize(8)
  pdf.setTextColor(148, 163, 184) // slate-400
  pdf.text(`Sida ${pageNum}`, pageWidth / 2, pageHeight - margin, { align: 'center' })
}

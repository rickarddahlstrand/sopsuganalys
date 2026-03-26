import { useState, useEffect } from 'react'
import { X, Upload, Loader2, CheckCircle, AlertCircle, FileSpreadsheet, FileText } from 'lucide-react'
import { useData } from '../../context/DataContext'
import { computeSummaryKpi } from '../../utils/serialize'
import { uploadFacility } from '../../utils/pocketbase'

export default function ShareModal({ isOpen, onClose }) {
  const { state } = useData()
  const [status, setStatus] = useState('idle') // idle, uploading, done, error
  const [error, setError] = useState(null)
  const [facilityName, setFacilityName] = useState('')

  // Derive date range from energiDrift
  const months = state.energiDrift?.energy
  const dateRangeStart = months?.length ? months[0].month : ''
  const dateRangeEnd = months?.length ? months[months.length - 1].month : ''

  const xlsFiles = state.originalXlsFiles || []
  const csvFiles = state.originalCsvFiles || []
  const totalFileCount = xlsFiles.length + csvFiles.length

  // Pre-fill facility name when modal opens
  useEffect(() => {
    if (isOpen) {
      setFacilityName(state.facilityName || '')
    }
  }, [isOpen, state.facilityName])

  const handleUpload = async () => {
    if (!facilityName.trim()) return
    if (totalFileCount === 0) {
      setError('Inga originalfiler att ladda upp. Ladda upp filer igen.')
      setStatus('error')
      return
    }

    setStatus('uploading')
    setError(null)
    try {
      const formData = new FormData()
      formData.append('facility_name', facilityName.trim())
      formData.append('date_range_start', dateRangeStart)
      formData.append('date_range_end', dateRangeEnd)
      formData.append('file_count', totalFileCount)

      for (const file of xlsFiles) {
        formData.append('xls_files', file)
      }
      for (const file of csvFiles) {
        formData.append('csv_files', file)
      }

      // Add summary KPIs for quick listing
      const kpi = computeSummaryKpi(state)
      formData.append('summary_kpi', JSON.stringify(kpi))

      await uploadFacility(formData)
      setStatus('done')
    } catch (err) {
      console.error('Upload failed:', err)
      setError(err.message)
      setStatus('error')
    }
  }

  const handleClose = () => {
    if (status !== 'uploading') {
      onClose()
      setTimeout(() => {
        setStatus('idle')
        setError(null)
      }, 200)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
            Ladda upp till databasen
          </h3>
          <button
            onClick={handleClose}
            disabled={status === 'uploading'}
            className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5">
          {status === 'idle' && (
            <div>
              <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                <Upload className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>

              {/* Facility name input */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Anläggningsnamn
                </label>
                <input
                  type="text"
                  value={facilityName}
                  onChange={e => setFacilityName(e.target.value)}
                  placeholder="Ange anläggningsnamn..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                />
              </div>

              {/* Info summary */}
              <div className="text-sm bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 space-y-2">
                {dateRangeStart && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Period</span>
                    <span className="font-medium text-slate-700 dark:text-slate-200">
                      {dateRangeStart}{dateRangeEnd && dateRangeEnd !== dateRangeStart ? ` — ${dateRangeEnd}` : ''}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Filer att ladda upp</span>
                  <span className="font-medium text-slate-700 dark:text-slate-200">{totalFileCount} st</span>
                </div>
                {xlsFiles.length > 0 && (
                  <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    <span>{xlsFiles.length} XLS-rapport{xlsFiles.length !== 1 ? 'er' : ''}</span>
                  </div>
                )}
                {csvFiles.length > 0 && (
                  <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                    <FileText className="w-3.5 h-3.5" />
                    <span>{csvFiles.length} CSV-loggfil{csvFiles.length !== 1 ? 'er' : ''}</span>
                  </div>
                )}
              </div>

              <p className="text-xs text-slate-400 dark:text-slate-500 mt-3 text-center">
                Originalfilerna laddas upp till databasen tillsammans med sammanfattande nyckeltal.
              </p>
            </div>
          )}

          {status === 'uploading' && (
            <div className="text-center">
              <div className="flex items-center justify-center mb-4">
                <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin" />
              </div>
              <p className="text-slate-600 dark:text-slate-300">
                Laddar upp {totalFileCount} fil{totalFileCount !== 1 ? 'er' : ''}...
              </p>
            </div>
          )}

          {status === 'done' && (
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="text-slate-600 dark:text-slate-300">
                Filerna har laddats upp till databasen!
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {facilityName} — {totalFileCount} fil{totalFileCount !== 1 ? 'er' : ''}
              </p>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
              </div>
              <p className="text-slate-600 dark:text-slate-300 mb-1">
                Något gick fel
              </p>
              <p className="text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 flex gap-3 justify-end">
          {status === 'idle' && (
            <>
              <button
                onClick={handleClose}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Avbryt
              </button>
              <button
                onClick={handleUpload}
                disabled={!facilityName.trim() || totalFileCount === 0}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Upload className="w-4 h-4" />
                Ladda upp
              </button>
            </>
          )}

          {status === 'error' && (
            <div className="flex gap-3">
              <button
                onClick={handleClose}
                className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Stäng
              </button>
              <button
                onClick={handleUpload}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors"
              >
                Försök igen
              </button>
            </div>
          )}

          {(status === 'done' || status === 'uploading') && (
            <button
              onClick={handleClose}
              disabled={status === 'uploading'}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors disabled:opacity-50"
            >
              Stäng
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

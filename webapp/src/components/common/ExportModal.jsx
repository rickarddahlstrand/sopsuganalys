import { useState, useRef } from 'react'
import { X, FileDown, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { exportToPdf } from '../../utils/pdfExport'

export default function ExportModal({ isOpen, onClose, facilityName }) {
  const [status, setStatus] = useState('idle') // idle, exporting, done, error
  const [progress, setProgress] = useState(0)
  const [currentSection, setCurrentSection] = useState('')
  const [error, setError] = useState(null)
  const abortRef = useRef(false)

  const handleExport = async () => {
    setStatus('exporting')
    setProgress(0)
    setError(null)
    abortRef.current = false

    try {
      await exportToPdf(facilityName, (prog, section) => {
        if (abortRef.current) {
          throw new Error('Avbruten av användaren')
        }
        setProgress(prog)
        if (section) setCurrentSection(section)
      })
      setStatus('done')
    } catch (err) {
      if (err.message === 'Avbruten av användaren') {
        setStatus('idle')
      } else {
        console.error('PDF export failed:', err)
        setError(err.message)
        setStatus('error')
      }
    }
  }

  const handleCancel = () => {
    if (status === 'exporting') {
      abortRef.current = true
    } else {
      onClose()
      // Reset state after close animation
      setTimeout(() => {
        setStatus('idle')
        setProgress(0)
        setCurrentSection('')
        setError(null)
      }, 200)
    }
  }

  const handleClose = () => {
    if (status !== 'exporting') {
      onClose()
      setTimeout(() => {
        setStatus('idle')
        setProgress(0)
        setCurrentSection('')
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
            Exportera till PDF
          </h3>
          <button
            onClick={handleClose}
            disabled={status === 'exporting'}
            className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5">
          {status === 'idle' && (
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center">
                <FileDown className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="text-slate-600 dark:text-slate-300 mb-2">
                Exportera alla sektioner till en PDF-fil.
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {facilityName && <span className="font-medium">{facilityName}</span>}
              </p>
            </div>
          )}

          {status === 'exporting' && (
            <div>
              <div className="flex items-center justify-center mb-4">
                <Loader2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400 animate-spin" />
              </div>
              <p className="text-center text-slate-600 dark:text-slate-300 mb-1">
                Skapar PDF...
              </p>
              {currentSection && (
                <p className="text-center text-sm text-slate-500 dark:text-slate-400 mb-4">
                  {currentSection}
                </p>
              )}
              {/* Progress bar */}
              <div className="relative h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 bg-emerald-500 dark:bg-emerald-400 transition-all duration-300 ease-out rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-2">
                {progress}%
              </p>
            </div>
          )}

          {status === 'done' && (
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="text-slate-600 dark:text-slate-300">
                PDF exporterad!
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Filen har laddats ner till din dator.
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
                onClick={handleExport}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white transition-colors flex items-center gap-2"
              >
                <FileDown className="w-4 h-4" />
                Exportera
              </button>
            </>
          )}

          {status === 'exporting' && (
            <button
              onClick={handleCancel}
              className="px-4 py-2 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            >
              Avbryt
            </button>
          )}

          {(status === 'done' || status === 'error') && (
            <button
              onClick={handleClose}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
            >
              Stäng
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

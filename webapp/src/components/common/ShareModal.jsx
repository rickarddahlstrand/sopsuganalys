import { useState } from 'react'
import { X, Share2, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { useData } from '../../context/DataContext'
import { serializeAnalysis } from '../../utils/serialize'
import { uploadAnalysis } from '../../utils/pocketbase'

export default function ShareModal({ isOpen, onClose }) {
  const { state } = useData()
  const [status, setStatus] = useState('idle') // idle, uploading, done, error
  const [error, setError] = useState(null)

  const handleShare = async () => {
    setStatus('uploading')
    setError(null)
    try {
      const payload = serializeAnalysis(state)
      await uploadAnalysis(payload)
      setStatus('done')
    } catch (err) {
      console.error('Share failed:', err)
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
            Dela med nätverket
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
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                <Share2 className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <p className="text-slate-600 dark:text-slate-300 mb-3">
                Genom att dela skickas analysresultaten (ej rådata) till sopsug-nätverket.
              </p>
              <div className="text-left text-sm text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 space-y-1">
                <p className="font-medium text-slate-600 dark:text-slate-300">Delas:</p>
                <p>Anläggningsnamn, analysperiod, energi-, ventil-, larm- och övriga analysresultat.</p>
                <p className="font-medium text-emerald-600 dark:text-emerald-400 mt-2">Dina Excel-filer delas aldrig.</p>
              </div>
            </div>
          )}

          {status === 'uploading' && (
            <div className="text-center">
              <div className="flex items-center justify-center mb-4">
                <Loader2 className="w-8 h-8 text-blue-600 dark:text-blue-400 animate-spin" />
              </div>
              <p className="text-slate-600 dark:text-slate-300">
                Laddar upp analysresultat...
              </p>
            </div>
          )}

          {status === 'done' && (
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="text-slate-600 dark:text-slate-300">
                Analysen har delats med nätverket!
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Andra i nätverket kan nu se och jämföra med din data.
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
                onClick={handleShare}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors flex items-center gap-2"
              >
                <Share2 className="w-4 h-4" />
                Dela med nätverket
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
                onClick={handleShare}
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

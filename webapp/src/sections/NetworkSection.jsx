import { useState, useEffect } from 'react'
import { Globe, Loader2, AlertCircle, ArrowLeft, ArrowRight, BarChart3 } from 'lucide-react'
import { useData } from '../context/DataContext'
import { listAnalyses, getAnalysis, getPb } from '../utils/pocketbase'
import { deserializeAnalysis } from '../utils/serialize'
import { fmt, pct } from '../utils/formatters'
import SectionWrapper from '../components/common/SectionWrapper'

export default function NetworkSection() {
  const { state } = useData()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(1)
  const [retryCount, setRetryCount] = useState(0)

  const pbConfigured = !!getPb()

  useEffect(() => {
    if (!pbConfigured) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    listAnalyses({ page, perPage: 12 })
      .then(result => {
        if (!cancelled) setData(result)
      })
      .catch(err => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [page, pbConfigured, retryCount])

  const handleCompare = (id) => {
    if (state.compareMode) return
    getAnalysis(id)
      .then(record => {
        const parsed = deserializeAnalysis(record)
        window.dispatchEvent(new CustomEvent('sopsug-compare', { detail: { data: parsed, name: parsed.facilityName } }))
      })
      .catch(err => console.error('Compare failed:', err))
  }

  if (!pbConfigured) {
    return (
      <SectionWrapper id="nätverk" title="Nätverk" icon={Globe}>
        <div className="text-center py-12">
          <Globe className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
          <p className="text-slate-500 dark:text-slate-400">
            Nätverksfunktionen är inte konfigurerad.
          </p>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
            Ange PocketBase-URL i miljövariabler eller inställningar för att aktivera delning.
          </p>
        </div>
      </SectionWrapper>
    )
  }

  return (
    <SectionWrapper id="nätverk" title="Nätverk" icon={Globe}>
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      )}

      {error && (
        <div className="text-center py-12">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="text-slate-600 dark:text-slate-300">Kunde inte hämta nätverksdata</p>
          <p className="text-sm text-red-500 dark:text-red-400 mt-1">{error}</p>
          <button
            onClick={() => setRetryCount(c => c + 1)}
            className="mt-4 px-4 py-2 rounded-lg text-sm font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            Försök igen
          </button>
        </div>
      )}

      {!loading && !error && data && data.items?.length === 0 && (
        <div className="text-center py-12">
          <Globe className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-slate-500 dark:text-slate-400">
            Inga delade analyser ännu.
          </p>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
            Bli först med att dela din analys med nätverket!
          </p>
        </div>
      )}

      {!loading && !error && data && data.items?.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.items.map(item => {
              const kpi = item.summary_kpi || {}
              return (
                <div
                  key={item.id}
                  className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-5 ring-1 ring-slate-200/60 dark:ring-slate-700/40 flex flex-col"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {item.facility_name}
                      </h3>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                        {item.date_range_start} — {item.date_range_end}
                      </p>
                    </div>
                    <span className="text-xs text-slate-400 dark:text-slate-500 shrink-0 ml-2">
                      {new Date(item.created).toLocaleDateString('sv-SE')}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center mb-4">
                    <div>
                      <p className="text-xs text-slate-400 dark:text-slate-500">Energi</p>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{fmt(kpi.totalEnergy)} kWh</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 dark:text-slate-500">Tillgängl.</p>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{pct(kpi.overallAvail)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 dark:text-slate-500">Larm</p>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{fmt(kpi.totalAlarms)}</p>
                    </div>
                  </div>

                  <div className="mt-auto">
                    <button
                      onClick={() => handleCompare(item.id)}
                      disabled={state.compareMode}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <BarChart3 className="w-4 h-4" />
                      Jämför
                    </button>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Pagination */}
          {data.totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 mt-6">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 disabled:opacity-30 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-slate-500 dark:text-slate-400">
                Sida {page} av {data.totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
                disabled={page >= data.totalPages}
                className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 disabled:opacity-30 transition-colors"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}
    </SectionWrapper>
  )
}

import { useState, useEffect, useCallback } from 'react'
import { GitCompare, Loader2, AlertCircle, CheckSquare, Square, ArrowLeft, ArrowRight } from 'lucide-react'
import { useData } from '../context/DataContext'
import { listAnalyses, getAnalysis, getPb } from '../utils/pocketbase'
import { deserializeAnalysis } from '../utils/serialize'
import { fmt, pct } from '../utils/formatters'
import SectionWrapper from '../components/common/SectionWrapper'

export const COMPARE_COLORS = ['#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6']

export default function CompareSection() {
  const { state, dispatch } = useData()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [page, setPage] = useState(1)
  const [retryCount, setRetryCount] = useState(0)
  const [loadingIds, setLoadingIds] = useState(new Set())

  const pbConfigured = !!getPb()
  const { compareFacilities, compareMode } = state
  const selectedIds = new Set(compareFacilities.map(f => f.id))

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

  const toggleFacility = useCallback(async (item) => {
    const id = item.id
    if (selectedIds.has(id)) {
      dispatch({ type: 'REMOVE_COMPARE_FACILITY', payload: id })
      return
    }
    if (compareFacilities.length >= 5) return // Max 5

    setLoadingIds(prev => new Set([...prev, id]))
    try {
      const record = await getAnalysis(id)
      const parsed = deserializeAnalysis(record)
      dispatch({
        type: 'ADD_COMPARE_FACILITY',
        payload: { id, name: parsed.facilityName, data: parsed },
      })
    } catch (err) {
      console.error('Failed to load facility:', err)
    } finally {
      setLoadingIds(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }, [selectedIds, compareFacilities.length, dispatch])

  const clearAll = useCallback(() => {
    dispatch({ type: 'CLEAR_COMPARE' })
  }, [dispatch])

  if (!pbConfigured) {
    return (
      <SectionWrapper id="jamfor" title="Jämför" icon={GitCompare}>
        <div className="text-center py-12">
          <GitCompare className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
          <p className="text-slate-500 dark:text-slate-400">
            PocketBase är inte konfigurerad.
          </p>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
            Ange PocketBase-URL i miljövariabler eller inställningar för att jämföra anläggningar.
          </p>
        </div>
      </SectionWrapper>
    )
  }

  return (
    <SectionWrapper id="jamfor" title="Jämför anläggningar" icon={GitCompare}>
      {/* Selected facilities summary */}
      {compareFacilities.length > 0 && (
        <div className="mb-6 bg-blue-50 dark:bg-blue-950/30 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-blue-700 dark:text-blue-300">
              Valda anläggningar ({compareFacilities.length}/5)
            </h4>
            <button
              onClick={clearAll}
              className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 transition-colors"
            >
              Rensa alla
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {compareFacilities.map((f, i) => (
              <span
                key={f.id}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium text-white"
                style={{ backgroundColor: COMPARE_COLORS[i % COMPARE_COLORS.length] }}
              >
                <span className="w-2 h-2 rounded-full bg-white/40" />
                {f.name}
                <button
                  onClick={() => dispatch({ type: 'REMOVE_COMPARE_FACILITY', payload: f.id })}
                  className="ml-1 hover:bg-white/20 rounded-full p-0.5 transition-colors"
                  aria-label={`Ta bort ${f.name}`}
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
          {!compareMode && compareFacilities.length > 0 && (
            <p className="text-xs text-blue-500 dark:text-blue-400 mt-2">
              Jämförelseläget är aktivt. Alla sektioner visar jämförelsedata.
            </p>
          )}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      )}

      {error && (
        <div className="text-center py-12">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
          <p className="text-slate-600 dark:text-slate-300">Kunde inte hämta anläggningar</p>
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
          <GitCompare className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-slate-500 dark:text-slate-400">
            Inga delade analyser ännu.
          </p>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
            Dela analyser via nätverket för att kunna jämföra anläggningar.
          </p>
        </div>
      )}

      {!loading && !error && data && data.items?.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.items.map(item => {
              const kpi = item.summary_kpi || {}
              const isSelected = selectedIds.has(item.id)
              const isLoading = loadingIds.has(item.id)
              const atLimit = compareFacilities.length >= 5 && !isSelected
              const colorIndex = compareFacilities.findIndex(f => f.id === item.id)

              return (
                <button
                  key={item.id}
                  onClick={() => toggleFacility(item)}
                  disabled={isLoading || atLimit}
                  className={`text-left bg-slate-50 dark:bg-slate-800/50 rounded-xl p-5 ring-1 flex flex-col transition-all ${
                    isSelected
                      ? 'ring-2 ring-blue-400 dark:ring-blue-500 shadow-md'
                      : 'ring-slate-200/60 dark:ring-slate-700/40 hover:ring-slate-300 dark:hover:ring-slate-600'
                  } ${atLimit ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                    <div className="shrink-0 ml-2 flex items-center gap-2">
                      {isSelected && colorIndex >= 0 && (
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: COMPARE_COLORS[colorIndex % COMPARE_COLORS.length] }}
                        />
                      )}
                      {isLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
                      ) : isSelected ? (
                        <CheckSquare className="w-5 h-5 text-blue-500 dark:text-blue-400" />
                      ) : (
                        <Square className="w-5 h-5 text-slate-300 dark:text-slate-600" />
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center mb-2">
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

                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-auto pt-1">
                    {new Date(item.created).toLocaleDateString('sv-SE')}
                    {kpi.valveCount != null && ` | ${kpi.valveCount} ventiler`}
                  </p>
                </button>
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

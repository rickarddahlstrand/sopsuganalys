import { useCallback } from 'react'
import { useData } from '../context/DataContext'
import { getAnalysis } from '../utils/pocketbase'
import { deserializeAnalysis } from '../utils/serialize'

export function useCompare() {
  const { state, dispatch } = useData()

  const loadComparison = useCallback(async (analysisId) => {
    const record = await getAnalysis(analysisId)
    const parsed = deserializeAnalysis(record)
    dispatch({
      type: 'SET_COMPARE',
      payload: { data: parsed, name: parsed.facilityName },
    })
  }, [dispatch])

  const clearComparison = useCallback(() => {
    dispatch({ type: 'CLEAR_COMPARE' })
  }, [dispatch])

  return {
    compareData: state.compareData,
    compareName: state.compareName,
    compareMode: state.compareMode,
    loadComparison,
    clearComparison,
  }
}

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
      type: 'ADD_COMPARE_FACILITY',
      payload: { id: analysisId, name: parsed.facilityName, data: parsed },
    })
  }, [dispatch])

  const removeComparison = useCallback((id) => {
    dispatch({ type: 'REMOVE_COMPARE_FACILITY', payload: id })
  }, [dispatch])

  const clearComparison = useCallback(() => {
    dispatch({ type: 'CLEAR_COMPARE' })
  }, [dispatch])

  return {
    compareFacilities: state.compareFacilities,
    compareData: state.compareData,
    compareName: state.compareName,
    compareMode: state.compareMode,
    loadComparison,
    removeComparison,
    clearComparison,
  }
}

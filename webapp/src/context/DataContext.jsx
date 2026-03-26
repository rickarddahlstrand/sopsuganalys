import { createContext, useContext, useReducer } from 'react'

const DataContext = createContext()

const initialState = {
  parsedFiles: null,
  facilityName: null,
  energiDrift: null,
  ventiler: null,
  larm: null,
  sammanfattning: null,
  fraktionAnalys: null,
  grenDjupanalys: null,
  manuellAnalys: null,
  trendanalys: null,
  rekommendationer: null,
  drifterfarenheter: null,
  eventLog: null,
  eventLogFiles: null,
  originalXlsFiles: null,
  originalCsvFiles: null,
  isLoading: false,
  progress: 0,
  progressLabel: '',
  printMode: false,
  compareFacilities: [],  // array of { id, name, data }
  compareMode: false,
  // Derived backwards-compat (kept in sync via reducer)
  compareData: null,
  compareName: null,
  fromNetwork: false,
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET_PARSED_FILES':
      return {
        ...state,
        parsedFiles: action.payload.files || action.payload,
        facilityName: action.payload.facilityName || state.facilityName,
      }
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload }
    case 'SET_PROGRESS':
      return { ...state, progress: action.payload.progress, progressLabel: action.payload.label || '' }
    case 'SET_ANALYSIS':
      return { ...state, [action.key]: action.payload }
    case 'SET_EVENT_LOG_FILES':
      return { ...state, eventLogFiles: action.payload }
    case 'SET_ORIGINAL_FILES':
      return {
        ...state,
        originalXlsFiles: action.payload.xlsFiles,
        originalCsvFiles: action.payload.csvFiles,
      }
    case 'SET_PRINT_MODE':
      return { ...state, printMode: action.payload }
    case 'SET_COMPARE':
      // Legacy single-compare: wrap into compareFacilities
      return {
        ...state,
        compareFacilities: [{ id: '__legacy__', name: action.payload.name, data: action.payload.data }],
        compareData: action.payload.data,
        compareName: action.payload.name,
        compareMode: true,
      }
    case 'ADD_COMPARE_FACILITY': {
      const exists = state.compareFacilities.some(f => f.id === action.payload.id)
      if (exists) return state
      const next = [...state.compareFacilities, action.payload]
      return {
        ...state,
        compareFacilities: next,
        compareData: next[0]?.data || null,
        compareName: next[0]?.name || null,
        compareMode: next.length > 0,
      }
    }
    case 'REMOVE_COMPARE_FACILITY': {
      const next = state.compareFacilities.filter(f => f.id !== action.payload)
      return {
        ...state,
        compareFacilities: next,
        compareData: next[0]?.data || null,
        compareName: next[0]?.name || null,
        compareMode: next.length > 0,
      }
    }
    case 'SET_COMPARE_MODE':
      return { ...state, compareMode: action.payload }
    case 'CLEAR_COMPARE':
      return { ...state, compareFacilities: [], compareData: null, compareName: null, compareMode: false }
    case 'LOAD_FROM_NETWORK': {
      const d = action.payload
      return {
        ...state,
        facilityName: d.facilityName,
        energiDrift: d.energiDrift ?? null,
        ventiler: d.ventiler ?? null,
        larm: d.larm ?? null,
        sammanfattning: d.sammanfattning ?? null,
        fraktionAnalys: d.fraktionAnalys ?? null,
        grenDjupanalys: d.grenDjupanalys ?? null,
        manuellAnalys: d.manuellAnalys ?? null,
        trendanalys: d.trendanalys ?? null,
        rekommendationer: d.rekommendationer ?? null,
        drifterfarenheter: d.drifterfarenheter ?? null,
        parsedFiles: [], // empty array so hasData triggers
        fromNetwork: true,
        isLoading: false,
      }
    }
    case 'RESET':
      return initialState
    default:
      return state
  }
}

export function DataProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  return (
    <DataContext.Provider value={{ state, dispatch }}>
      {children}
    </DataContext.Provider>
  )
}

export function useData() {
  return useContext(DataContext)
}

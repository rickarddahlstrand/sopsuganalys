import { createContext, useContext, useReducer } from 'react'

const DataContext = createContext()

const initialState = {
  parsedFiles: null,
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
  isLoading: false,
  progress: 0,
  progressLabel: '',
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET_PARSED_FILES':
      return { ...state, parsedFiles: action.payload }
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload }
    case 'SET_PROGRESS':
      return { ...state, progress: action.payload.progress, progressLabel: action.payload.label || '' }
    case 'SET_ANALYSIS':
      return { ...state, [action.key]: action.payload }
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

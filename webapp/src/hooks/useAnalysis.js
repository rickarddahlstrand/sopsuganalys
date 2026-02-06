import { useEffect } from 'react'
import { useData } from '../context/DataContext'
import { analyzeEnergiDrift } from '../analysis/energiDrift'
import { analyzeVentiler } from '../analysis/ventiler'
import { analyzeLarm } from '../analysis/larm'
import { analyzeSammanfattning } from '../analysis/sammanfattning'
import { analyzeFraktioner } from '../analysis/fraktionAnalys'
import { analyzeGrenar } from '../analysis/grenDjupanalys'
import { analyzeManuell } from '../analysis/manuellAnalys'
import { analyzeTrender } from '../analysis/trendanalys'
import { generateRekommendationer } from '../analysis/rekommendationer'
import { analyzeDrifterfarenheter } from '../analysis/drifterfarenheter'

/**
 * Orchestrates the analysis pipeline progressively.
 * Phase A: energiDrift + ventiler + larm (fast, ~100ms)
 * Phase B: sammanfattning + fraktionAnalys + grenDjupanalys + manuellAnalys (independent)
 * Phase C: trendanalys (requires Phase A)
 * Phase D: rekommendationer + drifterfarenheter (requires Phase C)
 */
export function useAnalysis() {
  const { state, dispatch } = useData()

  useEffect(() => {
    if (!state.parsedFiles) return
    if (state.energiDrift) return // already ran

    const files = state.parsedFiles
    dispatch({ type: 'SET_LOADING', payload: true })

    async function run() {
      try {
        // Phase A: Core analysis
        dispatch({ type: 'SET_PROGRESS', payload: { progress: 10, label: 'Analyserar energi & drift...' } })
        await tick()
        const energiDrift = analyzeEnergiDrift(files)
        dispatch({ type: 'SET_ANALYSIS', key: 'energiDrift', payload: energiDrift })

        dispatch({ type: 'SET_PROGRESS', payload: { progress: 20, label: 'Analyserar ventiler...' } })
        await tick()
        const ventilerResult = analyzeVentiler(files)
        dispatch({ type: 'SET_ANALYSIS', key: 'ventiler', payload: ventilerResult })

        dispatch({ type: 'SET_PROGRESS', payload: { progress: 30, label: 'Analyserar larm...' } })
        await tick()
        const larmResult = analyzeLarm(files)
        dispatch({ type: 'SET_ANALYSIS', key: 'larm', payload: larmResult })

        // Phase B: Extended analysis (independent)
        dispatch({ type: 'SET_PROGRESS', payload: { progress: 40, label: 'Analyserar sammanfattning...' } })
        await tick()
        const sammanfattningResult = analyzeSammanfattning(files)
        dispatch({ type: 'SET_ANALYSIS', key: 'sammanfattning', payload: sammanfattningResult })

        dispatch({ type: 'SET_PROGRESS', payload: { progress: 50, label: 'Analyserar fraktioner...' } })
        await tick()
        const fraktionResult = analyzeFraktioner(files)
        dispatch({ type: 'SET_ANALYSIS', key: 'fraktionAnalys', payload: fraktionResult })

        dispatch({ type: 'SET_PROGRESS', payload: { progress: 60, label: 'Analyserar grenar...' } })
        await tick()
        const grenResult = analyzeGrenar(files)
        dispatch({ type: 'SET_ANALYSIS', key: 'grenDjupanalys', payload: grenResult })

        dispatch({ type: 'SET_PROGRESS', payload: { progress: 65, label: 'Analyserar manuella körningar...' } })
        await tick()
        const manuellResult = analyzeManuell(files)
        dispatch({ type: 'SET_ANALYSIS', key: 'manuellAnalys', payload: manuellResult })

        // Phase C: Trends (requires Phase A)
        dispatch({ type: 'SET_PROGRESS', payload: { progress: 75, label: 'Beräknar trender...' } })
        await tick()
        const trendResult = analyzeTrender(files, energiDrift, ventilerResult, larmResult)
        dispatch({ type: 'SET_ANALYSIS', key: 'trendanalys', payload: trendResult })

        // Phase D: Recommendations + operational experience (requires Phase C)
        dispatch({ type: 'SET_PROGRESS', payload: { progress: 85, label: 'Genererar rekommendationer...' } })
        await tick()
        const rekResult = generateRekommendationer(trendResult, ventilerResult, larmResult)
        dispatch({ type: 'SET_ANALYSIS', key: 'rekommendationer', payload: rekResult })

        dispatch({ type: 'SET_PROGRESS', payload: { progress: 95, label: 'Analyserar drifterfarenheter...' } })
        await tick()
        const driftResult = analyzeDrifterfarenheter(trendResult, ventilerResult, manuellResult, larmResult)
        dispatch({ type: 'SET_ANALYSIS', key: 'drifterfarenheter', payload: driftResult })

        dispatch({ type: 'SET_PROGRESS', payload: { progress: 100, label: 'Klar!' } })
      } catch (err) {
        console.error('Analysis pipeline error:', err)
      } finally {
        dispatch({ type: 'SET_LOADING', payload: false })
      }
    }

    run()
  }, [state.parsedFiles])
}

// Yield to the browser to allow UI updates
function tick() {
  return new Promise(resolve => setTimeout(resolve, 0))
}

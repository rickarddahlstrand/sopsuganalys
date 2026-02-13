/**
 * Trend line layer for Nivo bar charts.
 * Calculates linear regression and draws a dashed line.
 */

import { linregress } from '../../stats/linregress'

/**
 * Creates a trend line layer function for ResponsiveBar.
 * @param {string} valueKey - The key in data containing the y-value (e.g., 'value', 'total')
 * @param {string} color - Line color (default: slate gray)
 * @returns {Function} Layer function for Nivo
 */
export function createTrendLineLayer(valueKey = 'value', color = '#64748b') {
  return ({ bars, xScale, yScale }) => {
    if (!bars || bars.length < 2) return null

    // Extract values in order
    const values = bars.map(bar => bar.data.data[valueKey] ?? bar.data.value)
    const xIndices = bars.map((_, i) => i)

    // Calculate regression
    const reg = linregress(xIndices, values)
    if (reg.trendClass === 'otillräcklig_data') return null

    // Calculate line endpoints
    const x1 = bars[0].x + bars[0].width / 2
    const x2 = bars[bars.length - 1].x + bars[bars.length - 1].width / 2
    const y1 = yScale(reg.intercept)
    const y2 = yScale(reg.intercept + reg.slope * (bars.length - 1))

    return (
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={color}
        strokeWidth={2}
        strokeDasharray="6,4"
        strokeLinecap="round"
      />
    )
  }
}

/**
 * Creates a trend line layer for horizontal bar charts.
 */
export function createHorizontalTrendLineLayer(valueKey = 'value', color = '#64748b') {
  return ({ bars, xScale, yScale }) => {
    if (!bars || bars.length < 2) return null

    // For horizontal bars, we need to reverse the logic
    const values = bars.map(bar => bar.data.data[valueKey] ?? bar.data.value)
    const yIndices = bars.map((_, i) => i)

    const reg = linregress(yIndices, values)
    if (reg.trendClass === 'otillräcklig_data') return null

    // For horizontal charts: y is the category axis, x is the value axis
    const y1 = bars[0].y + bars[0].height / 2
    const y2 = bars[bars.length - 1].y + bars[bars.length - 1].height / 2
    const x1 = xScale(reg.intercept)
    const x2 = xScale(reg.intercept + reg.slope * (bars.length - 1))

    return (
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={color}
        strokeWidth={2}
        strokeDasharray="6,4"
        strokeLinecap="round"
      />
    )
  }
}

// Pre-configured trend line layers
export const trendLineLayer = createTrendLineLayer()
export const trendLineLayerGray = createTrendLineLayer('value', '#94a3b8')

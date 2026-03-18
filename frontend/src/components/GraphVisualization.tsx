import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { compile } from 'mathjs'

interface GraphConfig {
  type: 'function'
  expr: string
  params: Record<string, number>
  xRange?: [number, number]
}

interface Props {
  config: GraphConfig
  onInteract: (message: string) => void
}

export function GraphVisualization({ config, onInteract }: Props) {
  const xRange = useMemo(() => config.xRange ?? [-10, 10], [config.xRange])
  const [params, setParams] = useState(config.params)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const compiled = useMemo(() => {
    try { return compile(config.expr) } catch { return null }
  }, [config.expr])

  const generateData = useCallback((currentParams: Record<string, number>) => {
    if (!compiled) return []
    const points: { x: number; y: number }[] = []
    const steps = 80
    const step = (xRange[1] - xRange[0]) / steps
    for (let i = 0; i <= steps; i++) {
      const x = xRange[0] + i * step
      try {
        const y = compiled.evaluate({ ...currentParams, x })
        if (typeof y === 'number' && isFinite(y)) {
          points.push({ x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 })
        }
      } catch { /* skip */ }
    }
    return points
  }, [compiled, xRange])

  const [data, setData] = useState(() => generateData(config.params))

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  const handleParamChange = useCallback((name: string, value: number) => {
    const newParams = { ...params, [name]: value }
    setParams(newParams)
    setData(generateData(newParams))

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      const paramDesc = Object.entries(newParams).map(([k, v]) => `${k}=${v}`).join(', ')
      onInteract(`グラフのパラメータを変更しました: y = ${config.expr} で ${paramDesc} に設定しました。どんな変化が見えますか？`)
    }, 1500)
  }, [params, generateData, onInteract, config.expr])

  return (
    <div className="my-3 p-4 bg-white border border-gray-200 rounded-xl shadow-sm">
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="x" type="number" domain={['auto', 'auto']} tickCount={7} tick={{ fontSize: 11 }} />
          <YAxis type="number" domain={['auto', 'auto']} tick={{ fontSize: 11 }} width={40} />
          <Tooltip formatter={(v) => (typeof v === 'number' ? v.toFixed(2) : v)} />
          <Line type="monotone" dataKey="y" stroke="#3b82f6" dot={false} strokeWidth={2} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
      <div className="mt-3 space-y-2">
        {Object.entries(params).map(([name, value]) => (
          <div key={name} className="flex items-center gap-3">
            <span className="text-sm font-mono w-5 text-gray-600">{name}</span>
            <input
              type="range"
              min={-5}
              max={5}
              step={0.1}
              value={value}
              onChange={e => handleParamChange(name, parseFloat(e.target.value))}
              className="flex-1 accent-blue-600"
            />
            <span className="text-sm font-mono w-10 text-right text-gray-700">{value.toFixed(1)}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-gray-400 mt-2">y = {config.expr}</p>
    </div>
  )
}

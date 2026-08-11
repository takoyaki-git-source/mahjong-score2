'use client'

import { useRef, useState, type PointerEvent } from 'react'

type Point = { date: string; value: number }

// Server Components can't pass functions to Client Components as props
// (not serializable across the RSC boundary), so formatting is driven by
// these plain string/boolean flags instead of formatter callbacks.
type Props = {
  title: string
  data: Point[]
  color: string
  higherIsBetter?: boolean
  format?: 'pt' | 'rank'
  monthly?: boolean
}

const WIDTH = 600
const HEIGHT = 200
const PAD = { top: 16, right: 12, bottom: 24, left: 44 }

function formatValue(v: number, format: 'pt' | 'rank') {
  if (format === 'rank') return v.toFixed(2)
  const rounded = Math.round(v * 10) / 10
  return `${rounded > 0 ? '+' : ''}${rounded}`
}

function formatDate(d: string, monthly: boolean) {
  return monthly ? d.slice(0, 7) : d
}

export default function TrendChart({
  title,
  data,
  color,
  higherIsBetter = true,
  format = 'pt',
  monthly = false,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-surface p-4">
        <p className="mb-2 text-sm font-medium">{title}</p>
        <p className="text-sm text-foreground-soft">データがありません。</p>
      </div>
    )
  }

  const innerW = WIDTH - PAD.left - PAD.right
  const innerH = HEIGHT - PAD.top - PAD.bottom

  const toTs = (d: string) => new Date(`${d}T00:00:00Z`).getTime()
  const timestamps = data.map((p) => toTs(p.date))
  const minTs = Math.min(...timestamps)
  const maxTs = Math.max(...timestamps)
  const values = data.map((p) => p.value)
  const minV = Math.min(...values)
  const maxV = Math.max(...values)
  const vRange = maxV - minV || 1

  function xFor(ts: number) {
    return PAD.left + (maxTs === minTs ? innerW / 2 : ((ts - minTs) / (maxTs - minTs)) * innerW)
  }
  function yFor(v: number) {
    const frac = (v - minV) / vRange
    const flipped = higherIsBetter ? 1 - frac : frac
    return PAD.top + flipped * innerH
  }

  const points = data.map((p) => ({ x: xFor(toTs(p.date)), y: yFor(p.value), ...p }))
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const yTicks = [minV, (minV + maxV) / 2, maxV]
  const last = points[points.length - 1]

  function handleMove(e: PointerEvent<SVGRectElement>) {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * WIDTH
    let nearest = 0
    let nearestDist = Infinity
    points.forEach((p, i) => {
      const d = Math.abs(p.x - px)
      if (d < nearestDist) {
        nearestDist = d
        nearest = i
      }
    })
    setHoverIdx(nearest)
  }

  const hovered = hoverIdx != null ? points[hoverIdx] : null

  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <p className="mb-2 text-sm font-medium">{title}</p>
      <div className="relative">
        <svg ref={svgRef} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full">
          {yTicks.map((t, i) => (
            <g key={i}>
              <line
                x1={PAD.left}
                x2={WIDTH - PAD.right}
                y1={yFor(t)}
                y2={yFor(t)}
                stroke="var(--line)"
                strokeWidth={1}
              />
              <text
                x={PAD.left - 6}
                y={yFor(t)}
                textAnchor="end"
                dominantBaseline="middle"
                fill="var(--foreground-soft)"
                fontSize={10}
              >
                {formatValue(t, format)}
              </text>
            </g>
          ))}

          <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

          <circle cx={last.x} cy={last.y} r={4} fill={color} stroke="var(--surface)" strokeWidth={2} />
          <text x={last.x} y={last.y - 10} textAnchor="end" fill="var(--foreground)" fontSize={11} fontWeight={600}>
            {formatValue(last.value, format)}
          </text>

          {hovered && (
            <g>
              <line
                x1={hovered.x}
                x2={hovered.x}
                y1={PAD.top}
                y2={HEIGHT - PAD.bottom}
                stroke="var(--foreground-soft)"
                strokeWidth={1}
                strokeDasharray="3,3"
              />
              <circle cx={hovered.x} cy={hovered.y} r={4} fill={color} stroke="var(--surface)" strokeWidth={2} />
            </g>
          )}

          <rect
            x={PAD.left}
            y={PAD.top}
            width={innerW}
            height={innerH}
            fill="transparent"
            onPointerMove={handleMove}
            onPointerLeave={() => setHoverIdx(null)}
          />
        </svg>

        {hovered && (
          <div
            className="pointer-events-none absolute rounded-md border border-line bg-background px-2 py-1 text-xs whitespace-nowrap shadow-sm"
            style={{
              left: `${(hovered.x / WIDTH) * 100}%`,
              top: `${(hovered.y / HEIGHT) * 100}%`,
              transform: 'translate(-50%, -130%)',
            }}
          >
            <p className="font-mono font-medium">{formatValue(hovered.value, format)}</p>
            <p className="text-foreground-soft">{formatDate(hovered.date, monthly)}</p>
          </div>
        )}
      </div>
    </div>
  )
}

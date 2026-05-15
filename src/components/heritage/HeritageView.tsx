import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStore } from '../../store/useStore'
import { isParentRole } from '../../types'
import { compressImage } from '../../utils/image'
import type { Ancestor, Anniversary } from '../../types'

// ─── Family Tree Canvas ────────────────────────────────────────────────────────

const NODE_W = 136
const NODE_H = 94
const H_GAP  = 48
const V_GAP  = 96

type LayoutNode = { ancestor: Ancestor; x: number; y: number; level: number }

function buildLayout(ancestors: Ancestor[]): LayoutNode[] {
  if (ancestors.length === 0) return []

  const allIds = new Set(ancestors.map((a) => a.id))
  const childrenOf: Record<string, string[]> = {}
  ancestors.forEach((a) => {
    a.parentIds.forEach((pid) => {
      if (allIds.has(pid)) {
        childrenOf[pid] = childrenOf[pid] ? [...childrenOf[pid], a.id] : [a.id]
      }
    })
  })

  const roots = ancestors.filter((a) => !a.parentIds.some((pid) => allIds.has(pid)))
  const levels: Record<string, number> = {}
  // Longest-path assignment: each person goes to the deepest possible level
  // (max depth from any root ancestor). Use >= so deeper paths always win.
  const queue = roots.map((r) => ({ id: r.id, level: 0 }))
  while (queue.length > 0) {
    const { id, level } = queue.shift()!
    if (levels[id] !== undefined && levels[id] >= level) continue  // already at same/deeper level
    levels[id] = level
    ;(childrenOf[id] ?? []).forEach((cid) => queue.push({ id: cid, level: level + 1 }))
  }
  ancestors.forEach((a) => { if (levels[a.id] === undefined) levels[a.id] = 0 })

  // Align spouses to the same level (use the deeper level of the two).
  // Cap at ancestors.length iterations to guard against corrupted spouse cycles.
  let changed = true
  let safetyBreak = 0
  while (changed && safetyBreak++ < ancestors.length) {
    changed = false
    ancestors.forEach((a) => {
      if (!a.spouseId || !allIds.has(a.spouseId)) return
      const myLv = levels[a.id] ?? 0
      const spouseLv = levels[a.spouseId] ?? 0
      const target = Math.max(myLv, spouseLv)
      if (myLv !== target) { levels[a.id] = target; changed = true }
      if (spouseLv !== target) { levels[a.spouseId] = target; changed = true }
    })
  }

  // Group by level, placing spouses adjacent to each other
  const byLevel: Record<number, Ancestor[]> = {}
  ancestors.forEach((a) => {
    const lv = levels[a.id]
    byLevel[lv] = byLevel[lv] ? [...byLevel[lv], a] : [a]
  })

  // Sort each level so spouses are adjacent
  Object.keys(byLevel).forEach((lvStr) => {
    const group = byLevel[Number(lvStr)]
    const sorted: Ancestor[] = []
    const visited = new Set<string>()
    group.forEach((a) => {
      if (visited.has(a.id)) return
      sorted.push(a)
      visited.add(a.id)
      // Place spouse immediately after
      if (a.spouseId) {
        const spouse = group.find((b) => b.id === a.spouseId)
        if (spouse && !visited.has(spouse.id)) {
          sorted.push(spouse)
          visited.add(spouse.id)
        }
      }
    })
    byLevel[Number(lvStr)] = sorted
  })

  const nodes: LayoutNode[] = []
  const maxLevels = Math.max(...Object.keys(byLevel).map(Number))

  for (let lv = 0; lv <= maxLevels; lv++) {
    const group = byLevel[lv] ?? []
    const totalW = group.length * NODE_W + (group.length - 1) * H_GAP
    const startX = -totalW / 2 + NODE_W / 2
    group.forEach((a, i) => {
      nodes.push({ ancestor: a, x: startX + i * (NODE_W + H_GAP), y: lv * (NODE_H + V_GAP), level: lv })
    })
  }

  return nodes
}

function FamilyTreeSVG({ ancestors, onNodeClick }: { ancestors: Ancestor[]; onNodeClick: (a: Ancestor) => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale]         = useState(1)
  const [translate, setTranslate] = useState({ x: 0, y: 0 })
  const dragging  = useRef(false)
  const didPan    = useRef(false)
  const lastPoint = useRef({ x: 0, y: 0 })
  const pinchDist = useRef<number | null>(null)
  const touchPt   = useRef<{ x: number; y: number } | null>(null)

  const nodes = useMemo(() => buildLayout(ancestors), [ancestors])

  const { svgW, svgH, minX, minY } = useMemo(() => {
    if (nodes.length === 0) return { svgW: 0, svgH: 0, minX: 0, minY: 0 }
    const xs = nodes.map((n) => n.x)
    const ys = nodes.map((n) => n.y)
    const minX = Math.min(...xs) - NODE_W / 2 - 48
    const maxX = Math.max(...xs) + NODE_W / 2 + 48
    const minY = Math.min(...ys) - 48
    const maxY = Math.max(...ys) + NODE_H + 48
    return { svgW: maxX - minX, svgH: maxY - minY, minX, minY }
  }, [nodes])

  // ── Fit entire tree into viewport ──────────────────────────────────────────
  const fitToScreen = useCallback(() => {
    const el = containerRef.current
    if (!el || svgW === 0) return
    const w = el.clientWidth  || 600
    const h = el.clientHeight || 400
    const ns = Math.min(w / svgW, h / svgH) * 0.92
    setScale(ns)
    setTranslate({ x: (w - svgW * ns) / 2, y: (h - svgH * ns) / 2 })
  }, [svgW, svgH])

  useEffect(() => {
    const t = setTimeout(fitToScreen, 80)
    return () => clearTimeout(t)
  }, [fitToScreen])

  // ── Mouse-wheel zoom (non-passive so we can preventDefault) ────────────────
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const handler = (e: WheelEvent) => {
      e.preventDefault()
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12
      const rect   = el.getBoundingClientRect()
      const px = e.clientX - rect.left
      const py = e.clientY - rect.top
      setScale((prev) => {
        const next = Math.max(0.06, Math.min(5, prev * factor))
        setTranslate((t) => ({
          x: px - (px - t.x) * (next / prev),
          y: py - (py - t.y) * (next / prev),
        }))
        return next
      })
    }
    el.addEventListener('wheel', handler, { passive: false })
    return () => el.removeEventListener('wheel', handler)
  }, [])

  // ── Touch events (pan + pinch-zoom) ────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        touchPt.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
        didPan.current  = false
      } else if (e.touches.length === 2) {
        const dx = e.touches[1].clientX - e.touches[0].clientX
        const dy = e.touches[1].clientY - e.touches[0].clientY
        pinchDist.current = Math.hypot(dx, dy)
      }
    }
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault()
      if (e.touches.length === 1 && touchPt.current) {
        const dx = e.touches[0].clientX - touchPt.current.x
        const dy = e.touches[0].clientY - touchPt.current.y
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) didPan.current = true
        setTranslate((t) => ({ x: t.x + dx, y: t.y + dy }))
        touchPt.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      } else if (e.touches.length === 2 && pinchDist.current !== null) {
        const dx   = e.touches[1].clientX - e.touches[0].clientX
        const dy   = e.touches[1].clientY - e.touches[0].clientY
        const dist = Math.hypot(dx, dy)
        const factor = dist / pinchDist.current
        const cx   = (e.touches[0].clientX + e.touches[1].clientX) / 2
        const cy   = (e.touches[0].clientY + e.touches[1].clientY) / 2
        const rect = el.getBoundingClientRect()
        const px = cx - rect.left
        const py = cy - rect.top
        setScale((prev) => {
          const next = Math.max(0.06, Math.min(5, prev * factor))
          setTranslate((t) => ({
            x: px - (px - t.x) * (next / prev),
            y: py - (py - t.y) * (next / prev),
          }))
          return next
        })
        pinchDist.current = dist
      }
    }
    const onTouchEnd = () => { touchPt.current = null; pinchDist.current = null }
    el.addEventListener('touchstart', onTouchStart, { passive: false })
    el.addEventListener('touchmove',  onTouchMove,  { passive: false })
    el.addEventListener('touchend',   onTouchEnd)
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove',  onTouchMove)
      el.removeEventListener('touchend',   onTouchEnd)
    }
  }, [])

  const zoomBy = (factor: number) => {
    const el = containerRef.current
    if (!el) return
    const px = el.clientWidth  / 2
    const py = el.clientHeight / 2
    setScale((prev) => {
      const next = Math.max(0.06, Math.min(5, prev * factor))
      setTranslate((t) => ({
        x: px - (px - t.x) * (next / prev),
        y: py - (py - t.y) * (next / prev),
      }))
      return next
    })
  }

  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current  = true
    didPan.current    = false
    lastPoint.current = { x: e.clientX, y: e.clientY }
  }
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging.current) return
    const dx = e.clientX - lastPoint.current.x
    const dy = e.clientY - lastPoint.current.y
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) didPan.current = true
    setTranslate((t) => ({ x: t.x + dx, y: t.y + dy }))
    lastPoint.current = { x: e.clientX, y: e.clientY }
  }
  const stopDrag = () => { dragging.current = false }

  if (nodes.length === 0) return null

  // ── Build SVG content ──────────────────────────────────────────────────────
  const nodeById: Record<string, LayoutNode> = {}
  nodes.forEach((n) => { nodeById[n.ancestor.id] = n })

  const lines: JSX.Element[] = []
  nodes.forEach((n) => {
    n.ancestor.parentIds.forEach((pid) => {
      const parent = nodeById[pid]
      if (!parent) return
      const x1 = parent.x - minX + NODE_W / 2
      const y1 = parent.y - minY + NODE_H
      const x2 = n.x - minX + NODE_W / 2
      const y2 = n.y - minY
      const midY = (y1 + y2) / 2
      lines.push(
        <path key={`${pid}-${n.ancestor.id}`}
          d={`M${x1},${y1} C${x1},${midY} ${x2},${midY} ${x2},${y2}`}
          fill="none" stroke="#92400e" strokeWidth="2" strokeDasharray="6 3" opacity="0.75" />
      )
    })
  })

  const drawnSpouses = new Set<string>()
  nodes.forEach((n) => {
    const sid = n.ancestor.spouseId
    if (!sid || drawnSpouses.has(`${n.ancestor.id}-${sid}`) || drawnSpouses.has(`${sid}-${n.ancestor.id}`)) return
    const spouse = nodeById[sid]
    if (!spouse) return
    const leftNode  = n.x <= spouse.x ? n      : spouse
    const rightNode = n.x <= spouse.x ? spouse : n
    const x1 = leftNode.x  - minX + NODE_W
    const y1 = leftNode.y  - minY + NODE_H / 2
    const x2 = rightNode.x - minX
    const y2 = rightNode.y - minY + NODE_H / 2
    const mx = (x1 + x2) / 2
    const my = (y1 + y2) / 2
    lines.push(
      <path key={`spouse-${n.ancestor.id}-${sid}`}
        d={`M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`}
        fill="none" stroke="#d97706" strokeWidth="2" opacity="0.9" />
    )
    lines.push(
      <text key={`heart-${n.ancestor.id}-${sid}`} x={mx} y={my + 5} textAnchor="middle" fontSize="14">❤️</text>
    )
    drawnSpouses.add(`${n.ancestor.id}-${sid}`)
  })

  return (
    <div className="flex flex-col gap-2">
      {/* ── Controls ── */}
      <div className="flex items-center gap-2 justify-between">
        <span className="text-xs text-amber-500">
          {ancestors.length} người · cuộn chuột để zoom · kéo để di chuyển
        </span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={fitToScreen}
            title="Fit to screen"
            className="text-xs bg-amber-800/60 hover:bg-amber-700/60 text-amber-200 px-2.5 py-1 rounded-lg font-medium"
          >⛶ Fit</button>
          <button
            onClick={() => zoomBy(1.2)}
            className="w-7 h-7 bg-amber-800/60 hover:bg-amber-700/60 text-amber-200 rounded-lg font-bold text-base flex items-center justify-center"
          >+</button>
          <span className="text-xs text-amber-400 w-10 text-center tabular-nums">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => zoomBy(1 / 1.2)}
            className="w-7 h-7 bg-amber-800/60 hover:bg-amber-700/60 text-amber-200 rounded-lg font-bold text-base flex items-center justify-center"
          >−</button>
        </div>
      </div>

      {/* ── Canvas ── */}
      <div
        ref={containerRef}
        className="rounded-2xl overflow-hidden"
        style={{
          height: 'max(65vh, 380px)',
          position: 'relative',
          cursor: dragging.current ? 'grabbing' : 'grab',
          background: 'rgba(0,0,0,0.15)',
        }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={stopDrag}
        onMouseLeave={stopDrag}
      >
        <svg
          width={svgW}
          height={svgH}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            transform: `translate(${translate.x}px,${translate.y}px) scale(${scale})`,
            transformOrigin: '0 0',
            userSelect: 'none',
            willChange: 'transform',
          }}
        >
          {lines}
          {nodes.map((n) => {
            const x = n.x - minX
            const y = n.y - minY
            const isMale = n.ancestor.gender === 'male'
            const name   = n.ancestor.name
            // Break name into up to 2 lines of ~14 chars each
            const line1  = name.length <= 14 ? name : name.slice(0, 14)
            const line2  = name.length > 14  ? (name.length > 28 ? name.slice(14, 27) + '…' : name.slice(14)) : ''
            return (
              <g
                key={n.ancestor.id}
                transform={`translate(${x},${y})`}
                onClick={() => { if (!didPan.current) onNodeClick(n.ancestor) }}
                style={{ cursor: 'pointer' }}
                className="group"
              >
                {/* Shadow */}
                <rect width={NODE_W} height={NODE_H} rx={16} fill="black" fillOpacity="0.3"
                  transform="translate(2,3)" />
                {/* Card */}
                <rect width={NODE_W} height={NODE_H} rx={16}
                  fill={isMale ? '#1a3356' : '#6d1a3d'}
                  stroke={isMale ? '#60a5fa' : '#f472b6'}
                  strokeWidth="2" />
                {/* Hover overlay */}
                <rect width={NODE_W} height={NODE_H} rx={16} fill="white"
                  fillOpacity="0" className="group-hover:fill-opacity-[0.08]"
                  style={{ transition: 'fill-opacity 0.15s' }} />
                {/* Photo or emoji */}
                {n.ancestor.photoUrl ? (
                  <image href={n.ancestor.photoUrl}
                    x={NODE_W / 2 - 22} y={5} width={44} height={44}
                    clipPath="circle(22px at 22px 22px)"
                    preserveAspectRatio="xMidYMid slice" />
                ) : (
                  <text x={NODE_W / 2} y={36} textAnchor="middle" fontSize="28">
                    {isMale ? '👴' : '👵'}
                  </text>
                )}
                {/* Name (1 or 2 lines) */}
                <text x={NODE_W / 2} y={line2 ? 58 : 63}
                  textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">
                  {line1}
                </text>
                {line2 && (
                  <text x={NODE_W / 2} y={69}
                    textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">
                    {line2}
                  </text>
                )}
                {/* Relationship */}
                <text x={NODE_W / 2} y={line2 ? 80 : 75}
                  textAnchor="middle" fill="rgba(255,255,255,0.6)" fontSize="9">
                  {(n.ancestor.relationship || (isMale ? 'Nam' : 'Nữ')).slice(0, 16)}
                </text>
                {/* Years */}
                <text x={NODE_W / 2} y={line2 ? 90 : 85}
                  textAnchor="middle" fill="rgba(255,255,255,0.45)" fontSize="8">
                  {n.ancestor.birthYear ?? '?'} – {n.ancestor.deathYear ?? 'nay'}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}

// ─── Shared ancestor form fields component ───────────────────────────────────

type AncestorForm = Omit<Ancestor, 'id'>

const EMPTY_FORM: AncestorForm = {
  name: '', gender: 'male', relationship: '', birthYear: undefined, deathYear: undefined,
  solarBirthDate: '', solarDeathDate: '', lunarDeathDay: undefined, lunarDeathMonth: undefined,
  biography: '', photoUrl: '', parentIds: [], spouseId: undefined,
  phone: '', address: '', hometown: '', occupation: '',
}

function AncestorFormFields({
  form, setForm, ancestors, excludeId, inputCls,
}: {
  form: AncestorForm
  setForm: React.Dispatch<React.SetStateAction<AncestorForm>>
  ancestors: Ancestor[]
  excludeId?: string
  inputCls: string
}) {
  const photoRef = useRef<HTMLInputElement>(null)

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      // Ancestor portrait: 640 px is plenty for the SVG node thumbnail
      const dataUrl = await compressImage(file, { maxPx: 640, quality: 0.80 })
      setForm((f) => ({ ...f, photoUrl: dataUrl }))
    } catch (err: any) {
      alert(err?.message ?? 'Không thể xử lý ảnh, thử lại!')
    }
  }

  const available = ancestors.filter((a) => a.id !== excludeId)

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2">
        <label className="text-xs text-amber-700 font-medium block mb-1">Họ và tên *</label>
        <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="VD: Nguyễn Văn Thành" className={inputCls} />
      </div>
      <div>
        <label className="text-xs text-amber-700 font-medium block mb-1">Giới tính</label>
        <select value={form.gender} onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value as 'male'|'female' }))} className={inputCls}>
          <option value="male">Nam 👴</option>
          <option value="female">Nữ 👵</option>
        </select>
      </div>
      <div>
        <label className="text-xs text-amber-700 font-medium block mb-1">Quan hệ</label>
        <input value={form.relationship} onChange={(e) => setForm((f) => ({ ...f, relationship: e.target.value }))}
          placeholder="Ông nội, Cụ bà..." className={inputCls} />
      </div>
      <div>
        <label className="text-xs text-amber-700 font-medium block mb-1">Năm sinh</label>
        <input type="number" value={form.birthYear ?? ''} onChange={(e) => setForm((f) => ({ ...f, birthYear: e.target.value ? parseInt(e.target.value) : undefined }))}
          placeholder="1920" className={inputCls} />
      </div>
      <div>
        <label className="text-xs text-amber-700 font-medium block mb-1">Năm mất</label>
        <input type="number" value={form.deathYear ?? ''} onChange={(e) => setForm((f) => ({ ...f, deathYear: e.target.value ? parseInt(e.target.value) : undefined }))}
          placeholder="2005 (để trống nếu còn sống)" className={inputCls} />
      </div>
      <div className="col-span-2">
        <label className="text-xs text-amber-700 font-medium block mb-1">Ngày sinh đầy đủ (dương lịch)</label>
        <input type="date" value={form.solarBirthDate ?? ''} onChange={(e) => setForm((f) => ({ ...f, solarBirthDate: e.target.value }))}
          className={inputCls} />
      </div>
      <div>
        <label className="text-xs text-amber-700 font-medium block mb-1">Ngày giỗ âm — Ngày</label>
        <input type="number" min={1} max={30} value={form.lunarDeathDay ?? ''} onChange={(e) => setForm((f) => ({ ...f, lunarDeathDay: e.target.value ? parseInt(e.target.value) : undefined }))}
          placeholder="15" className={inputCls} />
      </div>
      <div>
        <label className="text-xs text-amber-700 font-medium block mb-1">Ngày giỗ âm — Tháng</label>
        <input type="number" min={1} max={12} value={form.lunarDeathMonth ?? ''} onChange={(e) => setForm((f) => ({ ...f, lunarDeathMonth: e.target.value ? parseInt(e.target.value) : undefined }))}
          placeholder="7" className={inputCls} />
      </div>
      <div className="col-span-2">
        <label className="text-xs text-amber-700 font-medium block mb-1">Ngày mất dương lịch (để tính đếm ngược)</label>
        <input type="date" value={form.solarDeathDate ?? ''} onChange={(e) => setForm((f) => ({ ...f, solarDeathDate: e.target.value }))}
          className={inputCls} />
      </div>

      {/* Extended profile */}
      <div className="col-span-2 pt-2 mt-1 border-t border-amber-200">
        <p className="text-xs text-amber-500 uppercase tracking-wider font-medium mb-2">Thông tin liên hệ</p>
      </div>
      <div>
        <label className="text-xs text-amber-700 font-medium block mb-1">📞 Số điện thoại</label>
        <input value={form.phone ?? ''} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          placeholder="0912 345 678" className={inputCls} />
      </div>
      <div>
        <label className="text-xs text-amber-700 font-medium block mb-1">💼 Nghề nghiệp</label>
        <input value={form.occupation ?? ''} onChange={(e) => setForm((f) => ({ ...f, occupation: e.target.value }))}
          placeholder="Giáo viên, kỹ sư..." className={inputCls} />
      </div>
      <div className="col-span-2">
        <label className="text-xs text-amber-700 font-medium block mb-1">🏡 Quê quán</label>
        <input value={form.hometown ?? ''} onChange={(e) => setForm((f) => ({ ...f, hometown: e.target.value }))}
          placeholder="Hà Nam, Nam Định..." className={inputCls} />
      </div>
      <div className="col-span-2">
        <label className="text-xs text-amber-700 font-medium block mb-1">📍 Địa chỉ hiện tại</label>
        <input value={form.address ?? ''} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
          placeholder="Số nhà, đường, phường, quận..." className={inputCls} />
      </div>

      {/* Parents */}
      <div className="col-span-2">
        <label className="text-xs text-amber-700 font-medium block mb-1">Cha/Mẹ trên cây</label>
        {available.length === 0 ? (
          <p className="text-xs text-amber-500 italic">Chưa có tổ tiên nào.</p>
        ) : (
          <div className="max-h-28 overflow-y-auto space-y-1 bg-amber-50/60 rounded-xl p-2 border border-amber-200">
            {available.map((a) => (
              <label key={a.id} className="flex items-center gap-2 text-sm text-amber-800 cursor-pointer hover:bg-amber-100 rounded px-1">
                <input type="checkbox" checked={form.parentIds.includes(a.id)}
                  onChange={(e) => setForm((f) => ({
                    ...f,
                    parentIds: e.target.checked ? [...f.parentIds, a.id] : f.parentIds.filter((pid) => pid !== a.id),
                  }))} />
                {a.name} {a.relationship ? `(${a.relationship})` : ''}
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Spouse */}
      <div className="col-span-2">
        <label className="text-xs text-amber-700 font-medium block mb-1">Vợ/Chồng trên cây</label>
        <select value={form.spouseId ?? ''} onChange={(e) => setForm((f) => ({ ...f, spouseId: e.target.value || undefined }))} className={inputCls}>
          <option value="">— Không —</option>
          {available.map((a) => (
            <option key={a.id} value={a.id}>{a.name} {a.relationship ? `(${a.relationship})` : ''}</option>
          ))}
        </select>
      </div>

      <div className="col-span-2">
        <label className="text-xs text-amber-700 font-medium block mb-1">Tiểu sử</label>
        <textarea value={form.biography ?? ''} onChange={(e) => setForm((f) => ({ ...f, biography: e.target.value }))}
          rows={3} placeholder="Vài dòng về cuộc đời, sự nghiệp..." className={inputCls} />
      </div>

      {/* Photo upload */}
      <div className="col-span-2">
        <label className="text-xs text-amber-700 font-medium block mb-1">Ảnh</label>
        <input ref={photoRef} type="file" accept="image/*" onChange={handlePhoto} className="hidden" />
        <div className="flex items-center gap-3">
          {form.photoUrl
            ? <img src={form.photoUrl} alt="" className="w-14 h-14 rounded-xl object-cover border-2 border-amber-300" />
            : <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-3xl ${form.gender === 'male' ? 'bg-blue-900' : 'bg-rose-800'}`}>
                {form.gender === 'male' ? '👴' : '👵'}
              </div>
          }
          <button type="button" onClick={() => photoRef.current?.click()}
            className="text-sm bg-amber-200 text-amber-800 hover:bg-amber-300 px-3 py-1.5 rounded-xl font-medium">
            📷 Chọn ảnh
          </button>
          {form.photoUrl && (
            <button type="button" onClick={() => setForm((f) => ({ ...f, photoUrl: '' }))}
              className="text-xs text-red-400 hover:text-red-600">Xóa</button>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Add Ancestor Modal ────────────────────────────────────────────────────────

function AddAncestorModal({ ancestors, onClose }: { ancestors: Ancestor[]; onClose: () => void }) {
  const addAncestor    = useStore((s) => s.addAncestor)
  const addAnniversary = useStore((s) => s.addAnniversary)
  const [form, setForm]     = useState<AncestorForm>({ ...EMPTY_FORM })
  const [addAnn, setAddAnn] = useState(true)
  const [done, setDone]     = useState(false)

  const inputCls = 'w-full border border-amber-300 bg-amber-50 rounded-xl p-2.5 text-sm text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-500'

  const submit = () => {
    if (!form.name.trim() || done) return
    addAncestor({ ...form, name: form.name.trim() })
    if (addAnn && form.lunarDeathDay && form.lunarDeathMonth) {
      addAnniversary({
        name: `Giỗ ${form.name.trim()}`,
        ancestorId: undefined,
        solarDate: form.solarDeathDate || undefined,
        lunarDay: form.lunarDeathDay,
        lunarMonth: form.lunarDeathMonth,
        notes: '',
      })
    }
    setDone(true)
    setTimeout(onClose, 600)
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={!done ? onClose : undefined}>
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
        className="bg-amber-50 rounded-3xl p-6 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto border border-amber-200"
        onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold text-amber-900 mb-5">🌿 Thêm tổ tiên</h2>

        <AncestorFormFields form={form} setForm={setForm} ancestors={ancestors} inputCls={inputCls} />

        {form.lunarDeathDay && form.lunarDeathMonth && (
          <label className="flex items-center gap-2 text-sm text-amber-800 cursor-pointer mt-3">
            <input type="checkbox" checked={addAnn} onChange={(e) => setAddAnn(e.target.checked)} />
            Tự động tạo ngày giỗ trong danh sách
          </label>
        )}

        <div className="flex gap-3 mt-5">
          <button onClick={onClose} disabled={done} className="flex-1 bg-amber-100 text-amber-800 py-2.5 rounded-xl font-medium text-sm hover:bg-amber-200 disabled:opacity-40">Hủy</button>
          <button onClick={submit} disabled={!form.name.trim() || done}
            className="flex-1 bg-amber-800 text-amber-50 py-2.5 rounded-xl font-medium text-sm hover:bg-amber-900 disabled:opacity-50 transition-all">
            {done ? '✅ Đã thêm!' : 'Thêm tổ tiên'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Edit Ancestor Modal ───────────────────────────────────────────────────────

function EditAncestorModal({ ancestor, ancestors, onClose }: { ancestor: Ancestor; ancestors: Ancestor[]; onClose: () => void }) {
  const updateAncestor = useStore((s) => s.updateAncestor)
  const [form, setForm] = useState<AncestorForm>({
    name: ancestor.name,
    gender: ancestor.gender,
    relationship: ancestor.relationship ?? '',
    birthYear: ancestor.birthYear,
    deathYear: ancestor.deathYear,
    solarBirthDate: ancestor.solarBirthDate ?? '',
    solarDeathDate: ancestor.solarDeathDate ?? '',
    lunarDeathDay: ancestor.lunarDeathDay,
    lunarDeathMonth: ancestor.lunarDeathMonth,
    biography: ancestor.biography ?? '',
    photoUrl: ancestor.photoUrl ?? '',
    parentIds: ancestor.parentIds ?? [],
    spouseId: ancestor.spouseId,
    phone: ancestor.phone ?? '',
    address: ancestor.address ?? '',
    hometown: ancestor.hometown ?? '',
    occupation: ancestor.occupation ?? '',
  })
  const [done, setDone] = useState(false)

  const inputCls = 'w-full border border-amber-300 bg-amber-50 rounded-xl p-2.5 text-sm text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-500'

  const save = () => {
    if (!form.name.trim() || done) return
    updateAncestor(ancestor.id, { ...form, name: form.name.trim() })
    setDone(true)
    setTimeout(onClose, 600)
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={!done ? onClose : undefined}>
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
        className="bg-amber-50 rounded-3xl p-6 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto border border-amber-200"
        onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold text-amber-900 mb-5">✏️ Sửa thông tin tổ tiên</h2>

        <AncestorFormFields form={form} setForm={setForm} ancestors={ancestors} excludeId={ancestor.id} inputCls={inputCls} />

        <div className="flex gap-3 mt-5">
          <button onClick={onClose} disabled={done} className="flex-1 bg-amber-100 text-amber-800 py-2.5 rounded-xl font-medium text-sm hover:bg-amber-200 disabled:opacity-40">Hủy</button>
          <button onClick={save} disabled={!form.name.trim() || done}
            className="flex-1 bg-amber-700 text-amber-50 py-2.5 rounded-xl font-medium text-sm hover:bg-amber-800 disabled:opacity-50 transition-all">
            {done ? '✅ Đã lưu!' : 'Lưu thay đổi'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Ancestral Calendar (Anniversary list) ─────────────────────────────────────

function AncestralCalendar() {
  const ancestors          = useStore((s) => s.ancestors)
  const anniversaries      = useStore((s) => s.anniversaries)
  const addAnniversary     = useStore((s) => s.addAnniversary)
  const updateAnniversary  = useStore((s) => s.updateAnniversary)
  const removeAnniversary  = useStore((s) => s.removeAnniversary)
  const currentMemberId    = useStore((s) => s.currentMemberId)
  const members            = useStore((s) => s.members)

  const currentMember = members.find((m) => m.id === currentMemberId)
  const isParent = currentMember ? isParentRole(currentMember.role) : false

  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<Omit<Anniversary, 'id'>>({
    name: '', ancestorId: undefined, solarDate: '', lunarDay: 1, lunarMonth: 1, notes: '',
  })

  const inputCls = 'w-full border border-amber-300 bg-amber-50 rounded-xl p-2.5 text-sm text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-500'

  const enriched = useMemo(() => {
    const today = new Date()
    return anniversaries.map((ann) => {
      let daysLeft: number | null = null
      if (ann.solarDate) {
        const solar = new Date(ann.solarDate)
        const thisYear = new Date(today.getFullYear(), solar.getMonth(), solar.getDate())
        const nextYear = new Date(today.getFullYear() + 1, solar.getMonth(), solar.getDate())
        const target = thisYear >= today ? thisYear : nextYear
        daysLeft = Math.ceil((target.getTime() - today.getTime()) / 86400000)
      }
      const ancestor = ancestors.find((a) => a.id === ann.ancestorId)
      return { ...ann, daysLeft, ancestor }
    }).sort((a, b) => (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999))
  }, [anniversaries, ancestors])

  const openEdit = (id: string) => {
    const ann = anniversaries.find((a) => a.id === id)
    if (!ann) return
    setEditingId(id)
    setForm({
      name: ann.name,
      ancestorId: ann.ancestorId,
      solarDate: ann.solarDate ?? '',
      lunarDay: ann.lunarDay,
      lunarMonth: ann.lunarMonth,
      notes: ann.notes ?? '',
    })
    setShowAdd(true)
  }

  const submit = () => {
    if (!form.name.trim() || !form.lunarDay || !form.lunarMonth) return
    if (editingId) {
      updateAnniversary(editingId, { ...form, name: form.name.trim() })
    } else {
      addAnniversary({ ...form, name: form.name.trim() })
    }
    setForm({ name: '', ancestorId: undefined, solarDate: '', lunarDay: 1, lunarMonth: 1, notes: '' })
    setShowAdd(false)
    setEditingId(null)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-amber-900 text-lg">🕯️ Danh sách Ngày Giỗ</h3>
        {isParent && (
          <button onClick={() => setShowAdd(true)}
            className="text-sm bg-amber-800 text-amber-50 px-4 py-2 rounded-xl font-medium hover:bg-amber-900">
            + Thêm ngày giỗ
          </button>
        )}
      </div>

      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="bg-amber-100 border border-amber-300 rounded-2xl p-4 mb-4">
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="col-span-2">
                <label className="text-xs text-amber-700 font-medium block mb-1">Tên ngày giỗ *</label>
                <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Giỗ Ông nội, Giỗ Cụ bà..." className={inputCls} />
              </div>
              <div>
                <label className="text-xs text-amber-700 font-medium block mb-1">Ngày âm *</label>
                <input type="number" min={1} max={30} value={form.lunarDay}
                  onChange={(e) => setForm((f) => ({ ...f, lunarDay: parseInt(e.target.value) || 1 }))} className={inputCls} />
              </div>
              <div>
                <label className="text-xs text-amber-700 font-medium block mb-1">Tháng âm *</label>
                <input type="number" min={1} max={12} value={form.lunarMonth}
                  onChange={(e) => setForm((f) => ({ ...f, lunarMonth: parseInt(e.target.value) || 1 }))} className={inputCls} />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-amber-700 font-medium block mb-1">Ngày dương tương đương (để tính đếm ngược)</label>
                <input type="date" value={form.solarDate ?? ''} onChange={(e) => setForm((f) => ({ ...f, solarDate: e.target.value }))} className={inputCls} />
              </div>
              <div className="col-span-2">
                <label className="text-xs text-amber-700 font-medium block mb-1">Liên kết tổ tiên</label>
                <select value={form.ancestorId ?? ''} onChange={(e) => setForm((f) => ({ ...f, ancestorId: e.target.value || undefined }))} className={inputCls}>
                  <option value="">— Không liên kết —</option>
                  {ancestors.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.relationship})</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-xs text-amber-700 font-medium block mb-1">Ghi chú</label>
                <input value={form.notes ?? ''} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Chuẩn bị mâm cỗ, cả nhà tụ họp..." className={inputCls} />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={submit} className="bg-amber-800 text-amber-50 px-4 py-2 rounded-xl font-medium text-sm hover:bg-amber-900">
                {editingId ? 'Lưu thay đổi' : 'Lưu'}
              </button>
              <button onClick={() => { setShowAdd(false); setEditingId(null) }} className="text-amber-700 px-4 py-2 rounded-xl text-sm hover:bg-amber-200">Hủy</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {enriched.length === 0 ? (
        <div className="text-center py-12 text-amber-600">
          <p className="text-5xl mb-3">🕯️</p>
          <p className="font-medium">Chưa có ngày giỗ nào.</p>
          <p className="text-sm opacity-70 mt-1">Thêm để không bao giờ quên ngày tưởng nhớ tổ tiên.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {enriched.map((ann) => (
            <motion.div key={ann.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
              className={`bg-amber-50 border rounded-2xl p-4 flex items-start justify-between gap-3 ${
                ann.daysLeft !== null && ann.daysLeft <= 7 ? 'border-red-400 bg-red-50' : 'border-amber-200'
              }`}>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-amber-900">{ann.name}</p>
                  {ann.daysLeft !== null && (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                      ann.daysLeft === 0 ? 'bg-red-500 text-white'
                      : ann.daysLeft <= 7 ? 'bg-orange-400 text-white'
                      : 'bg-amber-200 text-amber-800'
                    }`}>
                      {ann.daysLeft === 0 ? '🔔 Hôm nay!' : `${ann.daysLeft} ngày nữa`}
                    </span>
                  )}
                </div>
                <p className="text-sm text-amber-700 mt-1">
                  🌙 Ngày {ann.lunarDay} tháng {ann.lunarMonth} Âm lịch
                  {ann.solarDate && (
                    <span className="text-amber-500 ml-2">
                      (☀️ {new Date(ann.solarDate).toLocaleDateString('vi-VN')})
                    </span>
                  )}
                </p>
                {ann.ancestor && <p className="text-xs text-amber-600 mt-0.5">👤 {ann.ancestor.name} · {ann.ancestor.relationship}</p>}
                {ann.notes && <p className="text-xs text-amber-500 mt-1 italic">📝 {ann.notes}</p>}
              </div>
              {isParent && (
                <div className="flex flex-col gap-1 flex-shrink-0 mt-1">
                  <button onClick={() => openEdit(ann.id)} className="text-amber-400 hover:text-amber-700 text-sm" title="Sửa">✏️</button>
                  <button onClick={() => removeAnniversary(ann.id)} className="text-amber-300 hover:text-red-400 text-sm" title="Xóa">✕</button>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Ancestor Detail Popup ─────────────────────────────────────────────────────

function AncestorPopup({
  ancestor, ancestors, onClose, onEdit,
}: {
  ancestor: Ancestor
  ancestors: Ancestor[]
  onClose: () => void
  onEdit: () => void
}) {
  const removeAncestor   = useStore((s) => s.removeAncestor)
  const currentMemberId  = useStore((s) => s.currentMemberId)
  const members          = useStore((s) => s.members)
  const currentMember    = members.find((m) => m.id === currentMemberId)
  const isParent         = currentMember ? isParentRole(currentMember.role) : false

  const spouseName = ancestor.spouseId ? ancestors.find((a) => a.id === ancestor.spouseId)?.name : undefined
  const parentNames = ancestor.parentIds.map((pid) => ancestors.find((a) => a.id === pid)?.name).filter(Boolean)

  const handleRemove = () => {
    if (window.confirm(`Xóa ${ancestor.name} khỏi cây gia phả?`)) {
      onClose()               // close popup first — avoids React batching issue
      removeAncestor(ancestor.id)
    }
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
        className="bg-amber-50 rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-amber-200"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-4 mb-4">
          <div className={`w-20 h-20 rounded-2xl ${ancestor.gender === 'male' ? 'bg-blue-800' : 'bg-rose-700'} flex items-center justify-center text-5xl flex-shrink-0 overflow-hidden`}>
            {ancestor.photoUrl
              ? <img src={ancestor.photoUrl} alt={ancestor.name} className="w-full h-full object-cover" />
              : <span>{ancestor.gender === 'male' ? '👴' : '👵'}</span>}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-amber-900">{ancestor.name}</h2>
            {ancestor.relationship && <p className="text-amber-700 text-sm">{ancestor.relationship}</p>}
            <p className="text-amber-600 text-sm">
              {ancestor.birthYear ?? '?'} – {ancestor.deathYear ?? 'nay'}
              {ancestor.birthYear && ancestor.deathYear ? ` (${ancestor.deathYear - ancestor.birthYear} tuổi)` : ''}
            </p>
          </div>
        </div>

        {/* Relationships */}
        {(spouseName || parentNames.length > 0) && (
          <div className="bg-amber-100 rounded-xl p-3 mb-3 space-y-1">
            {spouseName && <p className="text-sm text-amber-800">❤️ Vợ/Chồng: <strong>{spouseName}</strong></p>}
            {parentNames.length > 0 && <p className="text-sm text-amber-800">👆 Con của: <strong>{parentNames.join(', ')}</strong></p>}
          </div>
        )}

        {ancestor.lunarDeathDay && ancestor.lunarDeathMonth && (
          <div className="bg-amber-100 rounded-xl p-3 mb-3">
            <p className="text-sm font-medium text-amber-800">🕯️ Ngày giỗ</p>
            <p className="text-sm text-amber-700">Ngày {ancestor.lunarDeathDay} tháng {ancestor.lunarDeathMonth} Âm lịch</p>
            {ancestor.solarDeathDate && (
              <p className="text-xs text-amber-500 mt-0.5">☀️ {new Date(ancestor.solarDeathDate).toLocaleDateString('vi-VN')}</p>
            )}
          </div>
        )}

        {/* Contact / profile fields */}
        {(ancestor.phone || ancestor.occupation || ancestor.hometown || ancestor.address || ancestor.solarBirthDate) && (
          <div className="bg-amber-100 rounded-xl p-3 mb-3 space-y-1">
            {ancestor.solarBirthDate && (
              <p className="text-sm text-amber-800">🎂 Sinh ngày: <strong>{new Date(ancestor.solarBirthDate).toLocaleDateString('vi-VN')}</strong></p>
            )}
            {ancestor.phone && (
              <p className="text-sm text-amber-800">
                📞 SĐT: <a href={`tel:${ancestor.phone}`} className="font-semibold underline">{ancestor.phone}</a>
              </p>
            )}
            {ancestor.occupation && <p className="text-sm text-amber-800">💼 Nghề: <strong>{ancestor.occupation}</strong></p>}
            {ancestor.hometown && <p className="text-sm text-amber-800">🏡 Quê: <strong>{ancestor.hometown}</strong></p>}
            {ancestor.address && <p className="text-sm text-amber-800">📍 Địa chỉ: <strong>{ancestor.address}</strong></p>}
          </div>
        )}

        {ancestor.biography && (
          <div className="mb-4">
            <p className="text-xs text-amber-600 font-medium uppercase tracking-wide mb-1">Tiểu sử</p>
            <p className="text-sm text-amber-800 leading-relaxed whitespace-pre-wrap">{ancestor.biography}</p>
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 bg-amber-100 text-amber-800 py-2.5 rounded-xl font-medium text-sm hover:bg-amber-200">Đóng</button>
          {isParent && (
            <>
              <button onClick={onEdit} className="flex-1 bg-amber-700 text-amber-50 py-2.5 rounded-xl font-medium text-sm hover:bg-amber-800">✏️ Sửa</button>
              <button onClick={handleRemove} className="bg-red-100 text-red-600 py-2.5 px-3 rounded-xl font-medium text-sm hover:bg-red-200">🗑</button>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Main Heritage View ────────────────────────────────────────────────────────

type Tab = 'tree' | 'calendar'

export default function HeritageView() {
  const ancestors       = useStore((s) => s.ancestors)
  const currentMemberId = useStore((s) => s.currentMemberId)
  const members         = useStore((s) => s.members)

  const currentMember = members.find((m) => m.id === currentMemberId)
  const isParent = currentMember ? isParentRole(currentMember.role) : false

  const [tab, setTab]                         = useState<Tab>('tree')
  const [showAddAncestor, setShowAddAncestor] = useState(false)
  const [selectedAncestor, setSelectedAncestor] = useState<Ancestor | null>(null)
  const [editingAncestor, setEditingAncestor]   = useState<Ancestor | null>(null)

  const handleEdit = () => {
    if (selectedAncestor) {
      setEditingAncestor(selectedAncestor)
      setSelectedAncestor(null)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-950 to-amber-900 text-amber-50">
      {/* Header */}
      <div className="bg-amber-900/80 border-b border-amber-700/50 px-4 lg:px-6 py-5">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-amber-100 flex items-center gap-2">
              🏛️ Gia phả & Cội nguồn
            </h1>
            <p className="text-amber-400 text-sm mt-0.5">Lưu giữ ký ức, tôn vinh tổ tiên</p>
          </div>
          {isParent && tab === 'tree' && (
            <button onClick={() => setShowAddAncestor(true)}
              className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-xl text-sm font-medium">
              + Thêm tổ tiên
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-5xl mx-auto px-4 lg:px-6 pt-5">
        <div className="flex gap-2 mb-6">
          {([['tree', '🌳 Cây gia phả'], ['calendar', '🕯️ Ngày Giỗ']] as [Tab, string][]).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                tab === key ? 'bg-amber-600 text-white shadow-lg' : 'bg-amber-800/60 text-amber-300 hover:bg-amber-700/60'
              }`}>
              {label}
            </button>
          ))}
        </div>

        {/* Tree */}
        {tab === 'tree' && (
          <div className="bg-amber-900/40 border border-amber-700/40 rounded-3xl p-5">
            {ancestors.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-6xl mb-4">🌿</p>
                <p className="text-amber-200 font-medium text-lg">Cây gia phả chưa có dữ liệu</p>
                <p className="text-amber-400 text-sm mt-1">Nhấn "+ Thêm tổ tiên" để bắt đầu vẽ cây nhà mình</p>
              </div>
            ) : (
              <FamilyTreeSVG ancestors={ancestors} onNodeClick={setSelectedAncestor} />
            )}
            <p className="text-xs text-amber-500 text-center mt-4">
              Nhấn vào nút để xem / sửa · ╌╌╌ cha-con · ─❤️─ vợ/chồng
            </p>
          </div>
        )}

        {/* Calendar */}
        {tab === 'calendar' && (
          <div className="bg-amber-50 rounded-3xl p-5 border border-amber-300">
            <AncestralCalendar />
          </div>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showAddAncestor && (
          <AddAncestorModal ancestors={ancestors} onClose={() => setShowAddAncestor(false)} />
        )}
        {selectedAncestor && (
          <AncestorPopup
            ancestor={selectedAncestor}
            ancestors={ancestors}
            onClose={() => setSelectedAncestor(null)}
            onEdit={handleEdit}
          />
        )}
        {editingAncestor && (
          <EditAncestorModal
            ancestor={editingAncestor}
            ancestors={ancestors}
            onClose={() => setEditingAncestor(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

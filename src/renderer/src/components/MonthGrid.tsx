import { useEffect, useMemo, useRef, useState } from 'react'
import type { CalEvent, Todo, WorkHours } from '@shared/types'
import { WEEKDAYS, chunkWeeks, isSameDay, isSameMonth, monthGrid, monthTitle, toKey } from '../lib/date'
import { ChevronLeft, ChevronRight } from '../lib/icons'
import DayCell, { type DragItem } from './DayCell'

type Props = {
  month: Date
  selected: Date
  events: CalEvent[]
  todos: Todo[]
  workHours: Record<string, WorkHours>
  /** 직전 이동 방향 — 슬라이드 애니메이션 방향에 쓴다 */
  dir: 'next' | 'prev'
  onPrev: () => void
  onNext: () => void
  onSelect: (d: Date) => void
  onToday: () => void
  onToggleTodo: (t: Todo) => void
  editingId: string | null
  onEditEvent: (e: CalEvent) => void
  onEditTodo: (t: Todo) => void
  /** 항목을 다른 날짜 칸에 떨궜을 때 */
  onMoveItem: (d: DragItem, toDate: string) => void
}

/** 항목 한 줄이 차지하는 높이 = .it 높이 16 + 줄 간격 1 */
const ITEM_H = 17
/** 항목이 쓸 수 없는 높이 = .cell 세로 패딩 5 + .cell-head 18 + .cell-items 위 여백 1 */
const HEAD_H = 24
/** 좁아지면 근무시간 배지를 아랫줄로 내리므로 머리 높이가 그만큼 늘어난다 */
const HEAD_H_COMPACT = HEAD_H + 13
/** 날짜 숫자 옆에 'HH:MM~HH:MM' 배지가 같이 들어갈 수 있는 최소 칸 너비 */
const COMPACT_BELOW = 84

export default function MonthGrid({
  month,
  selected,
  events,
  todos,
  workHours,
  dir,
  onPrev,
  onNext,
  onSelect,
  onToday,
  onToggleTodo,
  editingId,
  onEditEvent,
  onEditTodo,
  onMoveItem
}: Props): React.JSX.Element {
  const weeks = useMemo(() => chunkWeeks(monthGrid(month)), [month])

  // 날짜별로 미리 묶어두면 칸마다 전체를 훑지 않아도 된다
  const byDate = useMemo(() => {
    const m = new Map<string, { events: CalEvent[]; todos: Todo[] }>()
    const bucket = (k: string): { events: CalEvent[]; todos: Todo[] } => {
      let b = m.get(k)
      if (!b) m.set(k, (b = { events: [], todos: [] }))
      return b
    }
    for (const e of events) bucket(e.date).events.push(e)
    for (const t of todos) bucket(t.date).todos.push(t)
    return m
  }, [events, todos])

  /**
   * 창 크기를 끌어서 바꿀 수 있으므로 칸에 몇 개가 들어가는지는 고정할 수 없다.
   * 실제 렌더된 한 줄의 높이를 재서 항목 수를 계산한다.
   */
  const gridRef = useRef<HTMLDivElement>(null)
  const [{ maxItems, compact }, setMetrics] = useState({ maxItems: 3, compact: false })

  useEffect(() => {
    const el = gridRef.current
    if (!el) return
    const measure = (): void => {
      const rowH = el.clientHeight / weeks.length
      const cellW = el.clientWidth / 7
      const isCompact = cellW < COMPACT_BELOW
      const head = isCompact ? HEAD_H_COMPACT : HEAD_H
      // 줄 사이 간격은 n개일 때 n-1번만 들어가므로 +1 을 보정한다
      setMetrics({
        maxItems: Math.max(1, Math.floor((rowH - head + 1) / ITEM_H)),
        compact: isCompact
      })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [weeks.length])

  /**
   * 드래그 중인 항목을 ref 와 state 두 군데에 둔다.
   *
   * dragover 중에는 dataTransfer 를 읽을 수 없어서(브라우저 보안 제약)
   * 무엇이 끌려오는지 알려면 우리가 따로 기억해야 한다.
   * 그런데 state 만 쓰면 dragstart 직후의 dragover/drop 이 아직 반영 안 된
   * 옛 값을 보게 된다. 판정에는 즉시 갱신되는 ref 를, 화면 표시에는 state 를 쓴다.
   */
  const dragRef = useRef<DragItem | null>(null)
  const [drag, setDrag] = useState<DragItem | null>(null)
  const [overKey, setOverKey] = useState<string | null>(null)

  const startDrag = (d: DragItem): void => {
    dragRef.current = d
    setDrag(d)
  }

  const endDrag = (): void => {
    dragRef.current = null
    setDrag(null)
    setOverKey(null)
  }

  const drop = (toDate: string): void => {
    const d = dragRef.current
    // 같은 날에 떨구면 아무 일도 하지 않는다
    if (d && d.fromDate !== toDate) onMoveItem(d, toDate)
    endDrag()
  }

  /** 드래그 중이 아니면 칸을 강조하지 않는다 */
  const canDropOn = (key: string): boolean =>
    Boolean(dragRef.current) && dragRef.current!.fromDate !== key

  const today = new Date()

  return (
    <section className="cal">
      <div className="cal-head">
        <button className="title no-drag" onClick={onToday} data-tip="오늘로 돌아가기">
          {monthTitle(month)}
        </button>
        <div className="nav no-drag">
          <button className="icon-btn" onClick={onPrev} aria-label="이전 달">
            <ChevronLeft />
          </button>
          <button className="icon-btn" onClick={onNext} aria-label="다음 달">
            <ChevronRight />
          </button>
        </div>
      </div>

      <div className="weekdays">
        {WEEKDAYS.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>

      <div className="grid-viewport no-drag" ref={gridRef}>
        {/* key 를 바꿔 리마운트시켜야 매달 진입 애니메이션이 다시 돈다 */}
        <div className="grid" key={toKey(month)} data-dir={dir}>
          {weeks.map((week) => (
            <div className="week" key={toKey(week[0])}>
              {week.map((d) => {
                const key = toKey(d)
                const b = byDate.get(key)
                return (
                  <DayCell
                    key={key}
                    date={d}
                    inMonth={isSameMonth(d, month)}
                    isToday={isSameDay(d, today)}
                    isSelected={isSameDay(d, selected)}
                    workHours={workHours[key]}
                    events={b?.events ?? []}
                    todos={b?.todos ?? []}
                    maxItems={maxItems}
                    compact={compact}
                    editingId={editingId}
                    dateKey={key}
                    draggingId={drag?.id ?? null}
                    isDropTarget={overKey === key && canDropOn(key)}
                    onSelect={() => onSelect(d)}
                    onToggleTodo={onToggleTodo}
                    onEditEvent={onEditEvent}
                    onEditTodo={onEditTodo}
                    onDragStartItem={startDrag}
                    onDragEndItem={endDrag}
                    onDragOverCell={() => setOverKey(key)}
                    onDropOnCell={() => drop(key)}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

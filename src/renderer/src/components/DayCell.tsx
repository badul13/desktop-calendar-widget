import { useEffect, useRef } from 'react'
import type { CalEvent, Todo, WorkHours } from '@shared/types'
import { Check } from '../lib/icons'

/** 드래그로 옮기는 중인 항목 */
export type DragItem = { kind: 'event' | 'todo'; id: string; fromDate: string }

type Props = {
  date: Date
  dateKey: string
  inMonth: boolean
  isToday: boolean
  isSelected: boolean
  workHours: WorkHours | undefined
  events: CalEvent[]
  todos: Todo[]
  /** 칸 높이에 맞춰 계산된 최대 표시 개수. 넘치면 '+N' 으로 접는다. */
  maxItems: number
  /** 칸이 좁아 날짜 숫자 옆에 근무시간이 안 들어가면 아랫줄로 내린다 */
  compact: boolean
  /** 편집 중인 항목 id — 달력에서도 어느 걸 고치는 중인지 보여준다 */
  editingId: string | null
  /** 드래그 중인 항목 id */
  draggingId: string | null
  /** 지금 이 칸 위에 항목을 떨구려는 중인지 */
  isDropTarget: boolean
  onSelect: () => void
  onToggleTodo: (t: Todo) => void
  onEditEvent: (e: CalEvent) => void
  onEditTodo: (t: Todo) => void
  onDragStartItem: (d: DragItem) => void
  onDragEndItem: () => void
  onDragOverCell: () => void
  onDropOnCell: () => void
}

/**
 * 좁은 칸용 축약. '10:00' → '10', '09:30' → '9:30'.
 * 정시가 대부분이라 이것만으로 '10:00~19:00'(11글자)이 '10~19'(5글자)로 줄어든다.
 */
function shortTime(t: string): string {
  const [h, m] = t.split(':')
  const hh = String(Number(h))
  return m === '00' ? hh : `${hh}:${m}`
}

/**
 * 한 번 클릭 동작을 이만큼 미뤘다가, 더블클릭이 오면 취소한다.
 * 길수록 더블클릭을 확실히 잡아내지만 체크가 굼떠 보인다.
 */
const CLICK_DELAY = 200

/**
 * 달력 한 칸.
 *
 * 세 종류가 한 칸에 같이 들어가므로 위치·모양·색을 전부 갈라놓는다:
 *   근무시간 — 맨 위 페리윙클 배지. 매일 다르므로 제일 먼저 눈에 띄어야 한다
 *   일정     — 칸 위쪽부터. 왼쪽 민트 막대 + 시간
 *   할 일    — 칸 아래쪽부터 차오른다. 살구색으로 채운 칩
 *
 * 할 일을 아래에 붙이면 일정과 물리적으로 떨어져서 훑을 때 헷갈리지 않는다.
 * 안 끝난 할 일은 칩을 채워 눈에 띄게 하고, 끝낸 것은 배경을 빼서 뒤로 물린다
 * (남은 일이 보여야 쓸모가 있지, 끝낸 일이 보일 이유는 없다).
 *
 * 조작:
 *   할 일 한 번 클릭 — 완료 토글
 *   두 번 클릭      — 수정
 *   끌어다 놓기      — 다른 날짜로 이동
 */
export default function DayCell({
  date,
  dateKey,
  inMonth,
  isToday,
  isSelected,
  workHours,
  events,
  todos,
  maxItems,
  compact,
  editingId,
  draggingId,
  isDropTarget,
  onSelect,
  onToggleTodo,
  onEditEvent,
  onEditTodo,
  onDragStartItem,
  onDragEndItem,
  onDragOverCell,
  onDropOnCell
}: Props): React.JSX.Element {
  /**
   * 브라우저는 더블클릭 전에 클릭을 두 번 흘린다.
   * 그대로 두면 할 일 본문을 두 번 눌렀을 때 완료가 두 번 뒤집힌 뒤 수정창이 뜬다.
   * 그래서 단일 클릭 동작은 잠깐 미뤄뒀다가, 더블클릭이 오면 취소한다.
   */
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (clickTimer.current) clearTimeout(clickTimer.current)
    }
  }, [])

  const deferClick = (fn: () => void): void => {
    if (clickTimer.current) clearTimeout(clickTimer.current)
    clickTimer.current = setTimeout(() => {
      clickTimer.current = null
      fn()
    }, CLICK_DELAY)
  }

  const cancelDeferred = (): void => {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current)
      clickTimer.current = null
    }
  }

  const sortedEvents = [...events].sort((a, b) =>
    (a.time ?? '99:99').localeCompare(b.time ?? '99:99')
  )
  const sortedTodos = [...todos].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1
    return a.createdAt.localeCompare(b.createdAt)
  })

  const total = sortedEvents.length + sortedTodos.length
  const room = Math.max(1, maxItems)
  // 다 못 넣으면 마지막 한 줄은 '+N' 표시에 내준다
  const shown = total > room ? room - 1 : total
  const shownEvents = sortedEvents.slice(0, shown)
  const shownTodos = sortedTodos.slice(0, Math.max(0, shown - shownEvents.length))
  const hidden = total - shownEvents.length - shownTodos.length

  const startDrag = (e: React.DragEvent, kind: 'event' | 'todo', id: string): void => {
    cancelDeferred()
    // 드롭 판정은 React 상태로 하지만, 브라우저가 드래그를 시작하려면 데이터가 필요하다
    e.dataTransfer.setData('text/plain', id)
    e.dataTransfer.effectAllowed = 'move'
    onDragStartItem({ kind, id, fromDate: dateKey })
  }

  return (
    <div
      className="cell"
      data-dow={date.getDay()}
      data-today={isToday}
      data-selected={isSelected}
      data-outside={!inMonth}
      data-drop={isDropTarget}
      onClick={onSelect}
      onDragOver={(e) => {
        // preventDefault 를 해야 이 칸이 드롭을 받는다
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        onDragOverCell()
      }}
      onDrop={(e) => {
        e.preventDefault()
        onDropOnCell()
      }}
    >
      <div className="cell-head">
        <span className="n">{date.getDate()}</span>
        {workHours && !compact && (
          <span className="work" data-tip="근무 시간">
            {workHours.start}~{workHours.end}
          </span>
        )}
      </div>

      {workHours && compact && (
        <div className="work-row">
          <span className="work" data-tip={`근무 ${workHours.start}~${workHours.end}`}>
            {shortTime(workHours.start)}~{shortTime(workHours.end)}
          </span>
        </div>
      )}

      <div className="cell-items">
        <div className="grp ev-grp">
          {shownEvents.map((e) => (
            <div
              className="it ev"
              key={e.id}
              draggable
              data-editing={editingId === e.id}
              data-dragging={draggingId === e.id}
              data-tip={`${e.time ?? '종일'} ${e.title}\n두 번 클릭해서 수정 · 끌어서 날짜 이동`}
              onDragStart={(ev) => startDrag(ev, 'event', e.id)}
              onDragEnd={onDragEndItem}
              onClick={(ev) => {
                ev.stopPropagation()
                // 수정 중인 항목은 한 번 클릭에 반응하지 않는다.
                // (닫는 것도 두 번 클릭 — 켤 때와 끌 때가 같은 동작이어야 헷갈리지 않는다)
                if (editingId === e.id) return
                // 일정은 한 번 클릭에 그 날짜를 고르기만 한다
                onSelect()
              }}
              onDoubleClick={(ev) => {
                ev.stopPropagation()
                cancelDeferred()
                onEditEvent(e)
              }}
            >
              <span className="bar" style={e.color ? { background: e.color } : undefined} />
              {e.time && <span className="t">{e.time}</span>}
              <span className="tx">{e.title}</span>
            </div>
          ))}
        </div>

        {/* margin-top:auto 로 아래에서부터 차오른다 */}
        <div className="grp td-grp">
          {shownTodos.map((t) => (
            <div
              className="it td"
              key={t.id}
              draggable
              data-done={t.done}
              data-editing={editingId === t.id}
              data-dragging={draggingId === t.id}
              data-tip={`${t.title}\n클릭해서 완료 · 두 번 클릭해서 수정 · 끌어서 날짜 이동`}
              onDragStart={(ev) => startDrag(ev, 'todo', t.id)}
              onDragEnd={onDragEndItem}
              onClick={(ev) => {
                ev.stopPropagation()
                // 수정 중이면 한 번 클릭으로는 아무 일도 없다.
                // 이게 없으면 수정을 풀려고 누른 클릭에 완료까지 같이 토글된다.
                if (editingId === t.id) return
                // 본문 어디를 눌러도 완료가 토글된다 (체크박스만 노릴 필요 없이)
                onSelect()
                deferClick(() => onToggleTodo({ ...t, done: !t.done }))
              }}
              onDoubleClick={(ev) => {
                ev.stopPropagation()
                cancelDeferred()
                onEditTodo(t)
              }}
            >
              <button
                className="box"
                tabIndex={-1}
                onClick={(ev) => {
                  // 체크박스는 눌린 즉시 반응해야 한다 — 지연 없이 바로 토글
                  ev.stopPropagation()
                  cancelDeferred()
                  onToggleTodo({ ...t, done: !t.done })
                }}
                onDoubleClick={(ev) => ev.stopPropagation()}
                aria-label={t.done ? `${t.title} 완료 취소` : `${t.title} 완료`}
              >
                <Check size={8} />
              </button>
              <span className="tx">{t.title}</span>
            </div>
          ))}
          {hidden > 0 && <div className="more">+{hidden}</div>}
        </div>
      </div>
    </div>
  )
}

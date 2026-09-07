import { useEffect, useRef, useState } from 'react'
import type { EditTarget, WorkHours } from '@shared/types'
import { listHeading } from '../lib/date'
import { Check, Close, Plus } from '../lib/icons'

type Kind = 'event' | 'todo'

type Props = {
  date: Date
  workHours: WorkHours | undefined
  defaultWorkHours: WorkHours
  /** 달력 칸에서 항목을 클릭하면 여기로 들어와 수정 모드가 된다 */
  editing: EditTarget | null
  onSetWorkHours: (h: WorkHours | null) => void
  onAddEvent: (title: string, time: string | null) => void
  onAddTodo: (title: string) => void
  onSaveEdit: (target: EditTarget, title: string, time: string | null) => void
  onDeleteEdit: (target: EditTarget) => void
  onCancelEdit: () => void
}

/**
 * "930", "9:30", "0930", "9" 같은 입력을 HH:mm 으로 맞춘다.
 * 유연근무 시간을 매일 손으로 넣어야 하므로 입력이 관대해야 한다.
 */
export function normalizeTime(raw: string): string | null {
  const s = raw.trim()
  if (!s) return null
  const m = /^(\d{1,2})[:.]?(\d{2})?$/.exec(s)
  if (!m) return null
  const h = Number(m[1])
  const min = m[2] ? Number(m[2]) : 0
  if (h > 23 || min > 59) return null
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

export default function DayEditor({
  date,
  workHours,
  defaultWorkHours,
  editing,
  onSetWorkHours,
  onAddEvent,
  onAddTodo,
  onSaveEdit,
  onDeleteEdit,
  onCancelEdit
}: Props): React.JSX.Element {
  const [kind, setKind] = useState<Kind>('event')
  const [title, setTitle] = useState('')
  const [time, setTime] = useState('')
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const titleRef = useRef<HTMLInputElement>(null)

  // 날짜를 바꾸면 그 날의 근무시간을 입력창에 채운다
  useEffect(() => {
    setStart(workHours?.start ?? '')
    setEnd(workHours?.end ?? '')
  }, [workHours?.start, workHours?.end, date])

  // 수정 대상이 들어오면 입력창에 그 내용을 싣고 커서를 준다
  useEffect(() => {
    if (!editing) {
      setTitle('')
      setTime('')
      return
    }
    setTitle(editing.item.title)
    setTime(editing.kind === 'event' ? (editing.item.time ?? '') : '')
    titleRef.current?.focus()
    titleRef.current?.select()
  }, [editing])

  // 수정 중 Esc 로 빠져나가기
  useEffect(() => {
    if (!editing) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onCancelEdit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editing, onCancelEdit])

  /** 근무시간은 둘 다 채워졌을 때만 저장하고, 둘 다 비우면 지운다. */
  const commitWorkHours = (rawStart: string, rawEnd: string): void => {
    const s = normalizeTime(rawStart)
    const e = normalizeTime(rawEnd)
    if (!s && !e) {
      if (workHours) onSetWorkHours(null)
      return
    }
    if (!s || !e) return
    if (s === workHours?.start && e === workHours?.end) return
    onSetWorkHours({ start: s, end: e })
  }

  const fillDefault = (): void => {
    setStart(defaultWorkHours.start)
    setEnd(defaultWorkHours.end)
    onSetWorkHours(defaultWorkHours)
  }

  const submit = (): void => {
    const t = title.trim()
    if (!t) return
    if (editing) {
      onSaveEdit(editing, t, editing.kind === 'event' ? normalizeTime(time) : null)
      return
    }
    if (kind === 'event') onAddEvent(t, normalizeTime(time))
    else onAddTodo(t)
    setTitle('')
    setTime('')
    titleRef.current?.focus()
  }

  // 수정 중에는 종류를 바꿀 수 없다 (일정↔할 일 변환은 지원하지 않는다)
  const activeKind: Kind = editing ? editing.kind : kind
  const showTime = activeKind === 'event'

  return (
    <div className="editor no-drag">
      <div className="editor-row">
        <span className="day-label">{listHeading(date)}</span>
        <span className="work-fields">
          <span className="work-tag">근무</span>
          <input
            className="hm"
            value={start}
            placeholder="10:00"
            onChange={(e) => setStart(e.target.value)}
            onBlur={() => commitWorkHours(start, end)}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            aria-label="출근 시간"
          />
          <span className="tilde">~</span>
          <input
            className="hm"
            value={end}
            placeholder="19:00"
            onChange={(e) => setEnd(e.target.value)}
            onBlur={() => commitWorkHours(start, end)}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            aria-label="퇴근 시간"
          />
          {!start && !end && (
            <button className="chip" onClick={fillDefault} data-tip="기본 근무시간으로 채우기">
              {defaultWorkHours.start}~{defaultWorkHours.end}
            </button>
          )}
        </span>
      </div>

      <div className="editor-row add" data-editing={Boolean(editing)}>
        {editing ? (
          <span className="edit-tag" data-kind={activeKind}>
            {activeKind === 'event' ? '일정 수정' : '할 일 수정'}
          </span>
        ) : (
          <span className="seg">
            <button data-active={kind === 'event'} onClick={() => setKind('event')}>
              일정
            </button>
            <button data-active={kind === 'todo'} onClick={() => setKind('todo')}>
              할 일
            </button>
          </span>
        )}

        {!editing && (
          <span className="plus">
            <Plus />
          </span>
        )}

        <input
          ref={titleRef}
          value={title}
          placeholder={editing ? '' : activeKind === 'event' ? '일정 추가' : '할 일 추가'}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />

        {showTime && (
          <input
            className="hm time-in"
            value={time}
            placeholder="시간"
            onChange={(e) => setTime(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            data-tip="비워두면 종일 일정 (예: 14:00, 1400, 9)"
          />
        )}

        {editing && (
          <span className="edit-actions">
            <button className="act save" onClick={submit} data-tip="저장 (Enter)">
              <Check size={11} />
              저장
            </button>
            <button
              className="act danger"
              onClick={() => onDeleteEdit(editing)}
              data-tip="이 항목 삭제"
            >
              삭제
            </button>
            <button className="icon-btn" onClick={onCancelEdit} data-tip="취소 (Esc)" aria-label="취소">
              <Close size={12} />
            </button>
          </span>
        )}
      </div>
    </div>
  )
}

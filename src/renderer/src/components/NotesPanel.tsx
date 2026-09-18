import { useEffect, useRef, useState } from 'react'
import {
  NOTE_COLORS,
  NOTES_MAX_WIDTH,
  NOTES_MIN_WIDTH,
  type Note,
  type NoteColor
} from '@shared/types'
import { Close, Grip, Plus, ChevronRight } from '../lib/icons'
import { isBlank, renderMarkdown, toggleTask } from '../lib/markdown'

type Props = {
  notes: Note[]
  width: number
  onCreate: (text: string) => void
  onUpdate: (id: string, text: string) => void
  onRecolor: (id: string, color: NoteColor) => void
  onReorder: (id: string, toIndex: number) => void
  onDelete: (id: string) => void
  onResize: (width: number) => void
  onCollapse: () => void
}

const COLOR_LABEL: Record<NoteColor, string> = {
  yellow: '노랑',
  pink: '분홍',
  mint: '민트',
  blue: '파랑',
  lilac: '연보라'
}

/** '2026.09.07' 형태. 메모는 언제 적었는지만 알면 되므로 시각은 뺀다. */
function stamp(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

/** 내용에 맞춰 높이를 늘린다. 스크롤바가 생기면 짧은 메모가 답답해 보인다. */
function autoGrow(el: HTMLTextAreaElement | null): void {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

/**
 * 쪽지 한 장.
 *
 * 평소에는 마크다운을 그려서 보여주고, 누르면 원본으로 바뀌어 고칠 수 있다.
 * 늘 원본만 보이면 `- [ ]` 같은 기호가 그대로 노출되어 읽기 나쁘고,
 * 늘 렌더만 하면 고칠 수가 없다.
 */
function NoteCard({
  note,
  autoFocus,
  dragging,
  dropEdge,
  canDrop,
  onUpdate,
  onRecolor,
  onDelete,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop
}: {
  note: Note
  /** 방금 '+ 메모' 로 만든 쪽지 — 바로 타이핑할 수 있게 커서를 준다 */
  autoFocus: boolean
  /** 지금 끌리고 있는 쪽지인가 — 원래 자리를 흐리게 남긴다 */
  dragging: boolean
  /** 이 쪽지의 위/아래 중 어디에 꽂히는지. 그 자리에 선을 긋는다 */
  dropEdge: 'before' | 'after' | null
  /** 쪽지를 끄는 중인가. state 가 아니라 ref 를 읽어야 첫 dragover/drop 을 놓치지 않는다 */
  canDrop: () => boolean
  onUpdate: (id: string, text: string) => void
  onRecolor: (id: string, color: NoteColor) => void
  onDelete: (id: string) => void
  onDragStart: () => void
  onDragEnd: () => void
  onDragOver: (before: boolean) => void
  onDrop: (before: boolean) => void
}): React.JSX.Element {
  const [editing, setEditing] = useState(autoFocus)
  const [text, setText] = useState(note.text)
  const ref = useRef<HTMLTextAreaElement>(null)
  const card = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  /** 커서가 쪽지의 위쪽 절반에 있으면 그 위에, 아래쪽이면 그 아래에 꽂는다 */
  const half = (e: React.DragEvent): boolean => {
    const r = e.currentTarget.getBoundingClientRect()
    return e.clientY < r.top + r.height / 2
  }

  // 다른 곳에서 바뀐 내용을 받아온다. 편집 중일 땐 덮어쓰지 않는다.
  useEffect(() => {
    if (document.activeElement !== ref.current) setText(note.text)
  }, [note.text])

  useEffect(() => {
    if (!editing) return
    autoGrow(ref.current)
    ref.current?.focus()
  }, [editing])

  useEffect(() => {
    if (editing) autoGrow(ref.current)
  }, [text, editing])

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  /** 타이핑할 때마다 파일을 쓰지 않도록 잠깐 모았다 저장한다 */
  const change = (v: string): void => {
    setText(v)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => onUpdate(note.id, v), 500)
  }

  const finish = (): void => {
    if (timer.current) clearTimeout(timer.current)
    if (text !== note.text) onUpdate(note.id, text)
    setEditing(false)
  }

  /**
   * 렌더된 체크박스를 눌렀을 때. 화면의 몇 번째 체크박스인지 세서
   * 원본의 같은 순번을 뒤집는다 (marked 가 원본 순서대로 그리므로 순번이 대응된다).
   * 브라우저가 제 마음대로 체크 상태를 바꾸지 않게 막고, 다시 그린 결과로만 반영한다.
   */
  const toggleCheckbox = (host: HTMLElement, box: HTMLInputElement): void => {
    const boxes = Array.from(host.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'))
    const i = boxes.indexOf(box)
    if (i < 0) return
    const next = toggleTask(text, i)
    if (next === text) return
    if (timer.current) clearTimeout(timer.current)
    setText(next)
    onUpdate(note.id, next)
  }

  return (
    <div
      ref={card}
      className="note"
      data-color={note.color ?? 'yellow'}
      data-editing={editing}
      data-dragging={dragging}
      data-drop={dropEdge ?? undefined}
      onDragOver={(e) => {
        // preventDefault 를 해야 이 자리가 '놓을 수 있는 곳' 이 된다
        if (!canDrop()) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        onDragOver(half(e))
      }}
      onDrop={(e) => {
        if (!canDrop()) return
        e.preventDefault()
        onDrop(half(e))
      }}
    >
      {editing ? (
        <textarea
          ref={ref}
          value={text}
          rows={1}
          placeholder="메모를 적어보세요 — 마크다운을 씁니다"
          onChange={(e) => change(e.target.value)}
          onBlur={finish}
          onKeyDown={(e) => {
            // Esc 로 편집만 끝낸다. Enter 는 줄바꿈이라 그대로 둔다.
            if (e.key === 'Escape') {
              e.stopPropagation()
              ref.current?.blur()
            }
          }}
        />
      ) : (
        <div
          className="md"
          role="button"
          tabIndex={0}
          data-tip="클릭해서 수정"
          onClick={(e) => {
            const el = e.target as HTMLElement
            // 체크박스는 그 자리에서 토글하고 편집으로 들어가지 않는다
            if (el instanceof HTMLInputElement && el.type === 'checkbox') {
              e.preventDefault()
              toggleCheckbox(e.currentTarget, el)
              return
            }
            // 링크를 눌렀을 때도 편집으로 들어가지 않는다
            if (el.closest('a')) return
            setEditing(true)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') setEditing(true)
          }}
          {...(isBlank(text)
            ? {}
            : { dangerouslySetInnerHTML: { __html: renderMarkdown(text) } })}
        >
          {isBlank(text) ? <p className="ph">메모를 적어보세요</p> : null}
        </div>
      )}

      <div className="note-foot">
        {/* button 이 아니라 span 이다. 폼 컨트롤은 브라우저마다 draggable 을
            무시하는 경우가 있어 손잡이로는 쓰지 않는다. */}
        <span
          className="grip"
          role="button"
          draggable
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = 'move'
            e.dataTransfer.setData('text/plain', note.id)
            // 손잡이만 끌리면 무엇을 옮기는지 안 보인다. 쪽지 전체를 끌리는 그림으로 쓴다
            if (card.current) e.dataTransfer.setDragImage(card.current, 24, 16)
            onDragStart()
          }}
          onDragEnd={onDragEnd}
          data-tip="끌어서 순서 바꾸기"
          aria-label="끌어서 순서 바꾸기"
        >
          <Grip size={11} />
        </span>
        <span className="when">{stamp(note.updatedAt)}</span>
        <span className="swatches">
          {NOTE_COLORS.map((c) => (
            <button
              key={c}
              className="sw"
              data-color={c}
              data-active={(note.color ?? 'yellow') === c}
              onClick={() => onRecolor(note.id, c)}
              data-tip={COLOR_LABEL[c]}
              aria-label={`${COLOR_LABEL[c]} 배경`}
            />
          ))}
        </span>
        <button
          className="del"
          onClick={() => onDelete(note.id)}
          data-tip="메모 삭제"
          aria-label="메모 삭제"
        >
          <Close size={11} />
        </button>
      </div>
    </div>
  )
}

/**
 * 오른쪽 메모장. 날짜와 무관한 자유 메모를 쌓아둔다.
 * 접으면 창이 그만큼 좁아지고, 펴면 다시 넓어진다 (main 의 window:notes).
 * 왼쪽 경계를 끌면 달력과 폭을 나눠 갖는다.
 */
export default function NotesPanel({
  notes,
  width,
  onCreate,
  onUpdate,
  onRecolor,
  onReorder,
  onDelete,
  onResize,
  onCollapse
}: Props): React.JSX.Element {
  /**
   * '+ 메모' 를 누르면 새 쪽지가 맨 위에 생기고 거기에 커서가 가야 한다.
   *
   * 렌더 중에 '처음 보는 id 인가' 를 판정하면 안 된다 — StrictMode 는 렌더를
   * 두 번 돌리므로 두 번째 패스에서 이미 본 것으로 처리되어 포커스를 놓친다.
   * 대신 누른 시점에 플래그를 세우고, 새 쪽지가 실제로 나타나면 내린다.
   */
  /**
   * '누르기 전에 있던 쪽지 id 들'. 여기 없는 빈 쪽지가 나타나면 그게 방금 만든 것이다.
   *
   * 단순히 '요청했음' 플래그만 두면 안 된다. 플래그를 세운 직후의 렌더에서
   * 목록 길이는 이미 0 이 아니라서, 새 쪽지가 도착하기도 전에 플래그가 꺼진다.
   * (브라우저 목은 마이크로태스크라 우연히 통과하지만 실제 IPC 에서는 늘 늦는다)
   */
  const [seenIds, setSeenIds] = useState<Set<string> | null>(null)

  const create = (): void => {
    setSeenIds(new Set(notes.map((n) => n.id)))
    onCreate('')
  }

  /* ---- 끌어서 순서 바꾸기 ---- */

  /**
   * 달력 항목 이동과 같은 이유로 ref 와 state 를 같이 둔다.
   * dragover 중에는 브라우저가 dataTransfer 를 못 읽게 막으므로 무엇이 끌려오는지
   * 따로 기억해야 하는데, state 만 쓰면 dragstart 직후의 첫 dragover/drop 이
   * 아직 반영 안 된 옛 값을 본다. 판정은 ref 로, 흐리게/선 긋기는 state 로 한다.
   */
  const dragRef = useRef<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [over, setOver] = useState<{ id: string; before: boolean } | null>(null)

  const endDrag = (): void => {
    dragRef.current = null
    setDragId(null)
    setOver(null)
  }

  /**
   * 목록에 보이는 순서가 곧 `notes` 배열 순서다.
   * 끌던 쪽지를 먼저 빼낸 뒤의 자리로 환산해서 넘긴다 — 자기보다 아래로 옮길 때는
   * 자기가 빠진 만큼 목표 자리가 한 칸 당겨진다.
   */
  const drop = (targetId: string, before: boolean): void => {
    const id = dragRef.current
    endDrag()
    if (!id || id === targetId) return
    const from = notes.findIndex((n) => n.id === id)
    const t = notes.findIndex((n) => n.id === targetId)
    if (from < 0 || t < 0) return
    let to = before ? t : t + 1
    if (from < to) to -= 1
    if (to === from) return
    onReorder(id, to)
  }

  /* ---- 왼쪽 경계를 끌어 폭 조절 ---- */

  // 끄는 동안은 화면만 따라오게 하고, 손을 뗄 때 한 번 저장한다
  // (매 픽셀마다 파일을 쓰면 낭비다)
  const [dragWidth, setDragWidth] = useState<number | null>(null)
  const dragStart = useRef<{ x: number; w: number } | null>(null)

  /**
   * onResize 는 App 이 렌더마다 새로 만드는 화살표라 신원이 계속 바뀐다.
   * 핸들러가 그걸 직접 붙들면 드래그 도중 App 이 한 번만 다시 그려도
   * (data:changed 방송, 배경 밝기 변경 등) 정리 함수가 돌아 리스너가 떨어지고,
   * 드래그가 그 자리에서 얼어붙는다. ref 로 최신 것만 가리키게 해서 끊지 않는다.
   */
  const onResizeRef = useRef(onResize)
  useEffect(() => {
    onResizeRef.current = onResize
  })

  const handlers = useRef<{ move: (e: PointerEvent) => void; up: () => void } | null>(null)
  if (handlers.current === null) {
    const move = (e: PointerEvent): void => {
      const s = dragStart.current
      if (!s) return
      // 경계를 왼쪽으로 끌면 메모장이 넓어진다
      const next = Math.round(s.w + (s.x - e.clientX))
      setDragWidth(Math.min(NOTES_MAX_WIDTH, Math.max(NOTES_MIN_WIDTH, next)))
    }
    const up = (): void => {
      dragStart.current = null
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      setDragWidth((w) => {
        if (w !== null) onResizeRef.current(w)
        return null
      })
    }
    handlers.current = { move, up }
  }

  useEffect(() => {
    const h = handlers.current!
    return () => {
      window.removeEventListener('pointermove', h.move)
      window.removeEventListener('pointerup', h.up)
    }
  }, [])

  const startResize = (e: React.PointerEvent): void => {
    e.preventDefault()
    dragStart.current = { x: e.clientX, w: dragWidth ?? width }
    const h = handlers.current!
    window.addEventListener('pointermove', h.move)
    window.addEventListener('pointerup', h.up)
  }

  return (
    <aside className="notes no-drag" style={{ width: dragWidth ?? width }}>
      <div
        className="notes-resizer"
        data-active={dragWidth !== null}
        onPointerDown={startResize}
        role="separator"
        aria-orientation="vertical"
        aria-label="메모장 폭 조절"
        data-tip="끌어서 메모장 폭 조절"
      />

      <div className="notes-head drag">
        <button className="add-note no-drag" onClick={create}>
          <Plus size={12} />
          메모
        </button>
        <button
          className="icon-btn no-drag"
          onClick={onCollapse}
          data-tip="메모장 접기"
          aria-label="메모장 접기"
        >
          <ChevronRight />
        </button>
      </div>

      <div className="notes-list">
        {notes.length === 0 ? (
          <p className="empty">
            아직 메모가 없어요
            <br />위 &lsquo;메모&rsquo; 를 눌러 추가하세요
          </p>
        ) : (
          notes.map((n) => (
            <NoteCard
              key={n.id}
              note={n}
              autoFocus={seenIds !== null && !seenIds.has(n.id) && n.text === ''}
              dragging={dragId === n.id}
              dropEdge={
                over && over.id === n.id && dragId !== n.id ? (over.before ? 'before' : 'after') : null
              }
              canDrop={() => dragRef.current !== null}
              onUpdate={onUpdate}
              onRecolor={onRecolor}
              onDelete={onDelete}
              onDragStart={() => {
                dragRef.current = n.id
                setDragId(n.id)
              }}
              onDragEnd={endDrag}
              onDragOver={(before) => setOver({ id: n.id, before })}
              onDrop={(before) => drop(n.id, before)}
            />
          ))
        )}
      </div>
    </aside>
  )
}

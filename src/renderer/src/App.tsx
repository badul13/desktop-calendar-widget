import { useCallback, useEffect, useState } from 'react'
import type { EditTarget, NoteColor } from '@shared/types'
import BgSwitcher from './components/BgSwitcher'
import DayEditor from './components/DayEditor'
import HeaderClock from './components/HeaderClock'
import MonthGrid from './components/MonthGrid'
import NotesPanel from './components/NotesPanel'
import SettingsPanel from './components/SettingsPanel'
import Tooltip from './components/Tooltip'
import { useStore } from './hooks/useStore'
import { IS_ELECTRON, bridge } from './lib/bridge'
import { addMonths, fromKey, toKey } from './lib/date'
import { NoteIcon } from './lib/icons'

export default function App(): React.JSX.Element {
  const { data, setData } = useStore()
  const [month, setMonth] = useState(() => new Date())
  const [selected, setSelected] = useState(() => new Date())
  const [dir, setDir] = useState<'next' | 'prev'>('next')
  const [showSettings, setShowSettings] = useState(false)
  const [editing, setEditing] = useState<EditTarget | null>(null)

  // 트레이 메뉴의 '설정…' 에서도 열 수 있다
  useEffect(() => bridge.onOpenSettings(() => setShowSettings(true)), [])

  const step = (delta: number): void => {
    setDir(delta > 0 ? 'next' : 'prev')
    setMonth((m) => addMonths(m, delta))
  }

  const goToday = (): void => {
    const now = new Date()
    setDir(now > month ? 'next' : 'prev')
    setMonth(now)
    setSelected(now)
  }

  // 다른 달의 날짜를 고르면 그 달로 따라간다
  const select = (d: Date): void => {
    if (d.getMonth() !== month.getMonth() || d.getFullYear() !== month.getFullYear()) {
      setDir(d > month ? 'next' : 'prev')
      setMonth(d)
    }
    setSelected(d)
  }

  /** 빈 곳을 고르면 수정 모드에서 빠져나온다 */
  const selectDate = (d: Date): void => {
    setEditing(null)
    select(d)
  }

  const cancelEdit = useCallback(() => setEditing(null), [])

  /**
   * 달력 항목을 두 번 클릭했을 때. 같은 항목을 또 두 번 누르면 수정 모드가 닫힌다.
   *
   * 여기서 날짜 선택까지 직접 한다. selectDate 를 거치면 그쪽이 setEditing(null) 을
   * 먼저 부르는 바람에 아래 토글이 항상 '열기' 로만 동작한다.
   */
  const toggleEdit = (target: EditTarget): void => {
    setEditing((cur) => (cur?.item.id === target.item.id ? null : target))
    select(fromKey(target.item.date))
  }

  /**
   * 수정 저장.
   *
   * editing.item 은 수정을 시작한 순간의 사본이라 그 뒤의 변화를 모른다.
   * 그대로 저장하면 수정 중에 체크한 완료 상태나 드래그로 옮긴 날짜가
   * 조용히 되돌아간다. 그래서 지금 값을 다시 찾아 그 위에 얹는다.
   */
  const saveEdit = (target: EditTarget, title: string, time: string | null): void => {
    if (target.kind === 'event') {
      const cur = data.events.find((x) => x.id === target.item.id) ?? target.item
      void bridge.updateEvent({ ...cur, title, time }).then(setData)
    } else {
      const cur = data.todos.find((x) => x.id === target.item.id) ?? target.item
      void bridge.updateTodo({ ...cur, title }).then(setData)
    }
    setEditing(null)
  }

  const deleteEdit = (target: EditTarget): void => {
    const done =
      target.kind === 'event'
        ? bridge.deleteEvent(target.item.id)
        : bridge.deleteTodo(target.item.id)
    void done.then(setData)
    setEditing(null)
  }

  /** 항목을 다른 날짜 칸에 떨구면 그 날짜로 옮긴다 */
  const moveItem = (d: { kind: 'event' | 'todo'; id: string }, toDate: string): void => {
    if (d.kind === 'event') {
      const item = data.events.find((x) => x.id === d.id)
      if (item) void bridge.updateEvent({ ...item, date: toDate }).then(setData)
    } else {
      const item = data.todos.find((x) => x.id === d.id)
      if (item) void bridge.updateTodo({ ...item, date: toDate }).then(setData)
    }
    // 옮긴 항목을 고치던 중이었다면 그 상태는 이제 낡았다
    setEditing(null)
  }

  const notesOpen = data.settings.notesOpen
  const notesWidth = data.settings.notesWidth

  const toggleNotes = (): void => {
    const next = !notesOpen
    // 창을 먼저 넓히고 패널을 그려야 달력이 잠깐 찌그러지지 않는다.
    // 접을 땐 지금 폭만큼 줄여야 원래 크기로 돌아온다.
    void bridge.setNotesWindow?.(next, notesWidth)
    void bridge.updateSettings({ notesOpen: next }).then(setData)
  }

  /** 경계를 끌어 메모장 폭을 바꾸면 달력과 공간을 나눠 갖는다 (창 크기는 그대로) */
  const resizeNotes = (w: number): void => {
    void bridge.updateSettings({ notesWidth: w }).then(setData)
  }

  const selectedKey = toKey(selected)

  return (
    <>
      <div className="widget drag" data-notes={notesOpen}>
        <div className="main-col">
          <HeaderClock
            settings={data.settings}
            notesOpen={notesOpen}
            onToggleMode={() =>
              void bridge
                .updateSettings({
                  headerMode: data.settings.headerMode === 'clock' ? 'dday' : 'clock'
                })
                .then(setData)
            }
            onToggleNotes={toggleNotes}
            onOpenSettings={() => setShowSettings(true)}
          />

          <MonthGrid
            month={month}
            selected={selected}
            events={data.events}
            todos={data.todos}
            workHours={data.workHours}
            dir={dir}
            onPrev={() => step(-1)}
            onNext={() => step(1)}
            onSelect={selectDate}
            onToday={goToday}
            onToggleTodo={(t) => void bridge.updateTodo(t).then(setData)}
            editingId={editing?.item.id ?? null}
            onEditEvent={(item) => toggleEdit({ kind: 'event', item })}
            onEditTodo={(item) => toggleEdit({ kind: 'todo', item })}
            onMoveItem={moveItem}
          />

          <DayEditor
            date={selected}
            workHours={data.workHours[selectedKey]}
            defaultWorkHours={data.settings.defaultWorkHours}
            editing={editing}
            onSetWorkHours={(h) => void bridge.setWorkHours(selectedKey, h).then(setData)}
            onAddEvent={(title, time) =>
              void bridge.createEvent({ date: selectedKey, time, title }).then(setData)
            }
            onAddTodo={(title) =>
              void bridge.createTodo({ date: selectedKey, title }).then(setData)
            }
            onSaveEdit={saveEdit}
            onDeleteEdit={deleteEdit}
            onCancelEdit={cancelEdit}
          />
        </div>

        {notesOpen && (
          <NotesPanel
            notes={data.notes}
            width={notesWidth}
            onResize={resizeNotes}
            onCreate={(text) => void bridge.createNote(text).then(setData)}
            onUpdate={(id, text) => void bridge.updateNote(id, text).then(setData)}
            onRecolor={(id, color) => void bridge.recolorNote(id, color).then(setData)}
            onDelete={(id) => void bridge.deleteNote(id).then(setData)}
            onCollapse={toggleNotes}
          />
        )}

        {/* 접혀 있을 때 오른쪽 가장자리에 남는 손잡이 */}
        {!notesOpen && (
          <button
            className="notes-tab no-drag"
            onClick={toggleNotes}
            title="메모장 펼치기"
            aria-label="메모장 펼치기"
          >
            <NoteIcon size={14} />
          </button>
        )}

        {showSettings && (
          <SettingsPanel
            settings={data.settings}
            onChange={(patch) => void bridge.updateSettings(patch).then(setData)}
            onClose={() => setShowSettings(false)}
          />
        )}
      </div>

      <Tooltip />
      {!IS_ELECTRON && <BgSwitcher />}
    </>
  )
}

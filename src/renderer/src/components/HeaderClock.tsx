import { useEffect, useState } from 'react'
import type { Settings } from '@shared/types'
import { dateLine, daysUntil, ddayText, format, fromKey } from '../lib/date'
import { Gear, NoteIcon } from '../lib/icons'

type Props = {
  settings: Settings
  notesOpen: boolean
  onToggleMode: () => void
  onToggleNotes: () => void
  onOpenSettings: () => void
}

/**
 * 시계 ↔ D-day 토글. 큰 글씨 부분을 클릭하면 바뀐다.
 * D-day 날짜가 설정되지 않았으면 시계만 보여준다.
 */
export default function HeaderClock({
  settings,
  notesOpen,
  onToggleMode,
  onToggleNotes,
  onOpenSettings
}: Props): React.JSX.Element {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    // 분이 바뀌는 순간에 맞춰 갱신한다 (초 단위 리렌더는 낭비)
    let timer: ReturnType<typeof setTimeout>
    const tick = (): void => {
      const d = new Date()
      setNow(d)
      const msToNextMinute = (60 - d.getSeconds()) * 1000 - d.getMilliseconds()
      timer = setTimeout(tick, msToNextMinute)
    }
    tick()
    return () => clearTimeout(timer)
  }, [])

  const hasDday = Boolean(settings.ddayDate)
  const showDday = settings.headerMode === 'dday' && hasDday

  let big: React.ReactNode
  let lead: React.ReactNode

  if (showDday) {
    const n = daysUntil(fromKey(settings.ddayDate!), now)
    lead = <div className="dday-label">{settings.ddayLabel || 'D-day'}</div>
    big = ddayText(n)
  } else {
    lead = <div className="date-line">{dateLine(now)}</div>
    // 한국어는 '오전 11:19' 순서다.
    // 시간은 12시간제로 — 오전/오후를 붙여 놓고 24시간으로 찍으면
    // '오후 19:00' 같은 말이 안 되는 표기가 나온다.
    big = (
      <>
        <span className="ampm">{now.getHours() < 12 ? '오전' : '오후'}</span>
        {format(now, 'h:mm')}
      </>
    )
  }

  return (
    <header className="header drag">
      <div
        className="lead no-drag"
        onClick={hasDday ? onToggleMode : undefined}
        style={{ cursor: hasDday ? 'pointer' : 'default' }}
        data-tip={hasDday ? '클릭해서 시계 / D-day 전환' : undefined}
      >
        {lead}
        <div className="big">{big}</div>
      </div>
      <div className="tools no-drag">
        <button
          className="icon-btn"
          data-on={notesOpen}
          onClick={onToggleNotes}
          data-tip={notesOpen ? '메모장 접기' : '메모장 펼치기'}
          aria-label={notesOpen ? '메모장 접기' : '메모장 펼치기'}
        >
          <NoteIcon />
        </button>
        <button className="icon-btn" onClick={onOpenSettings} data-tip="설정" aria-label="설정">
          <Gear />
        </button>
      </div>
    </header>
  )
}

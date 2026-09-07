import { useEffect, useState } from 'react'
import type { Settings } from '@shared/types'
import { Close } from '../lib/icons'
import { normalizeTime } from './DayEditor'
import { daysUntil, ddayText, fromKey } from '../lib/date'

type Props = {
  settings: Settings
  onChange: (patch: Partial<Settings>) => void
  onClose: () => void
}

/** 위젯 위에 덮는 설정 시트. 창이 하나뿐이라 별도 창을 띄우지 않는다. */
export default function SettingsPanel({ settings, onChange, onClose }: Props): React.JSX.Element {
  const [start, setStart] = useState(settings.defaultWorkHours.start)
  const [end, setEnd] = useState(settings.defaultWorkHours.end)
  const [ddayLabel, setDdayLabel] = useState(settings.ddayLabel)

  /**
   * 슬라이더는 끄는 동안 input 이벤트가 초당 수십 번 쏟아진다.
   * 그때마다 settings:update 를 부르면 main 이 매번 파일 전체를 동기로 쓴다.
   * 화면은 CSS 변수로 즉시 바꿔 두고, 저장은 손을 뗄 때 한 번만 한다.
   */
  const [opacity, setOpacity] = useState(settings.opacity)
  useEffect(() => setOpacity(settings.opacity), [settings.opacity])

  const previewOpacity = (v: number): void => {
    setOpacity(v)
    document.documentElement.style.setProperty('--widget-opacity', String(v))
  }

  // Esc 로 닫기 — 프레임리스라 닫기 버튼 말고도 탈출구가 필요하다
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const commitDefaultHours = (): void => {
    const s = normalizeTime(start)
    const e = normalizeTime(end)
    if (!s || !e) {
      setStart(settings.defaultWorkHours.start)
      setEnd(settings.defaultWorkHours.end)
      return
    }
    onChange({ defaultWorkHours: { start: s, end: e } })
  }

  const dday = settings.ddayDate ? daysUntil(fromKey(settings.ddayDate)) : null

  return (
    <div className="sheet no-drag" onClick={onClose}>
      <div className="sheet-body" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>설정</h2>
          <button className="icon-btn" onClick={onClose} aria-label="닫기" data-tip="닫기 (Esc)">
            <Close size={14} />
          </button>
        </div>

        <label className="field">
          <span className="lb">투명도</span>
          <span className="ctl">
            <input
              type="range"
              min={0.3}
              max={1}
              step={0.02}
              value={opacity}
              onChange={(e) => previewOpacity(Number(e.target.value))}
              onPointerUp={(e) => onChange({ opacity: Number(e.currentTarget.value) })}
              onKeyUp={(e) => onChange({ opacity: Number(e.currentTarget.value) })}
            />
            <em>{Math.round(opacity * 100)}%</em>
          </span>
        </label>
        <p className="hint">메모장은 읽기 편하도록 이 값보다 조금 더 진하게 표시됩니다.</p>

        <div className="field">
          <span className="lb">배경 밝기</span>
          <span className="ctl seg-wide">
            {(['auto', 'light', 'dark'] as const).map((m) => (
              <button
                key={m}
                data-active={settings.backdropMode === m}
                onClick={() => onChange({ backdropMode: m })}
              >
                {m === 'auto' ? '자동' : m === 'light' ? '밝게' : '어둡게'}
              </button>
            ))}
          </span>
        </div>
        <p className="hint">
          자동은 배경화면에서 위젯이 놓인 자리의 밝기를 읽어 스스로 바꿉니다. 배경화면을 바꾸면
          잠시 뒤 따라옵니다.
        </p>

        <div className="field">
          <span className="lb">기본 근무시간</span>
          <span className="ctl">
            <input
              className="hm"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              onBlur={commitDefaultHours}
              aria-label="기본 출근 시간"
            />
            <span className="tilde">~</span>
            <input
              className="hm"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              onBlur={commitDefaultHours}
              aria-label="기본 퇴근 시간"
            />
          </span>
        </div>
        <p className="hint">날짜를 고르고 아래 근무 칸의 회색 버튼을 누르면 이 값이 채워집니다.</p>

        <div className="field">
          <span className="lb">D-day</span>
          <span className="ctl">
            <input
              className="txt"
              value={ddayLabel}
              placeholder="이름 (예: 프로젝트 마감)"
              onChange={(e) => setDdayLabel(e.target.value)}
              onBlur={() => onChange({ ddayLabel: ddayLabel.trim() || 'D-day' })}
            />
            <input
              type="date"
              className="txt date"
              value={settings.ddayDate ?? ''}
              onChange={(e) => onChange({ ddayDate: e.target.value || null })}
            />
          </span>
        </div>
        <p className="hint">
          {dday === null
            ? '날짜를 넣으면 위젯 왼쪽 위 시계를 눌러 D-day 로 전환할 수 있습니다.'
            : `현재 ${ddayText(dday)} — 시계를 눌러 전환하세요.`}
        </p>

        <label className="field row">
          <span className="lb">Windows 시작 시 실행</span>
          <input
            type="checkbox"
            checked={settings.openAtLogin}
            onChange={(e) => onChange({ openAtLogin: e.target.checked })}
          />
        </label>

        <p className="hint foot">
          위젯을 끄려면 작업표시줄 트레이의 분홍 달력 아이콘을 우클릭하세요.
        </p>
      </div>
    </div>
  )
}

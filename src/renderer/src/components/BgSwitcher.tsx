import { useState } from 'react'

/**
 * 브라우저 미리보기에서만 뜨는 배경 전환 버튼.
 * 반투명 위젯이 밝은/어두운/복잡한 배경화면 위에서 각각 어떻게 보이는지 확인용.
 *
 * Electron 에서는 배경화면 밝기를 실제로 재서 data-backdrop 을 정하지만,
 * 브라우저엔 배경화면이 없으므로 여기서 같이 바꿔준다.
 */
const BACKGROUNDS = [
  {
    key: '',
    label: '밝은 배경',
    backdrop: 'light',
    swatch: 'linear-gradient(140deg,#f2eaff,#e6f0ff,#fff2f6)'
  },
  {
    key: 'bg-dark',
    label: '어두운 배경',
    backdrop: 'dark',
    swatch: 'linear-gradient(150deg,#2a2438,#35283a)'
  },
  {
    key: 'bg-photo',
    label: '사진 배경',
    backdrop: 'dark',
    swatch: 'linear-gradient(160deg,#4a6d8c,#d8a98f)'
  },
  {
    key: 'bg-busy',
    label: '복잡한 밝은 배경',
    backdrop: 'light',
    swatch: 'repeating-linear-gradient(45deg,#dfe6ef 0 5px,#eef2f7 5px 10px)'
  }
] as const

export default function BgSwitcher(): React.JSX.Element {
  const [active, setActive] = useState<string>('')
  const [forced, setForced] = useState<'light' | 'dark' | null>(null)

  const apply = (key: string, backdrop: 'light' | 'dark'): void => {
    BACKGROUNDS.forEach((b) => b.key && document.body.classList.remove(b.key))
    if (key) document.body.classList.add(key)
    document.documentElement.dataset.backdrop = forced ?? backdrop
    setActive(key)
  }

  const flip = (): void => {
    const next = document.documentElement.dataset.backdrop === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.backdrop = next
    setForced(next)
  }

  return (
    <div className="bg-switcher">
      {BACKGROUNDS.map((b) => (
        <button
          key={b.key || 'default'}
          data-tip={b.label}
          aria-label={b.label}
          data-active={active === b.key}
          style={{ background: b.swatch }}
          onClick={() => {
            setForced(null)
            apply(b.key, b.backdrop)
          }}
        />
      ))}
      <span className="sep" />
      <button
        className="note"
        style={{ width: 'auto', height: 'auto', border: 0, padding: '0 2px' }}
        onClick={flip}
        data-tip="자동 판정을 무시하고 밝기 모드만 뒤집어 본다"
      >
        밝기 뒤집기
      </button>
    </div>
  )
}

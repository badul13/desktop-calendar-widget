import { useEffect, useRef, useState } from 'react'

type Tip = { text: string; x: number; y: number; flip: boolean }

/** 마우스를 올리고 이만큼 머물러야 뜬다 — 지나가기만 할 땐 안 뜬다 */
const DELAY = 450
/** 커서 아래로 이만큼 띄운다 */
const OFFSET = 16
const MAX_WIDTH = 220

/**
 * 위젯 안에서 쓰는 말풍선.
 *
 * 브라우저 기본 title 툴팁은 Win32 회색 상자로 그려져서 위젯과 따로 논다.
 * 그래서 title 대신 data-tip 을 쓰고 여기서 직접 그린다.
 *
 * 항목마다 리스너를 달지 않고 위젯 전체에서 한 번만 듣는다.
 * 달력 칸이 수십 개라 각자 다는 건 낭비고, 항목이 다시 그려질 때마다
 * 리스너를 붙였다 뗐다 하는 것도 성가시다.
 */
export default function Tooltip(): React.JSX.Element | null {
  const [tip, setTip] = useState<Tip | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const clear = (): void => {
      if (timer.current) clearTimeout(timer.current)
      timer.current = null
      setTip(null)
    }

    const onOver = (e: MouseEvent): void => {
      const host = (e.target as HTMLElement | null)?.closest?.('[data-tip]') as HTMLElement | null
      const text = host?.dataset.tip?.trim()
      if (!host || !text) {
        clear()
        return
      }
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => {
        // 기다리는 450ms 사이에 대상이 사라질 수 있다 (달 이동, 항목 드래그,
        // data:changed 로 인한 재렌더). 떨어져 나간 노드의 좌표는 전부 0 이라
        // 그대로 두면 왼쪽 위 구석에 낡은 말풍선이 박힌 채로 남는다.
        if (!host.isConnected) return
        const r = host.getBoundingClientRect()
        if (r.width === 0 && r.height === 0) return
        // 아래로 띄우되, 화면 밑에 걸리면 위로 뒤집는다
        const below = r.bottom + OFFSET + 60 < window.innerHeight
        setTip({
          text,
          x: Math.min(Math.max(r.left + r.width / 2, MAX_WIDTH / 2 + 8), window.innerWidth - MAX_WIDTH / 2 - 8),
          y: below ? r.bottom + 6 : r.top - 6,
          flip: !below
        })
      }, DELAY)
    }

    // 스크롤·클릭·창 이동 중에는 자리가 어긋나므로 그냥 없앤다.
    // (mouseleave 는 버블링하지 않아 document 에 걸면 창 밖으로 나갈 때만 뜬다.
    //  요소 사이 이동은 위의 mouseover 가 data-tip 없는 곳을 만나며 처리한다)
    document.addEventListener('mouseover', onOver)
    document.addEventListener('mouseleave', clear)
    document.addEventListener('mousedown', clear)
    document.addEventListener('wheel', clear, { passive: true })
    window.addEventListener('blur', clear)
    return () => {
      if (timer.current) clearTimeout(timer.current)
      document.removeEventListener('mouseover', onOver)
      document.removeEventListener('mouseleave', clear)
      document.removeEventListener('mousedown', clear)
      document.removeEventListener('wheel', clear)
      window.removeEventListener('blur', clear)
    }
  }, [])

  if (!tip) return null

  return (
    <div
      className="tip"
      data-flip={tip.flip}
      style={{ left: tip.x, top: tip.y, maxWidth: MAX_WIDTH }}
      role="tooltip"
    >
      {tip.text.split('\n').map((line, i) => (
        <span key={i} className={i === 0 ? 'tip-main' : 'tip-sub'}>
          {line}
        </span>
      ))}
    </div>
  )
}

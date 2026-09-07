import { useCallback, useEffect, useState } from 'react'
import { DEFAULT_DATA, type AppData, type Backdrop } from '@shared/types'
import { bridge } from '../lib/bridge'

/**
 * main 프로세스가 들고 있는 상태의 읽기 전용 사본.
 * 쓰기는 전부 bridge 를 통해 main 으로 가고, 저장이 끝나면
 * data:changed 로 되돌아온다 (단일 진실 공급원은 main 쪽 data.json).
 */
export function useStore(): {
  data: AppData
  ready: boolean
  backdrop: Backdrop
  setData: (d: AppData) => void
} {
  const [data, setData] = useState<AppData>(DEFAULT_DATA)
  const [ready, setReady] = useState(false)
  const [backdrop, setBackdrop] = useState<Backdrop>('light')

  useEffect(() => {
    let alive = true
    void bridge.getData().then((d) => {
      if (!alive) return
      setData(d)
      setReady(true)
    })
    const offData = bridge.onDataChanged((d) => alive && setData(d))
    const offBackdrop = bridge.onBackdropChanged?.((v) => alive && setBackdrop(v))
    return () => {
      alive = false
      offData()
      offBackdrop?.()
    }
  }, [])

  // 배경 밝기는 CSS 변수 전환용으로 root 속성에 싣는다
  useEffect(() => {
    document.documentElement.dataset.backdrop = backdrop
  }, [backdrop])

  // 불투명도 슬라이더가 실시간으로 반영되게
  useEffect(() => {
    document.documentElement.style.setProperty('--widget-opacity', String(data.settings.opacity))
  }, [data.settings.opacity])

  const replace = useCallback((d: AppData) => setData(d), [])

  return { data, ready, backdrop, setData: replace }
}

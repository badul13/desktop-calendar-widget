/**
 * 배경화면 밝기를 감시해서 렌더러에 알린다.
 *
 * 다시 재는 시점:
 *  - 창을 옮겼을 때 (배경화면의 다른 부분 위로 갔을 수 있다)
 *  - 배경화면 파일이 바뀌었을 때 (경로/수정시각을 주기적으로 확인)
 *  - 모니터 구성이 바뀌었을 때
 *
 * 배경화면 슬라이드쇼를 쓰는 경우가 있어 폴링이 필요하지만,
 * 경로+mtime 만 확인하므로 비용은 무시할 만하다. 실제 디코딩은 변경 시에만 일어난다.
 */
import { screen, type BrowserWindow } from 'electron'
import { statSync } from 'node:fs'
import { detectBackdrop, wallpaperPath, type Backdrop } from './wallpaper-theme'
import { load } from './store'

const POLL_MS = 20_000

function wallpaperFingerprint(): string {
  const p = wallpaperPath()
  if (!p) return ''
  try {
    return `${p}:${statSync(p).mtimeMs}`
  } catch {
    return p
  }
}

export function startBackdropWatcher(win: BrowserWindow): () => void {
  let lastSent: Backdrop | null = null
  let lastFingerprint = ''

  const publish = async (force = false): Promise<void> => {
    if (win.isDestroyed()) return
    const mode = load().settings.backdropMode
    const value: Backdrop =
      mode === 'auto' ? await detectBackdrop(win.getBounds()) : (mode as Backdrop)
    if (force || value !== lastSent) {
      lastSent = value
      console.log(`[backdrop] ${value} (mode=${mode}, wallpaper=${wallpaperPath() ?? 'none'})`)
      win.webContents.send('backdrop:changed', value)
    }
  }

  const timer = setInterval(() => {
    const fp = wallpaperFingerprint()
    if (fp !== lastFingerprint) {
      lastFingerprint = fp
      void publish()
    }
  }, POLL_MS)

  // 창을 옮기면 배경의 다른 부분 위에 놓인다. 드래그 중 연속 호출을 막으려 디바운스.
  let moveTimer: NodeJS.Timeout | null = null
  const onMove = (): void => {
    if (moveTimer) clearTimeout(moveTimer)
    moveTimer = setTimeout(() => void publish(), 500)
  }
  win.on('move', onMove)

  const onDisplayChange = (): void => void publish()
  screen.on('display-metrics-changed', onDisplayChange)
  screen.on('display-added', onDisplayChange)
  screen.on('display-removed', onDisplayChange)

  // 렌더러가 준비되면 첫 값을 밀어준다.
  // did-finish-load 는 ready-to-show 보다 먼저 끝나 있는 경우가 많다. 무조건
  // once() 로 걸면 이미 지나간 이벤트를 기다리다 첫 값을 영영 못 보낸다.
  // 게다가 배경화면 파일이 없으면 지문이 계속 '' 라 폴링으로도 안 보내진다.
  const kick = (): void => {
    lastFingerprint = wallpaperFingerprint()
    void publish(true)
  }
  if (win.webContents.isLoading()) win.webContents.once('did-finish-load', kick)
  else kick()

  return () => {
    clearInterval(timer)
    if (moveTimer) clearTimeout(moveTimer)
    if (!win.isDestroyed()) win.off('move', onMove)
    screen.off('display-metrics-changed', onDisplayChange)
    screen.off('display-added', onDisplayChange)
    screen.off('display-removed', onDisplayChange)
  }
}

/** 설정에서 수동 전환했을 때 즉시 반영 */
export async function republishBackdrop(win: BrowserWindow): Promise<void> {
  if (win.isDestroyed()) return
  const mode = load().settings.backdropMode
  const value: Backdrop =
    mode === 'auto' ? await detectBackdrop(win.getBounds()) : (mode as Backdrop)
  win.webContents.send('backdrop:changed', value)
}

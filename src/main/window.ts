import { BrowserWindow, screen, shell } from 'electron'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pinToDesktop, sinkToBottom } from './desktop-pin'
import { startBackdropWatcher } from './backdrop'
import { load, patch } from './store'
import {
  WIDGET_DEFAULT_HEIGHT,
  WIDGET_DEFAULT_WIDTH,
  WIDGET_MIN_HEIGHT,
  WIDGET_MIN_WIDTH
} from '../shared/types'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

/**
 * 저장된 위치·크기를 복원한다.
 *
 * 두 가지를 방어한다:
 *  - 모니터 구성이 바뀌어 저장된 자리가 아예 없어진 경우 → 주 모니터 우상단으로
 *  - 자리는 있지만 창이 커져서 화면 밖으로 삐져나가는 경우 → 화면 안으로 당긴다
 *    (기본 크기를 키우면 예전에 저장된 좌표가 그대로 남아 오른쪽이 잘린다)
 */
function resolveBounds(): { x: number; y: number; width: number; height: number } {
  const saved = load().windowBounds
  const width = Math.max(WIDGET_MIN_WIDTH, saved?.width ?? WIDGET_DEFAULT_WIDTH)
  const height = Math.max(WIDGET_MIN_HEIGHT, saved?.height ?? WIDGET_DEFAULT_HEIGHT)

  if (saved) {
    // 창의 중심이 들어 있는 화면을 그 창이 속한 화면으로 본다
    const host = screen.getAllDisplays().find(({ workArea: a }) => {
      const cx = saved.x + width / 2
      const cy = saved.y + height / 2
      return cx >= a.x && cx <= a.x + a.width && cy >= a.y && cy <= a.y + a.height
    })
    if (host) return fit(saved.x, saved.y, width, height, host.workArea)
  }

  const { workArea } = screen.getPrimaryDisplay()
  return fit(
    workArea.x + workArea.width - width - 40,
    workArea.y + 40,
    width,
    height,
    workArea
  )
}

/**
 * 창을 화면 안으로 밀어 넣는다. 좌표뿐 아니라 크기도 줄여야 한다 —
 * 넓은 모니터에서 쓰던 크기를 좁은 모니터에서 복원하면, 폭을 그대로 둔 채
 * 좌표만 당겨봐야 오른쪽이 잘리거나 x 가 음수로 튀어나간다.
 */
function fit(
  x: number,
  y: number,
  width: number,
  height: number,
  a: Electron.Rectangle
): { x: number; y: number; width: number; height: number } {
  const w = Math.max(WIDGET_MIN_WIDTH, Math.min(width, a.width))
  const h = Math.max(WIDGET_MIN_HEIGHT, Math.min(height, a.height))
  return {
    x: Math.round(Math.min(Math.max(x, a.x), a.x + a.width - w)),
    y: Math.round(Math.min(Math.max(y, a.y), a.y + a.height - h)),
    width: w,
    height: h
  }
}

export function createWidgetWindow(): BrowserWindow {
  const { x, y, width, height } = resolveBounds()

  const win = new BrowserWindow({
    width,
    height,
    x,
    y,
    minWidth: WIDGET_MIN_WIDTH,
    minHeight: WIDGET_MIN_HEIGHT,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    hasShadow: false,
    // 끌어서 크기를 바꿀 수 있다. 칸에 보이는 항목 수가 크기에 따라 자동으로 달라진다.
    resizable: true,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    // focusable 은 true 로 둔다 — false 면 입력창에 타이핑을 못 한다
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  win.setMenu(null)

  let unpin: () => void = () => {}
  let unwatchBackdrop: () => void = () => {}
  win.once('ready-to-show', () => {
    win.show()
    unpin = pinToDesktop(win)
    unwatchBackdrop = startBackdropWatcher(win)
  })

  // Windows 의 '바탕화면 보기'(Win+D / 작업표시줄 맨 오른쪽 버튼)는
  // 모든 top-level 창을 최소화한다. 위젯은 바탕화면에 속한 물건이므로
  // 같이 사라지면 앞뒤가 안 맞는다. 최소화되면 곧바로 되돌리고 다시 가라앉힌다.
  // (트레이의 '위젯 숨기기'는 hide() 라서 minimize 가 발생하지 않아 영향 없다)
  win.on('minimize', () => {
    setImmediate(() => {
      if (win.isDestroyed() || !win.isMinimized()) return
      win.restore()
      sinkToBottom(win)
    })
  })

  // 드래그·리사이즈 결과를 저장 (연속 이벤트라 디바운스)
  let saveTimer: NodeJS.Timeout | null = null
  const rememberBounds = (): void => {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      if (win.isDestroyed()) return
      const b = win.getBounds()
      patch((d) => {
        d.windowBounds = { x: b.x, y: b.y, width: b.width, height: b.height }
      })
    }, 400)
  }
  win.on('move', rememberBounds)
  win.on('resize', rememberBounds)

  win.on('closed', () => {
    if (saveTimer) clearTimeout(saveTimer)
    unpin()
    unwatchBackdrop()
  })

  // 위젯 안의 외부 링크는 기본 브라우저로
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

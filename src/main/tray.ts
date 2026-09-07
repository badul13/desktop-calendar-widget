/**
 * 프레임리스 창이라 닫기 버튼이 없다. 트레이 메뉴가 유일한 조작 수단이므로 필수.
 */
import { app, BrowserWindow, Menu, nativeImage, Tray } from 'electron'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { load, patch } from './store'
import { sinkToBottom } from './desktop-pin'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

let tray: Tray | null = null
let rebuildMenu: (() => void) | null = null

function iconPath(): string {
  // dev: out/main/../../resources, prod: resources 가 asar 밖으로 unpack 됨
  return app.isPackaged
    ? join(process.resourcesPath, 'tray.png')
    : join(__dirname, '../../resources/tray.png')
}

export function createTray(win: BrowserWindow, onOpenSettings: () => void): Tray {
  const image = nativeImage.createFromPath(iconPath())
  tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image)
  tray.setToolTip('캘린더 위젯')

  const rebuild = (): void => {
    const { settings } = load()
    const menu = Menu.buildFromTemplate([
      {
        label: win.isVisible() ? '위젯 숨기기' : '위젯 보이기',
        click: () => {
          if (win.isVisible()) {
            win.hide()
          } else {
            win.showInactive()
            sinkToBottom(win)
          }
          rebuild()
        }
      },
      {
        label: '맨 앞으로 가져오기',
        click: () => {
          if (!win.isVisible()) win.show()
          win.focus()
        }
      },
      { type: 'separator' },
      { label: '설정…', click: onOpenSettings },
      {
        label: 'Windows 시작 시 실행',
        type: 'checkbox',
        checked: settings.openAtLogin,
        click: (item) => {
          patch((d) => {
            d.settings.openAtLogin = item.checked
          })
          app.setLoginItemSettings({ openAtLogin: item.checked })
          rebuild()
        }
      },
      { type: 'separator' },
      { label: '종료', click: () => app.quit() }
    ])
    tray!.setContextMenu(menu)
  }

  rebuildMenu = rebuild
  rebuild()
  win.on('show', rebuild)
  win.on('hide', rebuild)

  // 트레이 아이콘을 더블클릭하면 앞으로 꺼낸다
  tray.on('double-click', () => {
    if (!win.isVisible()) win.show()
    win.focus()
  })

  return tray
}

/** 설정 패널에서 값이 바뀌었을 때 트레이 체크 표시를 맞춘다 */
export function refreshTray(): void {
  rebuildMenu?.()
}

export function destroyTray(): void {
  tray?.destroy()
  tray = null
  rebuildMenu = null
}

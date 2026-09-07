import { app, BrowserWindow } from 'electron'
import { createWidgetWindow } from './window'
import { createTray, destroyTray } from './tray'
import { registerIpc } from './ipc'
import { load } from './store'
import { isPinAvailable } from './desktop-pin'

// 위젯이 여러 개 뜨면 안 된다.
// quit() 만으로는 ready 가 뜨는 걸 확실히 막지 못한다. 두 번째 인스턴스가
// 창을 하나 더 띄우면 store 캐시가 둘이 되어 서로의 data.json 을 덮어쓴다.
// 그래서 잠금을 못 얻으면 나머지를 아예 실행하지 않는다.
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) app.quit()

// Windows 에서 투명 창이 검게 렌더되는 GPU 경로를 피한다
app.commandLine.appendSwitch('enable-transparent-visuals')

let win: BrowserWindow | null = null

if (gotLock) {
app.on('second-instance', () => {
  if (win) {
    if (!win.isVisible()) win.show()
    win.focus()
  }
})

app.whenReady().then(() => {
  app.setAppUserModelId('io.github.badul13.calendar-widget')

  win = createWidgetWindow()
  registerIpc(win)
  createTray(win, () => {
    if (!win) return
    if (!win.isVisible()) win.show()
    win.focus()
    win.webContents.send('ui:open-settings')
  })

  // 저장된 자동 실행 설정을 OS 에 반영 (사용자가 OS 쪽에서 껐을 수도 있으므로)
  const { openAtLogin } = load().settings
  app.setLoginItemSettings({ openAtLogin })

  console.log(`[main] 바탕화면 고정: ${isPinAvailable() ? '사용 가능' : '사용 불가 (일반 창으로 동작)'}`)
})

// 트레이 상주 앱이므로 창이 닫혀도 종료하지 않는다
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', destroyTray)
}

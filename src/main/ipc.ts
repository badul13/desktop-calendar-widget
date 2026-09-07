import { app, BrowserWindow, ipcMain, screen } from 'electron'
import type { AppData, CalEvent, NewEvent, NewTodo, Note, Settings, Todo, WorkHours } from './store'
import { load, patch } from './store'
import { republishBackdrop } from './backdrop'
import { refreshTray } from './tray'
import { NOTES_WIDTH, WIDGET_MIN_WIDTH, type NoteColor } from '../shared/types'

/** 메모장을 펼치기 직전의 창 상태 — 접을 때 그대로 되돌리기 위해 기억한다 */
let preNotes: { x: number; width: number; expanded: number } | null = null

const uid = (): string => Math.random().toString(36).slice(2, 10) + Date.now().toString(36)

/** 변경된 상태를 렌더러로 밀어준다 */
function broadcast(win: BrowserWindow, data: AppData): void {
  if (!win.isDestroyed()) win.webContents.send('data:changed', data)
}

export function registerIpc(win: BrowserWindow): void {
  ipcMain.handle('data:get', () => load())

  /* ---- 일정 ---- */

  ipcMain.handle('event:create', (_e, input: NewEvent) => {
    const data = patch((d) => {
      d.events.push({ ...input, id: uid(), providerId: 'local' })
    })
    broadcast(win, data)
    return data
  })

  ipcMain.handle('event:update', (_e, next: CalEvent) => {
    const data = patch((d) => {
      const i = d.events.findIndex((x) => x.id === next.id)
      if (i >= 0) d.events[i] = { ...d.events[i], ...next }
    })
    broadcast(win, data)
    return data
  })

  ipcMain.handle('event:delete', (_e, id: string) => {
    const data = patch((d) => {
      d.events = d.events.filter((x) => x.id !== id)
    })
    broadcast(win, data)
    return data
  })

  /* ---- 할 일 ---- */

  ipcMain.handle('todo:create', (_e, input: NewTodo) => {
    const data = patch((d) => {
      d.todos.push({
        id: uid(),
        date: input.date,
        title: input.title,
        done: false,
        createdAt: new Date().toISOString()
      })
    })
    broadcast(win, data)
    return data
  })

  ipcMain.handle('todo:update', (_e, next: Todo) => {
    const data = patch((d) => {
      const i = d.todos.findIndex((x) => x.id === next.id)
      if (i >= 0) d.todos[i] = { ...d.todos[i], ...next }
    })
    broadcast(win, data)
    return data
  })

  ipcMain.handle('todo:delete', (_e, id: string) => {
    const data = patch((d) => {
      d.todos = d.todos.filter((x) => x.id !== id)
    })
    broadcast(win, data)
    return data
  })

  /* ---- 유연근무 시간 ---- */

  ipcMain.handle('workhours:set', (_e, date: string, hours: WorkHours | null) => {
    const data = patch((d) => {
      if (hours) d.workHours[date] = hours
      else delete d.workHours[date]
    })
    broadcast(win, data)
    return data
  })

  /* ---- 메모 ---- */

  ipcMain.handle('note:create', (_e, text: string) => {
    const now = new Date().toISOString()
    const data = patch((d) => {
      // 새 메모는 맨 위에 — 방금 적은 게 바로 보여야 한다
      d.notes.unshift({ id: uid(), text, createdAt: now, updatedAt: now })
    })
    broadcast(win, data)
    return data
  })

  ipcMain.handle('note:update', (_e, id: string, text: string) => {
    const data = patch((d) => {
      const n = d.notes.find((x) => x.id === id)
      if (n) {
        n.text = text
        n.updatedAt = new Date().toISOString()
      }
    })
    broadcast(win, data)
    return data
  })

  ipcMain.handle('note:recolor', (_e, id: string, color: NoteColor) => {
    const data = patch((d) => {
      const n = d.notes.find((x) => x.id === id)
      if (n) n.color = color
    })
    broadcast(win, data)
    return data
  })

  ipcMain.handle('note:delete', (_e, id: string) => {
    const data = patch((d) => {
      d.notes = d.notes.filter((x) => x.id !== id)
    })
    broadcast(win, data)
    return data
  })

  /* ---- 설정 ---- */

  ipcMain.handle('settings:update', async (_e, next: Partial<Settings>) => {
    const data = patch((d) => {
      d.settings = { ...d.settings, ...next }
    })
    broadcast(win, data)
    if ('backdropMode' in next) await republishBackdrop(win)
    // 자동 실행은 저장만 해선 안 되고 OS 에도 걸어야 한다
    if ('openAtLogin' in next) {
      app.setLoginItemSettings({ openAtLogin: data.settings.openAtLogin })
      refreshTray()
    }
    return data
  })

  ipcMain.handle('window:hide', () => win.hide())

  /**
   * 메모장을 펼칠 때 창을 그만큼 넓혀 준다. 달력을 줄이지 않으려는 것.
   * 화면에 자리가 없으면 넓히지 않고, 그때는 달력이 알아서 좁아진다.
   *
   * 접을 때 '폭에서 패널만큼 빼기' 로 계산하면 두 가지가 어긋난다:
   *  - 펼친 뒤 경계를 끌어 패널 폭을 바꿨으면 넣은 값과 빼는 값이 달라진다
   *  - 펼칠 때 오른쪽으로 넘쳐 x 를 왼쪽으로 당겼으면 그게 되돌아오지 않아,
   *    열고 닫기를 반복할수록 위젯이 왼쪽으로 계속 밀려난다
   * 그래서 펼치기 직전 상태를 기억했다가 그대로 되돌린다.
   */
  ipcMain.handle('window:notes', (_e, open: boolean, panelWidth?: number) => {
    if (win.isDestroyed()) return
    const b = win.getBounds()
    const area = screen.getDisplayMatching(b).workArea
    const panel = panelWidth && panelWidth > 0 ? panelWidth : NOTES_WIDTH

    const apply = (x: number, width: number): void => {
      const w = Math.max(WIDGET_MIN_WIDTH, Math.min(Math.round(width), area.width))
      const nx = Math.min(Math.max(Math.round(x), area.x), area.x + area.width - w)
      win.setBounds({ x: nx, y: b.y, width: w, height: b.height })
    }

    if (open) {
      preNotes = { x: b.x, width: b.width, expanded: 0 }
      apply(b.x, b.width + panel)
      preNotes.expanded = win.getBounds().width
      return
    }

    // 펼친 뒤 사용자가 창 크기를 직접 바꿨다면 기억해둔 값은 낡았다.
    // 그럴 땐 지금 폭에서 패널만큼 빼는 쪽이 낫다.
    if (preNotes && preNotes.expanded === b.width) apply(preNotes.x, preNotes.width)
    else apply(b.x, b.width - panel)
    preNotes = null
  })
}

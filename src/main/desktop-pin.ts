/**
 * 창을 바탕화면 레벨(다른 창들 뒤)에 고정한다. Windows 전용.
 *
 * 계획에서는 WS_EX_NOACTIVATE 도 함께 걸려고 했으나 실제로는 쓰지 않는다.
 * NOACTIVATE 가 걸린 창은 활성화 자체가 되지 않아 키보드 입력을 못 받는다.
 * 일정/할 일 제목을 타이핑해야 하므로 치명적이다.
 *
 * 대신:
 *  - WS_EX_TOOLWINDOW  → Alt+Tab 목록과 작업표시줄에서 제외
 *  - blur 시 HWND_BOTTOM → 포커스를 잃는 순간 다시 맨 뒤로 가라앉음
 *  - 주기 타이머로 재적용 → 다른 앱이 Z-order 를 흔들어도 복구
 *
 * 결과적으로 평소엔 바탕화면에 깔려 있고, 클릭하면 잠깐 앞으로 나와
 * 입력을 받은 뒤 다른 곳을 클릭하면 도로 가라앉는다.
 * (어차피 완전히 가려진 창은 클릭할 수도 없으므로 실사용상 문제되지 않는다)
 */
import { createRequire } from 'node:module'
import { BrowserWindow } from 'electron'

const require = createRequire(import.meta.url)

const HWND_BOTTOM = 1
const SWP_NOSIZE = 0x0001
const SWP_NOMOVE = 0x0002
const SWP_NOACTIVATE = 0x0010

const GWL_EXSTYLE = -20
const WS_EX_TOOLWINDOW = 0x00000080
const WS_EX_APPWINDOW = 0x00040000

const ENFORCE_INTERVAL_MS = 3000

type User32 = {
  SetWindowPos: (...a: unknown[]) => boolean
  GetWindowLongPtrW: (...a: unknown[]) => bigint | number
  SetWindowLongPtrW: (...a: unknown[]) => bigint | number
}

let user32: User32 | null = null
let loadError: string | null = null

function loadUser32(): User32 | null {
  if (user32 || loadError) return user32
  try {
    // koffi 는 네이티브 모듈이라 번들되지 않고 런타임에 require 된다 (ESM 이므로 createRequire)
    const koffi = require('koffi')
    const lib = koffi.load('user32.dll')
    user32 = {
      SetWindowPos: lib.func('__stdcall', 'SetWindowPos', 'bool', [
        'uintptr', 'uintptr', 'int', 'int', 'int', 'int', 'uint'
      ]),
      GetWindowLongPtrW: lib.func('__stdcall', 'GetWindowLongPtrW', 'intptr', ['uintptr', 'int']),
      SetWindowLongPtrW: lib.func('__stdcall', 'SetWindowLongPtrW', 'intptr', [
        'uintptr', 'int', 'intptr'
      ])
    }
  } catch (err) {
    loadError = String(err)
    console.error('[desktop-pin] user32.dll 로드 실패 — 바탕화면 고정 비활성화:', loadError)
  }
  return user32
}

function hwndOf(win: BrowserWindow): bigint | null {
  try {
    const buf = win.getNativeWindowHandle()
    return buf.length === 8 ? buf.readBigUInt64LE(0) : BigInt(buf.readUInt32LE(0))
  } catch {
    return null
  }
}

/** Z-order 최하단으로 내린다. 크기·위치·활성 상태는 건드리지 않는다. */
export function sinkToBottom(win: BrowserWindow): void {
  const u = loadUser32()
  if (!u || win.isDestroyed()) return
  const hwnd = hwndOf(win)
  if (hwnd === null) return
  u.SetWindowPos(hwnd, BigInt(HWND_BOTTOM), 0, 0, 0, 0, SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE)
}

/** Alt+Tab / 작업표시줄에서 창을 숨긴다. */
function applyToolWindowStyle(win: BrowserWindow): void {
  const u = loadUser32()
  if (!u || win.isDestroyed()) return
  const hwnd = hwndOf(win)
  if (hwnd === null) return
  const current = BigInt(u.GetWindowLongPtrW(hwnd, GWL_EXSTYLE))
  const next = (current | BigInt(WS_EX_TOOLWINDOW)) & ~BigInt(WS_EX_APPWINDOW)
  if (next !== current) u.SetWindowLongPtrW(hwnd, GWL_EXSTYLE, next)
}

/**
 * 창에 바탕화면 고정을 건다. 정리 함수를 돌려준다.
 * user32 로드에 실패하면 조용히 아무것도 하지 않는다 (창은 평범하게 동작).
 */
export function pinToDesktop(win: BrowserWindow): () => void {
  if (process.platform !== 'win32') return () => {}

  applyToolWindowStyle(win)
  sinkToBottom(win)

  const onBlur = (): void => sinkToBottom(win)
  win.on('blur', onBlur)
  win.on('show', onBlur)

  // 다른 앱이 Z-order 를 바꿔도 복구. 포커스 중일 땐 건드리지 않는다.
  const timer = setInterval(() => {
    if (win.isDestroyed() || win.isFocused() || !win.isVisible()) return
    sinkToBottom(win)
  }, ENFORCE_INTERVAL_MS)

  return () => {
    clearInterval(timer)
    if (!win.isDestroyed()) {
      win.off('blur', onBlur)
      win.off('show', onBlur)
    }
  }
}

export function isPinAvailable(): boolean {
  return process.platform === 'win32' && loadUser32() !== null
}

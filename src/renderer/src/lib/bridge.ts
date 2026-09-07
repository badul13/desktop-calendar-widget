/**
 * 렌더러가 데이터에 접근하는 유일한 통로.
 *
 * Electron 안에서는 preload 가 노출한 window.widget 을 그대로 쓰고,
 * 그냥 크롬에서 http://localhost:5173 을 열었을 때는 localStorage 기반
 * 목(mock)으로 대체한다. 덕분에 디자인을 브라우저에서 그대로 보면서
 * 다듬을 수 있다 (개발자 도구, 반응형 확인, 화면 공유 전부 가능).
 */
import {
  DEFAULT_DATA,
  type AppData,
  type Backdrop,
  type CalEvent,
  type NewEvent,
  type NewTodo,
  type Note,
  type NoteColor,
  type Settings,
  type Todo,
  type WorkHours
} from '@shared/types'

export const IS_ELECTRON = typeof window !== 'undefined' && 'widget' in window

const uid = (): string => Math.random().toString(36).slice(2, 10) + Date.now().toString(36)

export type Bridge = {
  getData(): Promise<AppData>
  createEvent(e: NewEvent): Promise<AppData>
  updateEvent(e: CalEvent): Promise<AppData>
  deleteEvent(id: string): Promise<AppData>
  createTodo(t: NewTodo): Promise<AppData>
  updateTodo(t: Todo): Promise<AppData>
  deleteTodo(id: string): Promise<AppData>
  setWorkHours(date: string, hours: WorkHours | null): Promise<AppData>
  createNote(text: string): Promise<AppData>
  updateNote(id: string, text: string): Promise<AppData>
  recolorNote(id: string, color: NoteColor): Promise<AppData>
  deleteNote(id: string): Promise<AppData>
  /** Electron 에서만 — 메모장을 펼칠 때 창 자체를 넓힌다 */
  setNotesWindow?(open: boolean, panelWidth?: number): Promise<void>
  updateSettings(s: Partial<Settings>): Promise<AppData>
  hideWindow(): Promise<void>
  onDataChanged(cb: (d: AppData) => void): () => void
  onOpenSettings(cb: () => void): () => void
  /** Electron 에서만 제공. 브라우저 미리보기에서는 BgSwitcher 가 대신 바꾼다. */
  onBackdropChanged?(cb: (v: Backdrop) => void): () => void
}

/* ---------- 브라우저 미리보기용 목 ---------- */

// 스키마가 바뀌면 키를 올려서 미리보기 시드를 다시 깐다
const MOCK_KEY = 'calendar-widget:preview:v3'
const mockListeners = new Set<(d: AppData) => void>()

const iso = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** 빈 달력은 디자인 확인이 안 되므로 이번 달에 샘플을 깔아준다 */
function seed(): AppData {
  const today = new Date()
  const shift = (n: number): string => {
    const d = new Date(today)
    d.setDate(d.getDate() + n)
    return iso(d)
  }
  const now = today.toISOString()

  return {
    ...structuredClone(DEFAULT_DATA),
    events: [
      { id: 'e1', providerId: 'local', date: iso(today), time: '14:00', title: '팀 회의' },
      { id: 'e2', providerId: 'local', date: iso(today), time: '19:00', title: '운동' },
      { id: 'e3', providerId: 'local', date: shift(1), time: '11:00', title: '스프린트 리뷰' },
      { id: 'e4', providerId: 'local', date: shift(2), time: null, title: '엄마 생신' },
      { id: 'e5', providerId: 'local', date: shift(3), time: '10:30', title: '치과' },
      { id: 'e6', providerId: 'local', date: shift(3), time: '15:00', title: '거래처 미팅' },
      { id: 'e7', providerId: 'local', date: shift(4), time: '18:30', title: '회식' },
      { id: 'e8', providerId: 'local', date: shift(-2), time: '09:00', title: '월간 보고' }
    ],
    todos: [
      { id: 't1', date: iso(today), title: '주간 보고서 제출', done: true, createdAt: now },
      { id: 't2', date: iso(today), title: '메일 회신', done: false, createdAt: now },
      { id: 't3', date: iso(today), title: '경비 정산', done: false, createdAt: now },
      { id: 't4', date: shift(1), title: 'API 문서 정리', done: false, createdAt: now },
      { id: 't5', date: shift(3), title: '견적서 검토', done: false, createdAt: now },
      { id: 't6', date: shift(-2), title: '휴가 신청', done: true, createdAt: now }
    ],
    notes: [
      {
        id: 'n1',
        text: ['배포 체크리스트', '- 스테이징 확인', '- 롤백 스크립트 준비', '- 공지 초안'].join(
          '\n'
        ),
        createdAt: now,
        updatedAt: now
      },
      { id: 'n2', text: '회의실 예약 코드: 4821', color: 'mint', createdAt: now, updatedAt: now }
    ],
    workHours: {
      [shift(-2)]: { start: '09:00', end: '18:00' },
      [iso(today)]: { start: '10:00', end: '19:00' },
      [shift(1)]: { start: '11:00', end: '20:00' },
      [shift(3)]: { start: '09:30', end: '18:30' },
      [shift(4)]: { start: '10:00', end: '17:00' }
    }
  }
}

function mockLoad(): AppData {
  try {
    const raw = localStorage.getItem(MOCK_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AppData>
      return {
        ...DEFAULT_DATA,
        ...parsed,
        settings: { ...DEFAULT_DATA.settings, ...(parsed.settings ?? {}) }
      }
    }
  } catch {
    /* 깨졌으면 시드로 되돌린다 */
  }
  const seeded = seed()
  localStorage.setItem(MOCK_KEY, JSON.stringify(seeded))
  return seeded
}

function mockPatch(fn: (d: AppData) => void): Promise<AppData> {
  const data = structuredClone(mockLoad())
  fn(data)
  localStorage.setItem(MOCK_KEY, JSON.stringify(data))
  mockListeners.forEach((cb) => cb(data))
  return Promise.resolve(data)
}

const mockBridge: Bridge = {
  getData: async () => mockLoad(),

  createEvent: (e) =>
    mockPatch((d) => {
      d.events.push({ ...e, id: uid(), providerId: 'local' })
    }),
  updateEvent: (next) =>
    mockPatch((d) => {
      const i = d.events.findIndex((x) => x.id === next.id)
      if (i >= 0) d.events[i] = next
    }),
  deleteEvent: (id) =>
    mockPatch((d) => {
      d.events = d.events.filter((x) => x.id !== id)
    }),

  createTodo: (t) =>
    mockPatch((d) => {
      d.todos.push({ ...t, id: uid(), done: false, createdAt: new Date().toISOString() })
    }),
  updateTodo: (next) =>
    mockPatch((d) => {
      const i = d.todos.findIndex((x) => x.id === next.id)
      if (i >= 0) d.todos[i] = next
    }),
  deleteTodo: (id) =>
    mockPatch((d) => {
      d.todos = d.todos.filter((x) => x.id !== id)
    }),

  setWorkHours: (date, hours) =>
    mockPatch((d) => {
      if (hours) d.workHours[date] = hours
      else delete d.workHours[date]
    }),

  createNote: (text) =>
    mockPatch((d) => {
      const now = new Date().toISOString()
      d.notes.unshift({ id: uid(), text, createdAt: now, updatedAt: now })
    }),
  updateNote: (id, text) =>
    mockPatch((d) => {
      const n = d.notes.find((x) => x.id === id)
      if (n) {
        n.text = text
        n.updatedAt = new Date().toISOString()
      }
    }),
  recolorNote: (id, color) =>
    mockPatch((d) => {
      const n = d.notes.find((x) => x.id === id)
      if (n) n.color = color
    }),
  deleteNote: (id) =>
    mockPatch((d) => {
      d.notes = d.notes.filter((x) => x.id !== id)
    }),

  updateSettings: (s) =>
    mockPatch((d) => {
      d.settings = { ...d.settings, ...s }
    }),

  hideWindow: async () => {
    /* 브라우저에선 숨길 창이 없다 */
  },
  onDataChanged: (cb) => {
    mockListeners.add(cb)
    return () => void mockListeners.delete(cb)
  },
  onOpenSettings: () => () => {}
  // onBackdropChanged 없음 — 브라우저에선 BgSwitcher 가 직접 data-backdrop 을 바꾼다
}

export const bridge: Bridge = IS_ELECTRON ? (window.widget as unknown as Bridge) : mockBridge

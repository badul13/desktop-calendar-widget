/** main 프로세스와 렌더러가 공유하는 데이터 모양 */

export type CalEvent = {
  id: string
  providerId: 'local' | 'google'
  /** yyyy-MM-dd */
  date: string
  /** HH:mm, 종일 일정이면 null */
  time: string | null
  title: string
  color?: string
}

export type Todo = {
  id: string
  /** yyyy-MM-dd — 날짜 칸에 같이 보여주기 위해 할 일도 날짜를 갖는다 */
  date: string
  title: string
  done: boolean
  createdAt: string
}

/** 유연근무제라 날마다 출퇴근 시간이 다르다. 날짜별로 따로 저장한다. */
export type WorkHours = {
  /** HH:mm */
  start: string
  /** HH:mm */
  end: string
}

/** 쪽지 배경색 템플릿. 값이 없으면 기본 노란 메모지. */
export const NOTE_COLORS = ['yellow', 'pink', 'mint', 'blue', 'lilac'] as const
export type NoteColor = (typeof NOTE_COLORS)[number]

/** 오른쪽 메모장의 쪽지 한 장. 날짜와 무관한 자유 메모. */
export type Note = {
  id: string
  text: string
  color?: NoteColor
  createdAt: string
  updatedAt: string
}

export type Backdrop = 'light' | 'dark'

export type Settings = {
  opacity: number
  /** 배경화면 밝기 자동 판정 / 수동 고정 */
  backdropMode: 'auto' | 'light' | 'dark'
  ddayLabel: string
  /** yyyy-MM-dd */
  ddayDate: string | null
  headerMode: 'clock' | 'dday'
  openAtLogin: boolean
  /** 새 날짜에 근무시간을 처음 넣을 때 채워둘 기본값 */
  defaultWorkHours: WorkHours
  /** 오른쪽 메모장을 펼쳐 둘지 */
  notesOpen: boolean
  /** 메모장 폭 (경계를 끌어 조절) */
  notesWidth: number
}

export type WindowBounds = {
  x: number
  y: number
  width: number
  height: number
} | null

export type AppData = {
  version: 3
  events: CalEvent[]
  todos: Todo[]
  /** yyyy-MM-dd → 그날의 근무시간 */
  workHours: Record<string, WorkHours>
  notes: Note[]
  settings: Settings
  windowBounds: WindowBounds
}

export const WIDGET_DEFAULT_WIDTH = 960
export const WIDGET_DEFAULT_HEIGHT = 800
export const WIDGET_MIN_WIDTH = 420
export const WIDGET_MIN_HEIGHT = 520
/** 메모장 기본 폭. 펼칠 때 창이 이만큼 넓어진다 (자리가 없으면 달력이 대신 줄어든다) */
export const NOTES_WIDTH = 280
export const NOTES_MIN_WIDTH = 200
export const NOTES_MAX_WIDTH = 560

export const DEFAULT_DATA: AppData = {
  version: 3,
  events: [],
  todos: [],
  workHours: {},
  notes: [],
  settings: {
    opacity: 0.92,
    backdropMode: 'auto',
    ddayLabel: 'D-day',
    ddayDate: null,
    headerMode: 'clock',
    openAtLogin: false,
    defaultWorkHours: { start: '10:00', end: '19:00' },
    notesOpen: false,
    notesWidth: NOTES_WIDTH
  },
  windowBounds: null
}

export type NewEvent = Omit<CalEvent, 'id' | 'providerId'>
export type NewTodo = Pick<Todo, 'date' | 'title'>

/** 달력 칸에서 클릭해 편집 중인 항목 */
export type EditTarget =
  | { kind: 'event'; item: CalEvent }
  | { kind: 'todo'; item: Todo }

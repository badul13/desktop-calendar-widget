/**
 * userData/data.json 에 위젯 상태를 저장한다.
 * 쓰기는 temp 파일 → rename 으로 원자적으로 처리해서,
 * 저장 도중 앱이 죽어도 기존 파일이 깨지지 않게 한다.
 */
import { app } from 'electron'
import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  writeFileSync
} from 'node:fs'
import { join } from 'node:path'
import { DEFAULT_DATA, type AppData, type Todo } from '../shared/types'

export type {
  AppData,
  CalEvent,
  NewEvent,
  NewTodo,
  Note,
  NoteColor,
  Settings,
  Todo,
  WorkHours
} from '../shared/types'

let cache: AppData | null = null

function dataPath(): string {
  const dir = app.getPath('userData')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return join(dir, 'data.json')
}

/**
 * 저장 파일 마이그레이션.
 *
 *  v1 → v2  할 일이 날짜를 갖게 되었다. 기존 할 일은 만든 날짜로 옮긴다
 *           (그래야 달력 칸 어딘가에는 나타난다).
 *  v2 → v3  오른쪽 메모장이 생겼다. 빈 배열만 채워주면 된다.
 *
 * 없는 필드는 전부 기본값으로 메우므로, 버전을 몰라도 안전하게 열린다.
 */
function migrate(parsed: Partial<AppData> & { version?: number }): AppData {
  const todos: Todo[] = (parsed.todos ?? []).map((t) => {
    const legacy = t as Todo & { date?: string }
    if (legacy.date) return legacy
    const created = legacy.createdAt ? new Date(legacy.createdAt) : new Date()
    const date = [
      created.getFullYear(),
      String(created.getMonth() + 1).padStart(2, '0'),
      String(created.getDate()).padStart(2, '0')
    ].join('-')
    return { ...legacy, date }
  })

  return {
    ...DEFAULT_DATA,
    ...parsed,
    version: 3,
    todos,
    events: parsed.events ?? [],
    workHours: parsed.workHours ?? {},
    notes: parsed.notes ?? [],
    settings: {
      ...DEFAULT_DATA.settings,
      ...(parsed.settings ?? {}),
      defaultWorkHours: {
        ...DEFAULT_DATA.settings.defaultWorkHours,
        ...(parsed.settings?.defaultWorkHours ?? {})
      }
    }
  }
}

export function load(): AppData {
  if (cache) return cache
  try {
    const parsed = JSON.parse(readFileSync(dataPath(), 'utf8')) as Partial<AppData>
    cache = migrate(parsed)
  } catch {
    // 파일이 없거나 깨졌으면 기본값으로 시작한다
    cache = structuredClone(DEFAULT_DATA)
  }
  return cache
}

export function save(next: AppData): void {
  const target = dataPath()
  const tmp = `${target}.tmp`
  const fd = openSync(tmp, 'w')
  try {
    writeFileSync(fd, JSON.stringify(next, null, 2), 'utf8')
    // rename 전에 실제로 디스크에 내려야 원자성이 성립한다.
    // 안 하면 전원이 끊겼을 때 이름만 바뀐 빈 파일이 남을 수 있다.
    fsyncSync(fd)
  } finally {
    closeSync(fd)
  }
  renameSync(tmp, target)
  // 쓰기가 끝난 뒤에 캐시를 바꾼다 — 실패하면 메모리와 디스크가 어긋나지 않게
  cache = next
}

export function patch(fn: (d: AppData) => void): AppData {
  const data = structuredClone(load())
  fn(data)
  save(data)
  return data
}

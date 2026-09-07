import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek
} from 'date-fns'
import { ko } from 'date-fns/locale'

/** 저장 키로 쓰는 날짜 형식. 로컬 시간대 기준이라 UTC 밀림이 없다. */
export const toKey = (d: Date): string => format(d, 'yyyy-MM-dd')

export const fromKey = (key: string): Date => {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

/** 달력 그리드에 들어갈 날짜들. 앞뒤 달의 남는 칸까지 포함해 7의 배수로 채운다. */
export function monthGrid(month: Date): Date[] {
  return eachDayOfInterval({
    start: startOfWeek(startOfMonth(month)),
    end: endOfWeek(endOfMonth(month))
  })
}

export function chunkWeeks(days: Date[]): Date[][] {
  const weeks: Date[][] = []
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7))
  return weeks
}

export const monthTitle = (d: Date): string => format(d, 'yyyy년 M월', { locale: ko })
export const dateLine = (d: Date): string => format(d, 'M월 d일 EEEE', { locale: ko })
export const listHeading = (d: Date): string => format(d, 'M월 d일 (EEEEE)', { locale: ko })

/** D-day. 오늘이 그날이면 0, 미래면 양수(남은 일수), 과거면 음수. */
export function daysUntil(target: Date, from: Date = new Date()): number {
  const a = startOfDay(from).getTime()
  const b = startOfDay(target).getTime()
  return Math.round((b - a) / 86_400_000)
}

export function ddayText(n: number): string {
  if (n === 0) return 'D-DAY'
  return n > 0 ? `D-${n}` : `D+${-n}`
}

export { addMonths, isSameDay, isSameMonth, startOfDay, format }

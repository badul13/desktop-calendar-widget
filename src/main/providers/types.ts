/**
 * 일정 공급자 인터페이스 — 구글 캘린더를 나중에 얹기 위한 확장 지점.
 *
 * 지금은 로컬 JSON 하나뿐이라 이 추상화가 실제로 쓰이지는 않는다.
 * 다만 나중에 붙일 때 UI 를 건드리지 않으려면 두 가지가 미리 있어야 한다:
 *   1. 렌더러가 항상 '기간으로 조회한 결과'만 그리는 구조   (App.tsx 가 그렇게 되어 있다)
 *   2. 일정마다 어디서 왔는지 표시하는 필드              (CalEvent.providerId)
 * 둘 다 갖춰져 있으므로, 구글을 붙일 때 할 일은
 * GoogleProvider 를 만들고 listEvents 결과를 로컬 것과 합치는 것뿐이다.
 *
 * 과하게 만들지 않는다 — 읽기 전용 공급자는 쓰기 메서드를 생략하면 된다.
 */
import type { CalEvent, NewEvent } from '../../shared/types'

export type ProviderId = CalEvent['providerId']

export interface CalendarProvider {
  readonly id: ProviderId

  /** [from, to] 구간에 걸친 일정. 날짜는 로컬 시간대의 yyyy-MM-dd 로 돌려준다. */
  listEvents(from: Date, to: Date): Promise<CalEvent[]>

  /* 읽기 전용 공급자(예: 구독한 공휴일 달력)는 아래를 구현하지 않는다.
     UI 는 메서드 유무로 편집 가능 여부를 판단하면 된다. */
  createEvent?(input: NewEvent): Promise<CalEvent>
  updateEvent?(next: CalEvent): Promise<CalEvent>
  deleteEvent?(id: string): Promise<void>
}

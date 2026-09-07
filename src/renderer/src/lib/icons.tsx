/** 위젯 크기가 작아서 아이콘 라이브러리를 통째로 넣지 않고 필요한 것만 직접 그린다. */

type P = { size?: number }

const base = (size: number): React.SVGProps<SVGSVGElement> => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const
})

export const ChevronLeft = ({ size = 15 }: P): React.JSX.Element => (
  <svg {...base(size)}>
    <path d="m15 18-6-6 6-6" />
  </svg>
)

export const ChevronRight = ({ size = 15 }: P): React.JSX.Element => (
  <svg {...base(size)}>
    <path d="m9 18 6-6-6-6" />
  </svg>
)

export const Plus = ({ size = 13 }: P): React.JSX.Element => (
  <svg {...base(size)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)

export const Close = ({ size = 12 }: P): React.JSX.Element => (
  <svg {...base(size)}>
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
)

export const Check = ({ size = 10 }: P): React.JSX.Element => (
  <svg {...base(size)} strokeWidth={3.2} stroke="#fff">
    <path d="M20 6 9 17l-5-5" />
  </svg>
)

export const Gear = ({ size = 15 }: P): React.JSX.Element => (
  <svg {...base(size)} strokeWidth={1.8}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
  </svg>
)

export const NoteIcon = ({ size = 15 }: P): React.JSX.Element => (
  <svg {...base(size)} strokeWidth={1.9}>
    <path d="M15.5 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5z" />
    <path d="M15 3v5h5M8 12h7M8 16h5" />
  </svg>
)

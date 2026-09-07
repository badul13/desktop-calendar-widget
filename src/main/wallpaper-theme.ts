/**
 * 위젯이 깔려 있는 자리의 배경화면 밝기를 재서 light / dark 를 정한다.
 *
 * 사용자가 배경화면을 자주 바꾸므로 고정 팔레트로는 대응이 안 된다.
 * 흰 유리 패널은 어두운 배경 위에서 회색 떡이 되고 글씨가 안 읽힌다.
 *
 * 동작:
 *  1. SystemParametersInfoW 로 현재 배경화면 파일 경로를 얻는다
 *     (레지스트리 reg.exe 는 한글 경로에서 코드페이지 문제가 나서 Win32 를 직접 부른다)
 *  2. nativeImage 로 열어 작게 리사이즈한 뒤,
 *  3. 위젯이 놓인 화면 위치에 대응하는 영역의 평균 휘도를 계산한다
 *     (WallpaperStyle=fill/fit/stretch 별로 매핑이 다르다)
 *
 * 배경화면이 없거나 읽기에 실패하면 light 로 둔다. 사용자가 설정에서 강제할 수도 있다.
 */
import { createRequire } from 'node:module'
import { execFile } from 'node:child_process'
import { statSync } from 'node:fs'
import { nativeImage, screen, type Display, type Rectangle } from 'electron'

const require = createRequire(import.meta.url)

export type Backdrop = 'light' | 'dark'

const SPI_GETDESKWALLPAPER = 0x0073
const MAX_PATH = 260

/** 밝기가 경계 근처일 때 값이 떨리지 않도록 히스테리시스를 둔다 */
const DARK_ENTER = 0.42
const DARK_EXIT = 0.52

/* ---------- 배경화면 경로 ---------- */

let getWallpaperPathNative: ((buf: Buffer) => boolean) | null = null

function loadSpi(): typeof getWallpaperPathNative {
  if (getWallpaperPathNative) return getWallpaperPathNative
  try {
    const koffi = require('koffi')
    const user32 = koffi.load('user32.dll')
    const fn = user32.func('__stdcall', 'SystemParametersInfoW', 'bool', [
      'uint', 'uint', 'void*', 'uint'
    ])
    getWallpaperPathNative = (buf: Buffer) => fn(SPI_GETDESKWALLPAPER, MAX_PATH, buf, 0)
  } catch {
    getWallpaperPathNative = null
  }
  return getWallpaperPathNative
}

export function wallpaperPath(): string | null {
  const spi = loadSpi()
  if (!spi) return null
  const buf = Buffer.alloc(MAX_PATH * 2)
  if (!spi(buf)) return null
  const s = buf.toString('utf16le')
  const end = s.indexOf('\0')
  const path = (end >= 0 ? s.slice(0, end) : s).trim()
  return path.length ? path : null
}

/** WallpaperStyle: 0=center, 2=stretch, 6=fit, 10=fill, 22=span */
let styleCache: { value: number; at: number } | null = null

function wallpaperStyle(): Promise<number> {
  if (styleCache && Date.now() - styleCache.at < 30_000) {
    return Promise.resolve(styleCache.value)
  }
  return new Promise((resolve) => {
    execFile(
      'reg',
      // 백슬래시는 반드시 두 번 써야 한다. 'HKCU\Control Panel' 로 쓰면
      // \C 와 \D 가 이스케이프로 먹혀 'HKCUControl PanelDesktop' 이 되고,
      // reg query 가 조용히 실패해 늘 기본값(10, fill)으로 떨어진다.
      ['query', 'HKCU\\Control Panel\\Desktop', '/v', 'WallpaperStyle'],
      { windowsHide: true },
      (err, stdout) => {
        // 숫자만 뽑으므로 코드페이지 영향이 없다
        const m = !err && /WallpaperStyle\s+REG_SZ\s+(\d+)/i.exec(stdout)
        const value = m ? Number(m[1]) : 10
        styleCache = { value, at: Date.now() }
        resolve(value)
      }
    )
  })
}

/* ---------- 이미지 샘플링 ---------- */

const SAMPLE_W = 192

type Sampled = { w: number; h: number; px: Buffer; srcW: number; srcH: number }
let imgCache: { key: string; data: Sampled } | null = null

function loadSample(path: string): Sampled | null {
  let key: string
  try {
    key = `${path}:${statSync(path).mtimeMs}`
  } catch {
    return null
  }
  if (imgCache?.key === key) return imgCache.data

  const img = nativeImage.createFromPath(path)
  if (img.isEmpty()) return null
  const { width: srcW, height: srcH } = img.getSize()
  if (!srcW || !srcH) return null

  // 휘도 평균만 필요하므로 작게 줄여서 읽는다 (원본 디코딩 비용 회피)
  const small = img.resize({ width: SAMPLE_W, quality: 'good' })
  const { width: w, height: h } = small.getSize()
  const data: Sampled = { w, h, px: small.toBitmap(), srcW, srcH }
  imgCache = { key, data }
  return data
}

/** sRGB 감마값 기준 지각 휘도. 정밀도보다 안정성이 중요한 용도라 이 정도면 충분하다. */
function luminanceOfRegion(s: Sampled, x0: number, y0: number, x1: number, y1: number): number {
  const cx0 = Math.max(0, Math.min(s.w - 1, Math.floor(x0 * s.w)))
  const cx1 = Math.max(cx0 + 1, Math.min(s.w, Math.ceil(x1 * s.w)))
  const cy0 = Math.max(0, Math.min(s.h - 1, Math.floor(y0 * s.h)))
  const cy1 = Math.max(cy0 + 1, Math.min(s.h, Math.ceil(y1 * s.h)))

  let sum = 0
  let n = 0
  for (let y = cy0; y < cy1; y++) {
    for (let x = cx0; x < cx1; x++) {
      const i = (y * s.w + x) * 4
      // toBitmap() 은 BGRA 순서
      const b = s.px[i]
      const g = s.px[i + 1]
      const r = s.px[i + 2]
      sum += (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
      n++
    }
  }
  return n ? sum / n : 0.5
}

/**
 * 화면 좌표계의 사각형을 배경화면 이미지의 0~1 좌표계로 옮긴다.
 * WallpaperStyle 에 따라 이미지가 어떻게 놓이는지가 달라진다.
 */
function mapToImage(
  s: Sampled,
  display: Display,
  rect: Rectangle,
  style: number
): { x0: number; y0: number; x1: number; y1: number } {
  const dw = display.bounds.width
  const dh = display.bounds.height
  // 위젯의 화면 내 상대 위치 (0~1)
  const rx0 = (rect.x - display.bounds.x) / dw
  const ry0 = (rect.y - display.bounds.y) / dh
  const rx1 = (rect.x - display.bounds.x + rect.width) / dw
  const ry1 = (rect.y - display.bounds.y + rect.height) / dh

  if (style === 2) {
    // stretch: 이미지가 화면에 그대로 늘어난다 → 상대 위치가 곧 이미지 좌표
    return { x0: rx0, y0: ry0, x1: rx1, y1: ry1 }
  }

  const imgAspect = s.srcW / s.srcH
  const scrAspect = dw / dh
  // fill(10): 화면을 덮도록 확대 후 잘림 / fit(6): 이미지 전체가 들어오도록 축소
  const cover = style !== 6
  const wider = cover ? imgAspect > scrAspect : imgAspect < scrAspect

  // 화면 좌표 → 이미지 좌표로 되돌리는 비율과 오프셋
  let sx: number, sy: number, ox: number, oy: number
  if (wider) {
    // 이미지의 좌우가 남거나 모자란다: 세로가 꽉 참
    sy = 1
    oy = 0
    sx = scrAspect / imgAspect
    ox = (1 - sx) / 2
  } else {
    sx = 1
    ox = 0
    sy = imgAspect / scrAspect
    oy = (1 - sy) / 2
  }
  return {
    x0: ox + rx0 * sx,
    y0: oy + ry0 * sy,
    x1: ox + rx1 * sx,
    y1: oy + ry1 * sy
  }
}

/* ---------- 공개 API ---------- */

let current: Backdrop = 'light'

/**
 * 주어진 창 영역 아래 배경화면의 밝기로 backdrop 을 판정한다.
 * 읽기에 실패하면 직전 값을 유지한다 (배경화면 전환 중 깜빡임 방지).
 */
export async function detectBackdrop(rect: Rectangle): Promise<Backdrop> {
  const path = wallpaperPath()
  if (!path) return current
  const sample = loadSample(path)
  if (!sample) return current

  const display = screen.getDisplayMatching(rect)
  const style = await wallpaperStyle()
  const region = mapToImage(sample, display, rect, style)
  const lum = luminanceOfRegion(sample, region.x0, region.y0, region.x1, region.y1)

  // 히스테리시스: 경계에서 왔다갔다 하지 않게
  if (current === 'light' && lum < DARK_ENTER) current = 'dark'
  else if (current === 'dark' && lum > DARK_EXIT) current = 'light'
  return current
}

export function currentBackdrop(): Backdrop {
  return current
}

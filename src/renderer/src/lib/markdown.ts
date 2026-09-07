/**
 * 메모를 마크다운으로 그린다.
 *
 * 파서를 직접 짜지 않는 이유: 이스케이프와 중첩 목록 처리는 생각보다 까다롭고,
 * 거기서 실수하면 붙여넣은 내용이 그대로 HTML 로 실행될 수 있다.
 * marked 로 파싱하고 DOMPurify 로 걸러서 innerHTML 에 넣는다.
 */
import DOMPurify from 'dompurify'
import { marked } from 'marked'

marked.setOptions({
  // 줄바꿈 하나를 <br> 로 — 메모는 산문보다 목록·메모지에 가까워서
  // 빈 줄을 두 번 넣어야 줄이 바뀌면 답답하다
  breaks: true,
  gfm: true
})

/** 링크는 전부 새 창으로 — Electron 쪽에서 기본 브라우저로 넘긴다 */
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noopener noreferrer')
  }
})

const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em', 'del', 'code', 'pre',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'input',
  'blockquote', 'hr', 'a',
  'table', 'thead', 'tbody', 'tr', 'th', 'td'
]

// 'disabled' 는 일부러 뺀다 — 비활성 입력은 클릭 이벤트를 아예 흘리지 않아서
// 체크박스를 눌러 원본을 바꿀 수가 없다 (marked 는 기본으로 disabled 를 붙인다)
const ALLOWED_ATTR = ['href', 'title', 'type', 'checked', 'target', 'rel']

/** 마크다운 → 안전한 HTML 문자열 */
export function renderMarkdown(src: string): string {
  const raw = marked.parse(src, { async: false })
  return DOMPurify.sanitize(raw, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    // javascript: 같은 위험한 스킴을 막는다
    ALLOWED_URI_REGEXP: /^(?:https?|mailto):/i,
    // 위 정규식은 href 뿐 아니라 type 에도 적용된다.
    // 그대로 두면 체크리스트의 type="checkbox" 가 URI 검사에 걸려 지워지고,
    // type 없는 input 은 텍스트 입력창으로 그려져 목록이 망가진다.
    ADD_URI_SAFE_ATTR: ['type']
  })
}

/** 미리보기가 의미 있는지 — 빈 메모는 그냥 안내 문구를 보여준다 */
export function isBlank(src: string): boolean {
  return src.trim().length === 0
}

/**
 * 원본 마크다운에서 index 번째 체크리스트 항목을 뒤집는다.
 *
 * 렌더된 체크박스를 눌렀을 때 쓴다. 화면의 몇 번째 체크박스인지만 알면 되는데,
 * marked 는 원본에 나온 순서대로 위에서 아래로 그리므로 순번이 그대로 대응된다.
 *
 * 지원하는 형태: '- [ ]', '* [x]', '+ [X]', '1. [ ]' (앞의 들여쓰기 포함)
 */
export function toggleTask(src: string, index: number): string {
  const lines = src.split('\n')
  const FENCE = /^\s*(?:```|~~~)/
  const TASK = /^([ \t]*(?:[-*+]|\d+[.)])[ \t]+)\[([ xX])\]/
  let n = 0
  let inFence = false

  for (let i = 0; i < lines.length; i++) {
    // 코드블록 안의 '- [ ]' 는 체크박스로 그려지지 않는다.
    // 세는 데 끼워 넣으면 화면 순번과 어긋나 엉뚱한 줄을 뒤집고 코드까지 망가뜨린다.
    if (FENCE.test(lines[i])) {
      inFence = !inFence
      continue
    }
    if (inFence) continue

    const m = TASK.exec(lines[i])
    if (!m) continue
    if (n++ !== index) continue

    lines[i] = `${m[1]}[${m[2] === ' ' ? 'x' : ' '}]${lines[i].slice(m[0].length)}`
    break
  }
  return lines.join('\n')
}

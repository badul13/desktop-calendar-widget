import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { IS_ELECTRON } from './lib/bridge'
import './styles/tokens.css'
import './styles/app.css'

// 브라우저 미리보기에선 배경화면 대용 그라데이션 위에 위젯을 띄운다
document.body.classList.add(IS_ELECTRON ? 'in-electron' : 'in-browser')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)

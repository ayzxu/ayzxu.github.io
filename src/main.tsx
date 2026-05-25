import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

// Pixel fonts — "Press Start 2P" for chrome/headings, "VT323" for body text
import '@fontsource/press-start-2p'
import '@fontsource/vt323'

import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)

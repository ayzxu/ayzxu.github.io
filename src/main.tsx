import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import 'overlayscrollbars/styles/overlayscrollbars.css'

import App from './App'
import { ThemeProvider } from './ThemeContext'
import "@fontsource/inter/400.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";

import lemonMilkLight from './assets/fonts/LEMONMILK-Light.otf?url'
import lemonMilkRegular from './assets/fonts/LEMONMILK-Regular.otf?url'
import cursorImage from './assets/cursor.png'

// Inject @font-face declarations once (not on every theme change)
const fontStyle = document.createElement('style')
fontStyle.id = 'custom-fonts'
fontStyle.textContent = `
  @font-face {
    font-family: 'LemonMilk';
    src: url('${lemonMilkLight}') format('opentype');
    font-weight: 300;
    font-style: normal;
    font-display: swap;
  }
  @font-face {
    font-family: 'LemonMilk';
    src: url('${lemonMilkRegular}') format('opentype');
    font-weight: normal;
    font-style: normal;
    font-display: swap;
  }
`
document.head.appendChild(fontStyle)

let cachedInvertedCursor: string | null = null

function createInvertedCursor(imageUrl: string): Promise<string> {
  if (cachedInvertedCursor) return Promise.resolve(cachedInvertedCursor)
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(img, 0, 0)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const data = imageData.data
        for (let i = 0; i < data.length; i += 4) {
          data[i] = 255 - data[i]
          data[i + 1] = 255 - data[i + 1]
          data[i + 2] = 255 - data[i + 2]
        }
        ctx.putImageData(imageData, 0, 0)
        cachedInvertedCursor = canvas.toDataURL()
        resolve(cachedInvertedCursor)
      } else {
        resolve(imageUrl)
      }
    }
    img.onerror = () => resolve(imageUrl)
    img.src = imageUrl
  })
}

async function setCursor() {
  const isDark = document.documentElement.classList.contains('dark')
  const cursorUrl = isDark ? cursorImage : await createInvertedCursor(cursorImage)

  let style = document.getElementById('custom-cursor-style') as HTMLStyleElement | null
  if (!style) {
    style = document.createElement('style')
    style.id = 'custom-cursor-style'
    document.head.appendChild(style)
  }
  style.textContent = `html, body, * { cursor: url('${cursorUrl}'), auto !important; }`
}

setCursor()

const observer = new MutationObserver(() => { setCursor() })
observer.observe(document.documentElement, {
  attributes: true,
  attributeFilter: ['class']
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
)

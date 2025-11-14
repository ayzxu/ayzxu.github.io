import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import 'overlayscrollbars/styles/overlayscrollbars.css'

import App from './App'
import "@fontsource/inter/400.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";

// Import Lemon Milk fonts for Vite to process
import lemonMilkLight from './assets/fonts/LEMONMILK-Light.otf?url'
import lemonMilkRegular from './assets/fonts/LEMONMILK-Regular.otf?url'
import cursorImage from './assets/cursor.png'

// Function to create inverted cursor
function createInvertedCursor(imageUrl: string): Promise<string> {
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
        
        // Invert colors
        for (let i = 0; i < data.length; i += 4) {
          data[i] = 255 - data[i]     // R
          data[i + 1] = 255 - data[i + 1] // G
          data[i + 2] = 255 - data[i + 2] // B
          // Alpha channel stays the same
        }
        
        ctx.putImageData(imageData, 0, 0)
        resolve(canvas.toDataURL())
      } else {
        resolve(imageUrl)
      }
    }
    img.onerror = () => resolve(imageUrl)
    img.src = imageUrl
  })
}

// Set cursor based on theme
async function setCursor() {
  const isDark = document.documentElement.classList.contains('dark')
  let cursorUrl = cursorImage
  
  if (!isDark) {
    // Invert cursor for light theme
    cursorUrl = await createInvertedCursor(cursorImage)
  }
  
  const style = document.createElement('style')
  style.id = 'custom-cursor-style'
  style.textContent = `
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
    html, body, * {
      cursor: url('${cursorUrl}'), auto !important;
    }
  `
  
  // Remove old style if exists
  const oldStyle = document.getElementById('custom-cursor-style')
  if (oldStyle) oldStyle.remove()
  
  document.head.appendChild(style)
}

// Set initial cursor
setCursor()

// Watch for theme changes
const observer = new MutationObserver(() => {
  setCursor()
})

observer.observe(document.documentElement, {
  attributes: true,
  attributeFilter: ['class']
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)

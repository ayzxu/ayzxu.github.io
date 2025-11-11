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

// Inject font URLs as CSS variables
const style = document.createElement('style')
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
`
document.head.appendChild(style)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

import App from './App.tsx'
import "@fontsource/inter/400.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";


createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

const user = localStorage.getItem('theme') // 'dark' | 'light' | null
const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
if (user ? user === 'dark' : systemPrefersDark) {
  document.documentElement.classList.add('dark')
} else {
  document.documentElement.classList.remove('dark')
}

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
  const saved = localStorage.getItem('theme')
  if (saved) return
  document.documentElement.classList.toggle('dark', e.matches)
})

export function toggleTheme() {
  const el = document.documentElement
  const next = el.classList.toggle('dark') ? 'dark' : 'light'
  localStorage.setItem('theme', next)
}



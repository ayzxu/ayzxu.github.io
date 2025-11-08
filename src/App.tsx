import { useEffect, useState } from 'react'

interface Card {
  title: string
  desc: string
}

export default function App() {
  const [dark, setDark] = useState<boolean>(false)

  // load saved theme
  useEffect(() => {
    const saved = localStorage.getItem('theme')
    const isDark = saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches
    setDark(isDark)
    document.documentElement.classList.toggle('dark', isDark)
  }, [])

  const toggleTheme = (): void => {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
  }

  const cards: Card[] = [
    { title: 'Projects', desc: 'Selected work in AI, infra, and analytics.' },
    { title: 'Writing', desc: 'Essays, case studies, and teaching notes.' },
    { title: 'Talks', desc: 'Boards, pitches, and workshops.' },
    { title: 'Contact', desc: 'Freelance, collaborations, coffee.' },
  ]

  return (
    <div className="min-h-screen transition-colors duration-300
                    bg-beige-gradient text-beige-text
                    dark:bg-ai-gradient dark:text-white">
      <header className="max-w-5xl mx-auto px-6 py-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">andyxu</h1>
        <button
          onClick={toggleTheme}
          className="rounded-2xl px-4 py-2 border border-black/10 dark:border-white/10
                     bg-white/60 dark:bg-ai-surface/80 backdrop-blur
                     hover:scale-[1.02] active:scale-[0.98] transition"
        >
          {dark ? 'Light' : 'pp'} mode
        </button>
      </header>

      <main className="max-w-5xl mx-auto px-6 pb-24">
        <section className="rounded-2xl p-8 md:p-12 shadow-lg
                            bg-beige-surface/70 dark:bg-ai-surface/70"
                 style={{ borderRadius: 'var(--card-radius)', boxShadow: 'var(--shadow-soft)' }}>
          <h2 className="text-3xl md:text-4xl font-bold mb-3">Hello, I'm Andy.</h2>
          <p className="opacity-90 leading-relaxed">
            CMU senior • Business + CS • builder of AI products and slick tooling.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href="https://github.com/ayzxu" target="_blank" rel="noreferrer"
               className="rounded-xl px-4 py-2 bg-black text-white dark:bg-white dark:text-black">
              GitHub
            </a>
            <a href="https://www.linkedin.com/in/andy-xu-/" target="_blank" rel="noreferrer"
               className="rounded-xl px-4 py-2 border border-black/10 dark:border-white/15">
              LinkedIn
            </a>
            <a href="mailto:andyyxu@cmu.edu"
               className="rounded-xl px-4 py-2 border border-black/10 dark:border-white/15">
              Email
            </a>
          </div>
        </section>

        <section className="mt-10 grid gap-6 md:grid-cols-2">
          {cards.map((c) => (
            <div key={c.title}
                 className="rounded-2xl p-6 bg-white/70 dark:bg-ai-surface/70 border border-black/5 dark:border-white/10
                            hover:translate-y-[-2px] transition"
                 style={{ boxShadow: 'var(--shadow-soft)' }}>
              <h3 className="text-xl font-semibold mb-1">{c.title}</h3>
              <p className="opacity-80">{c.desc}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="max-w-5xl mx-auto px-6 pb-10 opacity-70">
        <p>© {new Date().getFullYear()} Andy Xu</p>
      </footer>
    </div>
  )
}


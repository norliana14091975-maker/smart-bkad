'use client'

import { useEffect, useRef, useState } from 'react'
import { Bot, RotateCcw, Send, Sparkles, X } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

/** Usulan pertanyaan cepat saat percakapan masih kosong. */
const SUGGESTIONS = [
  'Bagaimana realisasi pendapatan dan belanja tahun ini?',
  'OPD mana yang serapan belanjanya terendah?',
  'Apa saja risiko utama keuangan daerah saat ini?',
  'Buatkan ringkasan singkat untuk rapat pimpinan.',
]

/** Maksimal riwayat yang dikirim ke server (hemat token). */
const MAX_HISTORY = 16

/**
 * Render teks jawaban AI: dukung **tebal** dan baris baru (jawaban lain
 * ditampilkan apa adanya, aman dari injeksi HTML).
 */
function renderRichText(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={i} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      )
    }
    return <span key={i}>{part}</span>
  })
}

/**
 * Widget AI Copilot — tombol melayang kanan bawah + panel percakapan.
 * HANYA dirender untuk pengguna dengan peran admin / kepala_daerah
 * (kondisi diperiksa di page.tsx). Percakapan tersimpan di memori komponen.
 */
export function CopilotWidget() {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  // Tutup panel dengan tombol Escape
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // Gulir otomatis ke pesan terbaru
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, sending, open])

  async function send(text: string) {
    const content = text.trim()
    if (!content || sending) return

    const next: ChatMessage[] = [...messages, { role: 'user', content }]
    setMessages(next)
    setInput('')
    setSending(true)
    try {
      const res = await fetch('/api/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next.slice(-MAX_HISTORY) }),
      })
      const json = (await res.json()) as { data?: { reply: string }; error?: string }
      if (!res.ok || !json.data) {
        throw new Error(json.error ?? 'Copilot gagal menjawab')
      }
      setMessages((prev) => [...prev, { role: 'assistant', content: json.data!.reply }])
    } catch (err) {
      toast({
        title: 'AI Copilot',
        description: String(err instanceof Error ? err.message : err),
        variant: 'destructive',
      })
      // Pesan pengguna tetap; pengguna bisa mencoba lagi
    } finally {
      setSending(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    send(input)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send(input)
    }
  }

  const empty = messages.length === 0

  return (
    <>
      {/* Tombol melayang */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Tutup AI Copilot' : 'Buka AI Copilot'}
        aria-expanded={open}
        className="fixed bottom-5 right-5 z-50 flex h-13 w-13 items-center justify-center rounded-full bg-[#17408b] text-white shadow-lg shadow-[#17408b]/30 transition-transform hover:scale-105 hover:bg-[#12326e] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#17408b] sm:bottom-6 sm:right-6"
        style={{ height: 52, width: 52 }}
      >
        {open ? (
          <X className="h-6 w-6" aria-hidden="true" />
        ) : (
          <span className="relative flex items-center justify-center">
            <Bot className="h-6 w-6" aria-hidden="true" />
            <span
              className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[9px] font-bold text-[#1b2a4a]"
              aria-hidden="true"
            >
              AI
            </span>
          </span>
        )}
      </button>

      {/* Panel percakapan */}
      {open && (
        <div
          role="dialog"
          aria-label="Percakapan AI Copilot"
          className="fixed bottom-22 right-4 z-50 flex h-[min(560px,calc(100dvh-8rem))] w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border bg-card shadow-2xl sm:bottom-24 sm:right-6 sm:w-96"
        >
          {/* Kepala panel */}
          <div className="flex items-center gap-2.5 border-b bg-[#17408b] px-4 py-3 text-white">
            <Sparkles className="h-5 w-5 shrink-0 text-amber-300" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold leading-tight">AI Copilot</p>
              <p className="truncate text-[11px] text-slate-200">
                Asisten analisis keuangan daerah
              </p>
            </div>
            <button
              type="button"
              onClick={() => setMessages([])}
              disabled={sending || empty}
              aria-label="Mulai percakapan baru"
              title="Mulai percakapan baru"
              className="rounded-md p-1.5 text-slate-200 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-40"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Tutup panel"
              className="rounded-md p-1.5 text-slate-200 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {/* Daftar pesan */}
          <div
            ref={listRef}
            role="log"
            aria-live="polite"
            aria-label="Riwayat percakapan"
            className="nice-scrollbar flex-1 space-y-3 overflow-y-auto bg-[#f4f6f8] p-3"
          >
            {empty ? (
              <div className="space-y-3 pt-4">
                <div className="rounded-lg border bg-white p-3 text-sm text-muted-foreground">
                  <p className="font-semibold text-foreground">Selamat datang 👋</p>
                  <p className="mt-1">
                    Saya dapat menjawab pertanyaan tentang realisasi APBD, kinerja
                    OPD/SKPD, hingga menyusun ringkasan untuk pimpinan — berdasarkan
                    data LRA terimport.
                  </p>
                </div>
                <p className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Coba tanyakan:
                </p>
                <div className="flex flex-col gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      disabled={sending}
                      className="rounded-lg border bg-white p-2.5 text-left text-sm text-foreground shadow-sm transition-colors hover:border-[#17408b]/40 hover:bg-[#17408b]/5 disabled:opacity-50"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m, i) => (
                <div
                  key={i}
                  className={cn(
                    'max-w-[88%] whitespace-pre-wrap rounded-lg p-2.5 text-sm leading-relaxed',
                    m.role === 'user'
                      ? 'ml-auto bg-[#17408b] text-white'
                      : 'mr-auto border bg-white text-foreground shadow-sm'
                  )}
                >
                  {m.role === 'assistant' ? renderRichText(m.content) : m.content}
                </div>
              ))
            )}

            {sending && (
              <div className="mr-auto flex items-center gap-1.5 rounded-lg border bg-white p-3 shadow-sm">
                <span className="h-2 w-2 animate-bounce rounded-full bg-[#17408b]/60 [animation-delay:-0.3s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-[#17408b]/60 [animation-delay:-0.15s]" />
                <span className="h-2 w-2 animate-bounce rounded-full bg-[#17408b]/60" />
                <span className="sr-only">Copilot sedang mengetik</span>
              </div>
            )}
          </div>

          {/* Area input */}
          <form onSubmit={handleSubmit} className="border-t bg-white p-3">
            <div className="flex items-end gap-2">
              <label htmlFor="copilot-input" className="sr-only">
                Tulis pertanyaan untuk AI Copilot
              </label>
              <textarea
                id="copilot-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={Math.min(3, Math.max(1, input.split('\n').length))}
                placeholder="Tulis pertanyaan… (Enter kirim, Shift+Enter baris baru)"
                disabled={sending}
                maxLength={4000}
                className="nice-scrollbar max-h-24 flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#17408b]/40 disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={sending || !input.trim()}
                aria-label="Kirim pesan"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#17408b] text-white transition-colors hover:bg-[#12326e] disabled:opacity-40"
              >
                <Send className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <p className="mt-1.5 text-[10px] text-muted-foreground">
              Jawaban dihasilkan AI berdasarkan data LRA terimport — periksa angka
              penting sebelum dipakai dalam keputusan resmi.
            </p>
          </form>
        </div>
      )}
    </>
  )
}

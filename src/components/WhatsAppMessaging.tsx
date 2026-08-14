import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { CalendarClock, ContactRound, FileAudio, FileText, Image, LoaderCircle, MessageCircleMore, Plus, Send, Trash2, Upload, Video } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

interface WhatsAppMessagingProps {
  page: string
}

const pageConfig: Record<string, { title: string; description: string; icon: typeof MessageCircleMore }> = {
  "bot-send-chat": {
    title: "Send Chat",
    description: "Hantar mesej kepada individu atau group WhatsApp.",
    icon: MessageCircleMore,
  },
  "bot-schedule-chat": {
    title: "Schedule Chat",
    description: "Plan and manage scheduled WhatsApp conversations.",
    icon: CalendarClock,
  },
  "bot-delete-message": {
    title: "Deleted Messages",
    description: "Rekod mesej yang dipadam untuk semua orang.",
    icon: Trash2,
  },
  "bot-contact": {
    title: "Contact",
    description: "Manage WhatsApp contacts and related details.",
    icon: ContactRound,
  },
}

type DeletedMessage = {
  id: string
  chatJid: string
  senderJid: string
  fromMe: boolean
  timestamp: string
  deletedAt: string
  text: string
  mediaType: string | null
  fileName: string | null
  mimetype: string | null
  mediaPath: string | null
}

function getMediaType(file: File): 'image' | 'video' | 'audio' | 'document' {
  if (file.type.startsWith('image/')) return 'image'
  if (file.type.startsWith('video/')) return 'video'
  if (file.type.startsWith('audio/')) return 'audio'
  return 'document'
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ms-MY', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

export function WhatsAppMessaging({ page }: WhatsAppMessagingProps) {
  const config = pageConfig[page] ?? pageConfig["bot-send-chat"]
  const Icon = config.icon

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-4 p-4 md:p-6">
      <div className="rounded-2xl border border-border/70 bg-card/90 p-4 md:p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <Icon className="size-5 text-emerald-500" />
          <h1 className="text-lg md:text-xl font-bold">{config.title}</h1>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{config.description}</p>
      </div>

      {page === "bot-send-chat" ? <SendChat /> : page === "bot-delete-message" ? <DeletedMessages /> : (
        <div className="rounded-lg border border-border/70 bg-card/90 p-4 md:p-5 shadow-sm">
          <p className="text-sm text-muted-foreground">Fungsi ini akan tersedia pada halaman seterusnya.</p>
        </div>
      )}
    </div>
  )
}

function useDashboardToken() {
  return useMemo(() => new URLSearchParams(window.location.search).get('token')?.trim() || '', [])
}

export type InteractiveButtonType = 'cta_url' | 'pdf_url' | 'cta_copy' | 'quick_reply' | 'button_call' | 'send_whatsapp' | 'single_select'

export const INTERACTIVE_BUTTON_TYPES: { value: InteractiveButtonType; label: string; helper: string }[] = [
  { value: 'cta_url', label: 'CTA URL', helper: 'Buka link website.' },
  { value: 'pdf_url', label: 'PDF URL', helper: 'Buka fail PDF.' },
  { value: 'cta_copy', label: 'Copy', helper: 'Salin teks.' },
  { value: 'quick_reply', label: 'Quick Reply', helper: 'Isi command / payload.' },
  { value: 'button_call', label: 'Call', helper: 'Nombor telefon.' },
  { value: 'send_whatsapp', label: 'WhatsApp', helper: 'Link WhatsApp.' },
  { value: 'single_select', label: 'Single Select', helper: 'Isi pilihan command.' },
]

export function getDefaultButtonValueHint(type: InteractiveButtonType): string {
  switch (type) {
    case 'cta_url':
      return 'https://example.com'
    case 'pdf_url':
      return 'https://example.com/file.pdf'
    case 'cta_copy':
      return 'PROMO2026'
    case 'quick_reply':
      return 'command_key'
    case 'button_call':
      return '+60123456789'
    case 'send_whatsapp':
      return '60123456789'
    case 'single_select':
      return 'option_key'
    default:
      return ''
  }
}

type InteractiveButton = {
  id: string
  type: InteractiveButtonType
  label: string
  value: string
}

function createInteractiveButton(type: InteractiveButtonType = 'quick_reply'): InteractiveButton {
  return {
    id: `button_${Math.random().toString(36).slice(2, 8)}`,
    type,
    label: '',
    value: '',
  }
}

function SendChat() {
  const token = useDashboardToken()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [recipientType, setRecipientType] = useState<'personal' | 'group'>('personal')
  const [recipient, setRecipient] = useState('')
  const [text, setText] = useState('')
  const [interactiveButtons, setInteractiveButtons] = useState<InteractiveButton[]>([])
  const [file, setFile] = useState<File | null>(null)
  const [voiceNote, setVoiceNote] = useState(false)
  const [sending, setSending] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)

  const addInteractiveButton = useCallback(() => {
    setInteractiveButtons((prev) => {
      if (prev.length >= 3) return prev
      return [...prev, createInteractiveButton('quick_reply')]
    })
  }, [])

  const updateInteractiveButton = useCallback((buttonId: string, patch: Partial<InteractiveButton>) => {
    setInteractiveButtons((prev) => prev.map((button) => (button.id === buttonId ? { ...button, ...patch } : button)))
  }, [])

  const getButtonValueHintText = useCallback((button: InteractiveButton) => {
    return `Contoh: ${getDefaultButtonValueHint(button.type) || 'nilai untuk jenis button ini'}`
  }, [])

  const removeInteractiveButton = useCallback((buttonId: string) => {
    setInteractiveButtons((prev) => {
      if (prev.length <= 1) return prev
      return prev.filter((button) => button.id !== buttonId)
    })
  }, [])

  const sendMessage = useCallback(async () => {
    if (!recipient.trim()) return setFeedback('Sila isi penerima.')
    if (!text.trim() && !file) return setFeedback('Sila isi teks atau pilih fail.')
    if (file && file.size > 7 * 1024 * 1024) return setFeedback('Saiz fail maksimum ialah 7MB.')
    try {
      setSending(true)
      setFeedback(null)
      const media = file ? await new Promise<{ data: string; type: string; mimetype: string; fileName: string; ptt: boolean }>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve({ data: String(reader.result), type: getMediaType(file), mimetype: file.type, fileName: file.name, ptt: voiceNote })
        reader.onerror = () => reject(new Error('Gagal baca fail'))
        reader.readAsDataURL(file)
      }) : undefined
      const buttons = interactiveButtons
        .filter((button) => button.label.trim() && button.value.trim())
        .map((button) => ({ label: button.label.trim(), id: button.value.trim() }))
      const response = await fetch(token ? `/api/bot/messages?token=${encodeURIComponent(token)}` : '/api/bot/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { 'x-bot-dashboard-token': token } : {}) },
        body: JSON.stringify({ recipient, recipientType, text, media, buttons }),
      })
      const payload = await response.json()
      if (!response.ok || !payload?.success) throw new Error(payload?.error || 'Gagal hantar mesej')
      setFeedback('Mesej berjaya dihantar.')
      setText('')
      setInteractiveButtons([])
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Gagal hantar mesej')
    } finally {
      setSending(false)
    }
  }, [file, interactiveButtons, recipient, recipientType, text, token, voiceNote])

  return <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
    <section className="rounded-lg border border-border/70 bg-card p-4 shadow-sm md:p-5">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5"><Label htmlFor="recipient-type">Jenis penerima</Label><Select value={recipientType} onValueChange={(value) => setRecipientType(value as 'personal' | 'group')}><SelectTrigger id="recipient-type"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="personal">Personal</SelectItem><SelectItem value="group">Group</SelectItem></SelectContent></Select></div>
        <div className="space-y-1.5"><Label htmlFor="recipient">{recipientType === 'group' ? 'Group ID' : 'Nombor telefon'}</Label><Input id="recipient" value={recipient} onChange={(event) => setRecipient(event.target.value)} placeholder={recipientType === 'group' ? '1234567890-123456789@g.us' : '60123456789'} /></div>
      </div>
      <div className="mt-4 space-y-1.5"><Label htmlFor="message-text">Mesej</Label><Textarea id="message-text" value={text} onChange={(event) => setText(event.target.value)} placeholder="Tulis mesej anda" className="min-h-32" /></div>
      <div className="mt-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <Label>Butang interaktif</Label>
          <Button type="button" variant="outline" size="sm" onClick={addInteractiveButton} disabled={interactiveButtons.length >= 3} className="gap-1.5">
            <Plus className="size-3.5" /> Tambah button
          </Button>
        </div>

        {interactiveButtons.length === 0 ? (
          <p className="text-[11px] text-muted-foreground">Tiada button. Klik “Tambah button” jika mahu tambah interaksi.</p>
        ) : null}

        <div className="space-y-3">
          {interactiveButtons.map((button, index) => (
            <div key={button.id} className="rounded-xl border border-border/70 bg-muted/25 p-3 shadow-sm">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Button {index + 1}</p>
                {interactiveButtons.length > 1 ? (
                  <Button type="button" variant="ghost" size="icon" className="size-8 text-muted-foreground" onClick={() => removeInteractiveButton(button.id)}>
                    <Trash2 className="size-4" />
                  </Button>
                ) : null}
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor={`button-type-${button.id}`}>Jenis button</Label>
                  <Select value={button.type} onValueChange={(value) => updateInteractiveButton(button.id, {
                    type: value as InteractiveButtonType,
                    value: '',
                  })}>
                    <SelectTrigger id={`button-type-${button.id}`}>
                      <SelectValue placeholder="Pilih jenis" />
                    </SelectTrigger>
                    <SelectContent>
                      {INTERACTIVE_BUTTON_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`button-label-${button.id}`}>Nama button</Label>
                  <Input id={`button-label-${button.id}`} value={button.label} onChange={(event) => updateInteractiveButton(button.id, { label: event.target.value })} placeholder="Contoh: Lihat Info" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`button-value-${button.id}`}>Isi data / command</Label>
                  <Input
                    id={`button-value-${button.id}`}
                    value={button.value}
                    onChange={(event) => updateInteractiveButton(button.id, { value: event.target.value })}
                    placeholder=""
                    className="placeholder:text-transparent"
                  />
                  <p className="text-[10px] text-muted-foreground/80">
                    {getButtonValueHintText(button)}
                  </p>
                </div>
              </div>
              <p className="mt-2 text-[10px] text-muted-foreground">
                {button.type === 'quick_reply' || button.type === 'single_select' ? 'Untuk quick reply / single select, isi command payload di field ketiga.' : INTERACTIVE_BUTTON_TYPES.find((item) => item.value === button.type)?.helper}
              </p>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3"><Input ref={fileInputRef} className="hidden" id="message-file" type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /><Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}><Upload className="size-4" /> Pilih fail</Button>{file ? <span className="text-sm text-muted-foreground">{file.name} ({Math.ceil(file.size / 1024)} KB)</span> : <span className="text-sm text-muted-foreground">Imej, video, audio, voice note atau dokumen (maks. 7MB)</span>}{file && getMediaType(file) === 'audio' ? <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={voiceNote} onChange={(event) => setVoiceNote(event.target.checked)} /> Voice note</label> : null}</div>
      {feedback ? <p className="mt-4 text-sm text-muted-foreground" role="status">{feedback}</p> : null}
      <div className="mt-5 flex justify-end"><Button type="button" onClick={() => void sendMessage()} disabled={sending}>{sending ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}{sending ? 'Menghantar' : 'Hantar mesej'}</Button></div>
    </section>
    <aside className="rounded-lg border border-border/70 bg-muted/20 p-4 text-sm text-muted-foreground shadow-sm"><p className="font-medium text-foreground">Sasaran penghantaran</p><p className="mt-2">Personal menerima nombor dengan format antarabangsa, contohnya 60123456789.</p><p className="mt-3">Group memerlukan Group ID WhatsApp penuh yang berakhir dengan @g.us.</p><p className="mt-3">Untuk media, butang dihantar sebagai mesej interaktif selepas fail.</p></aside>
  </div>
}

function DeletedMessages() {
  const token = useDashboardToken()
  const [messages, setMessages] = useState<DeletedMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const loadMessages = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(token ? `/api/bot/deleted-messages?token=${encodeURIComponent(token)}` : '/api/bot/deleted-messages', { headers: token ? { 'x-bot-dashboard-token': token } : undefined })
      const payload = await response.json()
      if (!response.ok || !payload?.success) throw new Error(payload?.error || 'Gagal ambil rekod mesej')
      setMessages(payload.data)
      setError(null)
    } catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Gagal ambil rekod mesej') } finally { setLoading(false) }
  }, [token])
  useEffect(() => { void loadMessages() }, [loadMessages])
  const mediaUrl = (message: DeletedMessage) => message.mediaPath ? `${token ? `/api/bot/deleted-messages/media/${encodeURIComponent(message.mediaPath)}?token=${encodeURIComponent(token)}` : `/api/bot/deleted-messages/media/${encodeURIComponent(message.mediaPath)}`}` : null
  if (loading) return <div className="rounded-lg border border-border/70 bg-card p-5 text-sm text-muted-foreground">Memuatkan rekod...</div>
  if (error) return <div className="rounded-lg border border-destructive/40 bg-card p-5 text-sm text-destructive">{error}</div>
  if (!messages.length) return <div className="rounded-lg border border-border/70 bg-card p-5 text-sm text-muted-foreground">Belum ada mesej yang dipadam direkodkan.</div>
  return <div className="space-y-3">{messages.map((message) => { const url = mediaUrl(message); return <article key={`${message.chatJid}-${message.id}`} className="rounded-lg border border-border/70 bg-card p-4 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-medium">{message.senderJid || 'Tidak diketahui'} {message.fromMe ? '(bot)' : ''}</p><p className="text-xs text-muted-foreground">Dipadam {formatDate(message.deletedAt)}</p></div><p className="mt-1 text-xs text-muted-foreground break-all">{message.chatJid}</p>{message.text ? <p className="mt-3 whitespace-pre-wrap text-sm">{message.text}</p> : null}{url && message.mediaType === 'image' ? <img src={url} alt={message.fileName || 'Media dipadam'} className="mt-3 max-h-80 rounded-md border" /> : null}{url && (message.mediaType === 'audio' || message.mediaType === 'video') ? <div className="mt-3">{message.mediaType === 'audio' ? <FileAudio className="mb-1 size-4 text-muted-foreground" /> : <Video className="mb-1 size-4 text-muted-foreground" />}{message.mediaType === 'audio' ? <audio controls src={url} /> : <video controls src={url} className="max-h-80 rounded-md" />}</div> : null}{url && !['image', 'audio', 'video'].includes(message.mediaType || '') ? <a href={url} download={message.fileName || undefined} className="mt-3 inline-flex items-center gap-2 text-sm text-primary hover:underline"><FileText className="size-4" />{message.fileName || 'Muat turun fail arkib'}</a> : null}{message.mediaType && !url ? <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><Image className="size-4" />{message.fileName || `${message.mediaType} telah direkodkan, tetapi fail tidak dapat diarkibkan.`}</p> : null}</article> })}</div>
}

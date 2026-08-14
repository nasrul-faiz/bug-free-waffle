import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MessageCircle, QrCode, RefreshCw, ShieldAlert, Wifi, Phone, Smartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useRegisterRefresh } from '@/contexts/RefreshContext'

type BotStatus = 'disabled' | 'starting' | 'qr' | 'pairing-phone' | 'pairing-code' | 'connected' | 'closed' | 'reconnecting' | 'logged-out' | 'error'

type BotStatePayload = {
  enabled: boolean
  status: BotStatus
  qr: string | null
  pairingMethod: 'qr' | 'phone' | null
  pairingPhoneNumber: string | null
  pairingCode: string | null
  updatedAt: string | null
  lastError: string | null
}

const QR_REFRESH_SECONDS = 20

const STATUS_LABEL: Record<BotStatus, string> = {
  disabled: 'Disabled',
  starting: 'Starting',
  qr: 'Waiting QR Scan',
  'pairing-phone': 'Pairing Phone',
  'pairing-code': 'Pairing Code Ready',
  connected: 'Connected',
  closed: 'Connection Closed',
  reconnecting: 'Reconnecting',
  'logged-out': 'Logged Out',
  error: 'Error',
}

function statusClass(status: BotStatus): string {
  if (status === 'connected') return 'text-emerald-600 dark:text-emerald-400'
  if (status === 'error' || status === 'logged-out') return 'text-red-600 dark:text-red-400'
  return 'text-amber-600 dark:text-amber-400'
}

export function BotDashboard() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [state, setState] = useState<BotStatePayload | null>(null)
  const [qrCountdownSecondsLeft, setQrCountdownSecondsLeft] = useState(QR_REFRESH_SECONDS)
  const [pairingMethod, setPairingMethod] = useState<'qr' | 'phone'>('qr')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [applyingPairing, setApplyingPairing] = useState(false)
  const [pairingMessage, setPairingMessage] = useState<string | null>(null)
  const qrValueRef = useRef<string | null>(null)

  const token = useMemo(() => {
    const value = new URLSearchParams(window.location.search).get('token')
    return value?.trim() || ''
  }, [])

  const fetchStatus = useCallback(async () => {
    const endpoints = ['/bot/status', '/api/bot-status']
    let lastError = 'Failed to fetch bot status'

    try {
      setError(null)

      for (const endpoint of endpoints) {
        const target = token ? `${endpoint}?token=${encodeURIComponent(token)}` : endpoint
        try {
          const response = await fetch(target, {
            headers: token ? { 'x-bot-dashboard-token': token } : undefined,
          })

          const contentType = response.headers.get('content-type') || ''
          const payload = contentType.includes('application/json')
            ? await response.json()
            : { success: false, error: await response.text() }

          if (!response.ok || !payload?.success || !payload?.data) {
            const errorText = payload?.error || `Server returned ${response.status}`
            lastError = errorText
            continue
          }

          const nextState = payload.data as BotStatePayload
          setState(nextState)
          if (nextState.pairingMethod === 'qr' || nextState.pairingMethod === 'phone') {
            setPairingMethod(nextState.pairingMethod)
          }
          if (nextState.pairingPhoneNumber) {
            setPhoneNumber(nextState.pairingPhoneNumber)
          }
          setError(null)
          return
        } catch (err) {
          lastError = err instanceof Error ? err.message : 'Failed to fetch bot status'
        }
      }

      setError(lastError)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch bot status'
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [token])

  useRegisterRefresh(fetchStatus)

  useEffect(() => {
    void fetchStatus()
    const timer = window.setInterval(() => {
      void fetchStatus()
    }, 1500)
    return () => window.clearInterval(timer)
  }, [fetchStatus])

  const qrImageUrl = useMemo(() => {
    if (!state?.qr) return null
    return `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(state.qr)}`
  }, [state?.qr])

  const isPhonePairing = state?.pairingMethod === 'phone' || state?.status === 'pairing-phone' || state?.status === 'pairing-code'

  const applyPairingSelection = useCallback(async () => {
    if (pairingMethod === 'phone' && !phoneNumber.trim()) {
      setPairingMessage('Sila masukkan nombor telefon sebelum teruskan.')
      return
    }

    try {
      setApplyingPairing(true)
      setPairingMessage(null)
      const endpoint = '/api/bot/pairing'
      const target = token ? `${endpoint}?token=${encodeURIComponent(token)}` : endpoint
      const response = await fetch(target, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'x-bot-dashboard-token': token } : {}),
        },
        body: JSON.stringify({
          pairingMethod,
          phoneNumber: phoneNumber.trim(),
        }),
      })

      const contentType = response.headers.get('content-type') || ''
      const payload = contentType.includes('application/json')
        ? await response.json()
        : { success: false, error: await response.text() }

      if (!response.ok || payload?.success !== true) {
        throw new Error(payload?.error || 'Gagal apply pilihan pairing')
      }

      setPairingMessage(pairingMethod === 'phone' ? 'Kaedah phone number disimpan.' : 'Kaedah QR disimpan.')
      await fetchStatus()
    } catch (err) {
      setPairingMessage(err instanceof Error ? err.message : 'Gagal apply pilihan pairing')
    } finally {
      setApplyingPairing(false)
    }
  }, [fetchStatus, pairingMethod, phoneNumber, token])

  useEffect(() => {
    const isQrMode = state?.status === 'qr' && Boolean(state?.qr) && !isPhonePairing

    if (!isQrMode) {
      qrValueRef.current = null
      setQrCountdownSecondsLeft(QR_REFRESH_SECONDS)
      return
    }

    const currentQr = state?.qr ?? null
    if (currentQr && currentQr !== qrValueRef.current) {
      qrValueRef.current = currentQr
      setQrCountdownSecondsLeft(QR_REFRESH_SECONDS)
    }

    const countdownTimer = window.setInterval(() => {
      setQrCountdownSecondsLeft((prev) => {
        if (prev <= 1) {
          return QR_REFRESH_SECONDS
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      window.clearInterval(countdownTimer)
    }
  }, [state?.status, state?.qr, isPhonePairing])

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-3 p-3 md:p-4 lg:p-5">
      <div className="rounded-2xl border border-border/70 bg-card/90 p-3 md:p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:gap-0 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <h1 className="text-base md:text-lg font-bold flex items-center gap-2">
              <MessageCircle className="size-4.5 text-primary" />
              Account
            </h1>
            <p className="mt-1 text-[11px] md:text-xs text-muted-foreground">
              Manage your WhatsApp account connection.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => void fetchStatus()} className="gap-1.5 shrink-0 h-8 px-2.5 text-[11px]">
            <RefreshCw className="size-3.5" /> Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[320px_minmax(0,1fr)] gap-3">
        <div className="rounded-2xl border border-border/70 bg-card/90 p-3 md:p-4 flex flex-col gap-2.5 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Pairing</p>
          <div className="rounded-xl border border-dashed border-border bg-muted/25 min-h-[280px] flex items-center justify-center p-2.5">
            {loading ? (
              <p className="text-xs text-muted-foreground">Loading bot status...</p>
            ) : error ? (
              <div className="text-center px-3">
                <ShieldAlert className="size-7 text-red-500 mx-auto mb-2" />
                <p className="text-[11px] font-semibold text-red-600 dark:text-red-400">Tidak dapat ambil status bot</p>
                <p className="text-[10px] text-muted-foreground mt-1 break-words">{error}</p>
              </div>
            ) : state?.status === 'connected' ? (
              <div className="text-center px-3">
                <Wifi className="size-7 text-emerald-600 dark:text-emerald-400 mx-auto mb-2 animate-pulse" style={{ animationDuration: '2.8s' }} />
                <p className="text-sm font-semibold">Bot sudah connected</p>
                <p className="text-[10px] text-muted-foreground mt-1">QR tak diperlukan selagi sesi masih aktif.</p>
                {state.pairingMethod ? (
                  <p className="mt-2 text-[10px] text-muted-foreground">Paired via: {state.pairingMethod === 'phone' ? 'Phone number' : 'QR code'}</p>
                ) : null}
              </div>
            ) : state?.status === 'pairing-code' && state.pairingCode ? (
              <div className="text-center px-3 w-full">
                <Phone className="size-7 text-primary/80 mx-auto mb-2" />
                <p className="text-sm font-semibold">Phone pairing ready</p>
                <p className="text-[10px] text-muted-foreground mt-1">Masukkan code ini dalam WhatsApp &gt; Linked Devices &gt; Link with phone number.</p>
                <code className="mt-2 block rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono tracking-[0.2em] break-all">
                  {state.pairingCode}
                </code>
                {state.pairingPhoneNumber ? (
                  <p className="mt-2 text-[10px] text-muted-foreground">Nombor: {state.pairingPhoneNumber}</p>
                ) : null}
              </div>
            ) : state?.status === 'pairing-phone' ? (
              <div className="text-center px-3">
                <Phone className="size-7 text-primary/80 mx-auto mb-2" />
                <p className="text-sm font-semibold">Menjana pairing code...</p>
                <p className="text-[10px] text-muted-foreground mt-1">Tunggu seketika, bot sedang minta code daripada WhatsApp.</p>
                {state.pairingPhoneNumber ? (
                  <p className="mt-2 text-[10px] text-muted-foreground">Nombor: {state.pairingPhoneNumber}</p>
                ) : null}
              </div>
            ) : qrImageUrl && !isPhonePairing ? (
              <div className="text-center px-3">
                <img src={qrImageUrl} alt="WhatsApp QR" className="w-[240px] h-[240px] max-w-full max-h-full rounded-lg bg-white p-2 mx-auto" />
                <p className="mt-2 text-[10px] text-muted-foreground">QR akan refresh automatik dalam {qrCountdownSecondsLeft}s.</p>
              </div>
            ) : (
              <div className="text-center px-3">
                <QrCode className="size-7 text-muted-foreground/60 mx-auto mb-2" />
                <p className="text-sm font-semibold">QR belum tersedia</p>
                <p className="text-[10px] text-muted-foreground mt-1">Pastikan ENABLE_WHATSAPP_BOT=true dan server telah restart.</p>
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card/90 p-3 md:p-4 flex flex-col gap-2.5 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Connection Status</p>

          <div className="rounded-xl border border-border bg-background px-3 py-2">
            <p className={`text-sm font-bold ${state ? statusClass(state.status) : 'text-muted-foreground'}`}>
              {state ? STATUS_LABEL[state.status] : 'Unknown'}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">Updated: {state?.updatedAt ? new Date(state.updatedAt).toLocaleString() : '-'}</p>
            <p className="text-[10px] text-muted-foreground">Enabled: {state?.enabled ? 'Yes' : 'No'}</p>
            <p className="text-[10px] text-muted-foreground">Last error: {state?.lastError ?? '-'}</p>
          </div>

          <div className="rounded-xl border border-primary/20 bg-primary/10 px-3 py-2">
            <p className="text-[10px] font-semibold text-primary">Cara pair bot</p>
            <ol className="mt-1 text-[10px] text-muted-foreground list-decimal pl-4 space-y-0.5">
              <li>Pilih QR untuk scan kod terus.</li>
              <li>Pilih phone number untuk dapat pairing code.</li>
              <li>QR guna Linked Devices &gt; Link a Device.</li>
              <li>Phone guna Linked Devices &gt; Link with phone number.</li>
            </ol>
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setPairingMethod('qr')}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] transition-colors ${pairingMethod === 'qr' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground'}`}
              >
                <QrCode className="size-3.5" /> QR
              </button>
              <button
                type="button"
                onClick={() => setPairingMethod('phone')}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] transition-colors ${pairingMethod === 'phone' ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground'}`}
              >
                <Smartphone className="size-3.5" /> Phone number
              </button>
            </div>

            {pairingMethod === 'phone' ? (
              <div className="mt-2 space-y-1.5">
                <label className="text-[10px] text-muted-foreground">Nombor telefon</label>
                <Input
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="Contoh: 60123456789"
                  className="h-8 text-[11px]"
                />
                <p className="text-[10px] text-muted-foreground">Masukkan nombor tanpa + atau space.</p>
              </div>
            ) : null}

            <Button
              type="button"
              size="sm"
              className="mt-2 h-8 px-2.5 text-[11px]"
              onClick={() => void applyPairingSelection()}
              disabled={applyingPairing}
            >
              {applyingPairing ? 'Memproses…' : 'Apply selection'}
            </Button>

            {pairingMessage ? (
              <p className="mt-2 text-[10px] text-muted-foreground">{pairingMessage}</p>
            ) : null}
          </div>


        </div>
      </div>
    </div>
  )
}

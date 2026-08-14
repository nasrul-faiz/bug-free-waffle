import { useCallback, useEffect, useMemo, useState } from "react"
import { Cog, ShieldCheck, Link2, MessageSquareText, Users, UserRound, HelpCircle } from "lucide-react"
import { Switch } from "@/components/ui/switch"

type MessageBehaviorSettings = {
  respondInGroup: boolean
  respondInPrivate: boolean
  respondForAnyone: boolean
  autoRespondUnknownCommand: boolean
  unknownCommandInPrivate: boolean
  unknownCommandInGroup: boolean
}

const DEFAULT_SETTINGS: MessageBehaviorSettings = {
  respondInGroup: true,
  respondInPrivate: true,
  respondForAnyone: true,
  autoRespondUnknownCommand: true,
  unknownCommandInPrivate: true,
  unknownCommandInGroup: true,
}

export function BotSettings() {
  const [settings, setSettings] = useState<MessageBehaviorSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState<keyof MessageBehaviorSettings | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  const token = useMemo(() => {
    const value = new URLSearchParams(window.location.search).get("token")
    return value?.trim() || ""
  }, [])

  const requestWithFallback = useCallback(async (method: "GET" | "POST", payload?: MessageBehaviorSettings) => {
    const endpoints = ["/bot/settings", "/api/bot-settings"]
    let lastError = "Failed to update bot settings"

    for (const endpoint of endpoints) {
      const target = token ? `${endpoint}?token=${encodeURIComponent(token)}` : endpoint
      try {
        const response = await fetch(target, {
          method,
          headers: {
            ...(token ? { "x-bot-dashboard-token": token } : {}),
            ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
          },
          body: method === "POST" ? JSON.stringify({ messageBehavior: payload }) : undefined,
        })

        const contentType = response.headers.get("content-type") || ""
        const data = contentType.includes("application/json")
          ? await response.json()
          : { success: false, error: await response.text() }

        if (!response.ok || !data?.success || !data?.data?.messageBehavior) {
          lastError = data?.error || `Server returned ${response.status}`
          continue
        }

        return data.data.messageBehavior as MessageBehaviorSettings
      } catch (err) {
        lastError = err instanceof Error ? err.message : "Failed to update bot settings"
      }
    }

    throw new Error(lastError)
  }, [token])

  const fetchSettings = useCallback(async () => {
    try {
      setError(null)
      const loaded = await requestWithFallback("GET")
      setSettings({
        respondInGroup: loaded.respondInGroup !== false,
        respondInPrivate: loaded.respondInPrivate !== false,
        respondForAnyone: loaded.respondForAnyone !== false,
        autoRespondUnknownCommand: loaded.autoRespondUnknownCommand !== false,
        unknownCommandInPrivate: loaded.unknownCommandInPrivate !== false,
        unknownCommandInGroup: loaded.unknownCommandInGroup !== false,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal dapatkan bot settings")
    } finally {
      setLoading(false)
    }
  }, [requestWithFallback])

  useEffect(() => {
    void fetchSettings()
  }, [fetchSettings])

  const updateSetting = useCallback(async (key: keyof MessageBehaviorSettings, checked: boolean) => {
    const previous = settings
    const next = { ...settings, [key]: checked }
    setSettings(next)
    setSavingKey(key)
    setError(null)

    try {
      const saved = await requestWithFallback("POST", next)
      setSettings({
        respondInGroup: saved.respondInGroup !== false,
        respondInPrivate: saved.respondInPrivate !== false,
        respondForAnyone: saved.respondForAnyone !== false,
        autoRespondUnknownCommand: saved.autoRespondUnknownCommand !== false,
        unknownCommandInPrivate: saved.unknownCommandInPrivate !== false,
        unknownCommandInGroup: saved.unknownCommandInGroup !== false,
      })
      setSavedAt(Date.now())
    } catch (err) {
      setSettings(previous)
      setError(err instanceof Error ? err.message : "Gagal simpan bot settings")
    } finally {
      setSavingKey(null)
    }
  }, [requestWithFallback, settings])

  const settingRows: Array<{ key: keyof MessageBehaviorSettings; title: string; desc: string; icon: typeof Users }> = [
    {
      key: "respondInGroup",
      title: "Bot respond di group",
      desc: "ON: bot boleh balas mesej dalam group WhatsApp.",
      icon: Users,
    },
    {
      key: "respondInPrivate",
      title: "Bot respond di private chat",
      desc: "ON: bot balas mesej direct/personal chat.",
      icon: UserRound,
    },
    {
      key: "respondForAnyone",
      title: "Bot respond for anyone",
      desc: "OFF: hanya nombor dalam ALLOWED_NUMBERS boleh trigger bot.",
      icon: MessageSquareText,
    },
    {
      key: "autoRespondUnknownCommand",
      title: "Auto respond unknown command",
      desc: "ON: bot balas 'command not found'. OFF: bot diam untuk command tak wujud.",
      icon: HelpCircle,
    },
  ]

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-4 p-4 md:p-6">
      <div className="rounded-2xl border border-border/70 bg-card/90 p-4 md:p-5 shadow-sm">
        <h1 className="text-lg md:text-xl font-bold flex items-center gap-2">
          <Cog className="size-5 text-primary" />
          Bot Settings
        </h1>
        <p className="mt-1 text-xs md:text-sm text-muted-foreground">
          Manage WhatsApp bot behavior with simple ON/OFF switches.
        </p>
      </div>

      <div className="rounded-2xl border border-border/70 bg-card/90 p-4 md:p-5 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Behavior Switches</p>
          {loading ? <span className="text-[11px] text-muted-foreground">Loading...</span> : null}
          {!loading && savingKey ? <span className="text-[11px] text-muted-foreground">Saving...</span> : null}
          {!loading && !savingKey && savedAt ? <span className="text-[11px] text-emerald-600 dark:text-emerald-400">Saved</span> : null}
        </div>

        <div className="mt-3 divide-y divide-border/60 rounded-xl border border-border/60 bg-background/60">
          {settingRows.map((item) => {
            const Icon = item.icon
            const disabled = loading || savingKey !== null

            if (item.key === "autoRespondUnknownCommand") {
              return (
                <div key={item.key} className="px-3 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold flex items-center gap-2">
                        <Icon className="size-4 text-primary/80 shrink-0" />
                        {item.title}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">{item.desc}</p>
                    </div>
                    <Switch
                      size="sm"
                      checked={settings[item.key]}
                      disabled={disabled}
                      onCheckedChange={(checked) => {
                        void updateSetting(item.key, checked)
                      }}
                    />
                  </div>

                  {settings.autoRespondUnknownCommand ? (
                    <div className="mt-3 ml-6 space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[11px] font-medium text-muted-foreground">Personal chat</p>
                        <Switch
                          size="sm"
                          checked={settings.unknownCommandInPrivate}
                          disabled={disabled}
                          onCheckedChange={(checked) => {
                            void updateSetting("unknownCommandInPrivate", checked)
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[11px] font-medium text-muted-foreground">Group</p>
                        <Switch
                          size="sm"
                          checked={settings.unknownCommandInGroup}
                          disabled={disabled}
                          onCheckedChange={(checked) => {
                            void updateSetting("unknownCommandInGroup", checked)
                          }}
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              )
            }

            return (
              <div key={item.key} className="flex items-start justify-between gap-3 px-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold flex items-center gap-2">
                    <Icon className="size-4 text-primary/80 shrink-0" />
                    {item.title}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{item.desc}</p>
                </div>
                <Switch
                  size="sm"
                  checked={settings[item.key]}
                  disabled={disabled}
                  onCheckedChange={(checked) => {
                    void updateSetting(item.key, checked)
                  }}
                />
              </div>
            )
          })}
        </div>

        {error ? (
          <p className="mt-3 text-xs text-red-600 dark:text-red-400">{error}</p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-border/70 bg-card/90 p-4 md:p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Connection</p>
          <p className="mt-2 text-sm font-semibold flex items-center gap-2">
            <Link2 className="size-4 text-primary/80" />
            Base URL and token
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Ensure APP_BASE_URL, dashboard token, and BOT_PAIRING_METHOD are valid before pairing devices.
          </p>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card/90 p-4 md:p-5 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Security</p>
          <p className="mt-2 text-sm font-semibold flex items-center gap-2">
            <ShieldCheck className="size-4 text-primary/80" />
            Session persistence
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Keep AUTH_DIR persisted and rotate tokens when moving environments.
          </p>
        </div>
      </div>
    </div>
  )
}

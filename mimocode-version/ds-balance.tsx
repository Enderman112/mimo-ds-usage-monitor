/** @jsxImportSource @opentui/solid */

import type { JSX } from "@opentui/solid"
import type {
  TuiPlugin,
  TuiPluginApi,
  TuiSlotContext,
  TuiSlotPlugin,
  TuiPluginModule,
  TuiThemeCurrent,
} from "@mimo-ai/plugin/tui"
import { createSignal, createMemo, Show, onMount, onCleanup } from "solid-js"

// ── helpers ──

function visualWidth(s: string): number {
  let w = 0
  for (const c of s) {
    const code = c.codePointAt(0) ?? 0
    if (code >= 0x1100 && code <= 0x115F) w += 2
    else if (code >= 0x2E80 && code <= 0xA4CF) w += 2
    else if (code >= 0xAC00 && code <= 0xD7A3) w += 2
    else if (code >= 0xF900 && code <= 0xFAFF) w += 2
    else if (code >= 0xFE10 && code <= 0xFE6F) w += 2
    else if (code >= 0xFF01 && code <= 0xFF60) w += 2
    else if (code >= 0xFFE0 && code <= 0xFFE6) w += 2
    else if (code >= 0x20000 && code <= 0x3FFFD) w += 2
    else w += 1
  }
  return w
}

// ── types ──

interface BalanceInfo {
  currency: string
  total_balance: string
  granted_balance: string
  topped_up_balance: string
}

interface BalanceData {
  is_available: boolean
  balance_infos: BalanceInfo[]
}

// ── API ──

async function fetchBalance(apiKey: string): Promise<{ data?: BalanceData; error?: string }> {
  try {
    const res = await fetch("https://api.deepseek.com/user/balance", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    })
    if (!res.ok) return { error: `HTTP ${res.status}` }
    const json = await res.json()
    return { data: json }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "网络错误" }
  }
}

// ── colors ──

const FALLBACK = {
  primary: "#8B9DAF",
  text:    "#C5C5BB",
  muted:   "#7A7A72",
  success: "#9CAF8B",
  warning: "#C5B88D",
  error:   "#B08A8A",
  border:  "#6B6B63",
}

const MAX_SAT = 0.28

function rgb(raw: unknown): { r: number; g: number; b: number } | null {
  if (typeof raw === "string" && raw.startsWith("#")) {
    const h = raw.slice(1)
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) }
  }
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>
    if (typeof o.r === "number" && typeof o.g === "number" && typeof o.b === "number") {
      const scale = o.r > 1 || o.g > 1 || o.b > 1 ? 1 : 255
      return { r: Math.round(o.r * scale), g: Math.round(o.g * scale), b: Math.round(o.b * scale) }
    }
  }
  return null
}

function saturation(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b) / 255
  const min = Math.min(r, g, b) / 255
  const delta = max - min
  if (delta === 0) return 0
  const L = (max + min) / 2
  return L <= 0.5 ? delta / (max + min) : delta / (2 - max - min)
}

function desaturateTo(raw: unknown, maxSat: number, fallback: string): string {
  const c = rgb(raw)
  if (!c) return fallback
  const sat = saturation(c.r, c.g, c.b)
  if (sat <= maxSat) return "#" + [c.r, c.g, c.b].map((v) => v.toString(16).padStart(2, "0")).join("")
  const luma = c.r * 0.299 + c.g * 0.587 + c.b * 0.114
  let lo = 0, hi = 1
  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) / 2
    const nr = Math.round(c.r + (luma - c.r) * mid)
    const ng = Math.round(c.g + (luma - c.g) * mid)
    const nb = Math.round(c.b + (luma - c.b) * mid)
    if (saturation(nr, ng, nb) > maxSat) lo = mid
    else hi = mid
  }
  const nr = Math.round(c.r + (luma - c.r) * hi)
  const ng = Math.round(c.g + (luma - c.g) * hi)
  const nb = Math.round(c.b + (luma - c.b) * hi)
  return "#" + [nr, ng, nb].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join("")
}

// ── provider check ──

function isDeepSeekProvider(api: TuiPluginApi, sessionId: string): boolean {
  try {
    const msgs = api.state.session.messages(sessionId)
    for (let i = msgs.length - 1; i >= 0; i--) {
      const msg = msgs[i] as any
      if (msg.role === "assistant" && msg.providerID) {
        const pid = String(msg.providerID).toLowerCase()
        if (pid.includes("deepseek")) return true
        return false
      }
    }
    for (const p of api.state.provider) {
      const pid = String(p.id).toLowerCase()
      if (pid.includes("deepseek")) return true
    }
  } catch {}
  return false
}

// ── panel component ──

function DSBalancePanel(props: {
  theme: TuiThemeCurrent
  api: TuiPluginApi
  sessionId: string
}): JSX.Element {
  const [open, setOpen] = createSignal(true)
  const [data, setData] = createSignal<BalanceData | null>(null)
  const [error, setError] = createSignal<string | null>(null)
  const [loading, setLoading] = createSignal(false)
  const [panelWidth, setPanelWidth] = createSignal(26)
  let boxEl: any

  const isDS = createMemo(() => isDeepSeekProvider(props.api, props.sessionId))
  if (!isDS()) return null

  const KV_PREFIX = "ds"
  const API_KEY_KEY = `${KV_PREFIX}.apikey`

  const pal = createMemo(() => {
    const t = props.theme as Record<string, unknown>
    const sat = (k: string, fb: string) => desaturateTo(t[k], MAX_SAT, fb)
    return {
      primary: sat("primary", FALLBACK.primary),
      text:    sat("text", FALLBACK.text),
      muted:   sat("textMuted", FALLBACK.muted),
      success: sat("success", FALLBACK.success),
      warning: sat("warning", FALLBACK.warning),
      error:   sat("error", FALLBACK.error),
      border:  sat("border", FALLBACK.border),
    }
  })

  const gutter = 6

  const justify = (label: string, value: string): string => {
    const gauge = panelWidth() - gutter
    const used = visualWidth(label) + visualWidth(value)
    const gap = Math.max(1, gauge - used)
    return label + " ".repeat(gap) + value
  }

  const doFetch = async () => {
    const apiKey = props.api.kv.get<string>(API_KEY_KEY, "")
    if (!apiKey) {
      setError("未配置 API Key，运行 /ds 设置")
      return
    }
    setLoading(true)
    const result = await fetchBalance(apiKey)
    setLoading(false)
    if (result.data) {
      setData(result.data)
      setError(null)
    } else if (result.error) {
      setError(result.error)
    }
  }

  onMount(() => {
    try { setOpen(Boolean(props.api.kv.get(`${KV_PREFIX}.open`, true))) } catch {}
    doFetch()
    const interval = setInterval(doFetch, 60_000)
    onCleanup(() => clearInterval(interval))
  })

  const sep = createMemo(() => "\u2500".repeat(Math.max(1, panelWidth() - gutter)))

  const balance = createMemo(() => {
    const d = data()
    if (!d || !d.balance_infos?.length) return null
    const info = d.balance_infos[0]
    const total = parseFloat(info.total_balance) || 0
    const granted = parseFloat(info.granted_balance) || 0
    const topped = parseFloat(info.topped_up_balance) || 0
    const symbol = info.currency === "CNY" ? "\u00a5" : "$"
    return { total, granted, topped, symbol, available: d.is_available }
  })

  const balanceColor = createMemo(() => {
    const b = balance()
    if (!b) return pal().muted
    if (b.total <= 0) return pal().error
    if (b.total < 10) return pal().warning
    return pal().success
  })

  return (
    <box
      border
      borderColor={pal().border}
      paddingTop={0}
      paddingBottom={0}
      paddingLeft={2}
      paddingRight={2}
      flexDirection="column"
      gap={0}
      ref={boxEl}
      onSizeChange={() => {
        const w = boxEl ? Math.max(20, boxEl.width ?? 0) : 26
        setPanelWidth((prev) => (prev === w ? prev : w))
      }}
    >
      {/* header */}
      <text onMouseUp={() => setOpen((o) => { const n = !o; try { props.api.kv.set(`${KV_PREFIX}.open`, n) } catch {}; return n })}>
        <span style={{ fg: pal().muted }}>{open() ? "\u25bc " : "\u25b6 "}</span>
        <span style={{ fg: pal().primary }}><b>DeepSeek 余额</b></span>
        <Show when={!open() && balance()}>
          {(b) => {
            const totalStr = b().symbol + b().total.toFixed(2)
            const pad = Math.max(1, panelWidth() - gutter - visualWidth("DeepSeek 余额") - 2 - visualWidth(totalStr))
            return <>
              <span style={{ fg: pal().muted }}>{" ".repeat(pad)}</span>
              <span style={{ fg: balanceColor() }}>{totalStr}</span>
            </>
          }}
        </Show>
      </text>

      <Show when={open()}>
        <text fg={pal().muted}>{sep()}</text>

        <Show when={error()} fallback={
          <Show when={balance()} fallback={
            <text>
              <span style={{ fg: pal().muted }}>{"> "}</span>
              <span style={{ fg: pal().muted }}>{loading() ? "加载中..." : "等待数据..."}</span>
            </text>
          }>
            {(b) => <>
              <text>
                <span style={{ fg: pal().text }}>{"总额 "}</span>
                <span style={{ fg: balanceColor() }}><b>{b().symbol}{b().total.toFixed(2)}</b></span>
              </text>
              <text fg={pal().muted}>
                {justify("赠金", b().symbol + b().granted.toFixed(2))}
              </text>
              <text fg={pal().muted}>
                {justify("充值", b().symbol + b().topped.toFixed(2))}
              </text>
              <Show when={!b().available}>
                <text fg={pal().error}>{"余额不足，API 不可用"}</text>
              </Show>
            </>}
          </Show>
        }>
          <text>
            <span style={{ fg: pal().muted }}>{"> "}</span>
            <span style={{ fg: pal().warning }}>{error()}</span>
          </text>
        </Show>
      </Show>
    </box>
  )
}

// ── sidebar slot ──

function createSidebarSlot(api: TuiPluginApi): TuiSlotPlugin {
  return {
    order: 56,
    slots: {
      sidebar_content(ctx: TuiSlotContext, input: { session_id: string }): JSX.Element {
        return <DSBalancePanel theme={ctx.theme.current} api={api} sessionId={input.session_id} />
      },
    },
  }
}

// ── plugin entry ──

const tui: TuiPlugin = async (api: TuiPluginApi) => {
  api.slots.register(createSidebarSlot(api))

  api.command?.register(() => [
    {
      title: "DeepSeek: 设置 API Key",
      value: "ds.set.apikey",
      description: "设置 DeepSeek API Key 以查询余额",
      category: "DeepSeek",
      slash: { name: "ds" },
      onSelect: (dialog) => {
        dialog?.replace(() => (
          <api.ui.DialogPrompt
            title="设置 DeepSeek API Key"
            placeholder="sk-xxxxxxxxxxxxxxxx"
            onConfirm={async (value: string) => {
              api.kv.set("ds.apikey", value)
              api.ui.toast({ variant: "success", message: "API Key 已保存" })
              dialog?.clear()
            }}
            onCancel={() => dialog?.clear()}
          />
        ))
      },
    },
    {
      title: "DeepSeek: 退出登录",
      value: "ds.logout",
      description: "清除已保存的 DeepSeek API Key",
      category: "DeepSeek",
      slash: { name: "ds-logout" },
      onSelect: () => {
        api.kv.set("ds.apikey", "")
        api.ui.toast({ variant: "info", message: "API Key 已清除" })
      },
    },
  ])
}

const mod: TuiPluginModule & { id: string } = {
  id: "ds-balance",
  tui,
}

export default mod

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

function formatTokens(count: number): string {
  if (count >= 1e9) return (count / 1e9).toFixed(1) + "B"
  if (count >= 1e6) return (count / 1e6).toFixed(1) + "M"
  if (count >= 1e3) return (count / 1e3).toFixed(1) + "K"
  return String(count)
}

function progressBar(percent: number, width: number): string {
  const clamped = Math.max(0, Math.min(1, percent))
  const filled = Math.round(clamped * width)
  return "\u2588".repeat(filled) + "\u2591".repeat(width - filled)
}

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

interface UsageItem {
  name: string
  used: number
  limit: number
  percent: number
}

interface UsageData {
  usage: { percent: number; items: UsageItem[] }
  monthUsage: { percent: number; items: UsageItem[] }
}

// ── API ──

async function fetchUsage(cookie: string): Promise<{ data?: UsageData; error?: string }> {
  try {
    const res = await fetch(
      "https://platform.xiaomimimo.com/api/v1/tokenPlan/usage",
      {
        headers: {
          Cookie: cookie,
          "Content-Type": "application/json",
          Accept: "application/json",
          "x-timezone": Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      },
    )
    if (!res.ok) {
      const hint = res.status === 401 ? "（Cookie 已过期，请重新设置）" : ""
      return { error: `HTTP ${res.status}${hint}` }
    }
    const json = await res.json()
    if (json.code !== 0) return { error: json.message || "请求失败" }
    return { data: json.data }
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

// ── panel component ──

function isXiaomiProvider(api: TuiPluginApi, sessionId: string): boolean {
  try {
    const msgs = api.state.session.messages(sessionId)
    for (let i = msgs.length - 1; i >= 0; i--) {
      const msg = msgs[i] as any
      if (msg.role === "assistant" && msg.providerID) {
        const pid = String(msg.providerID).toLowerCase()
        if (pid.includes("xiaomi") || pid.includes("mimo")) return true
        return false
      }
    }
    // 没有 assistant 消息时检查 provider 列表中的 xiaomi 相关 provider
    for (const p of api.state.provider) {
      const pid = String(p.id).toLowerCase()
      if (pid.includes("xiaomi") || pid.includes("mimo")) return true
    }
  } catch {}
  return false
}

function MiMoPanel(props: {
  theme: TuiThemeCurrent
  api: TuiPluginApi
  sessionId: string
}): JSX.Element {
  const [open, setOpen] = createSignal(true)
  const [usage, setUsage] = createSignal<UsageData | null>(null)
  const [error, setError] = createSignal<string | null>(null)
  const [loading, setLoading] = createSignal(false)
  const [panelWidth, setPanelWidth] = createSignal(26)
  let boxEl: any

  const isXiaomi = createMemo(() => isXiaomiProvider(props.api, props.sessionId))
  if (!isXiaomi()) return null

  const KV_PREFIX = "mimo"
  const COOKIE_KEY = `${KV_PREFIX}.cookie`

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
    const cookie = props.api.kv.get<string>(COOKIE_KEY, "")
    if (!cookie) {
      setError("未配置 Cookie，运行 /mimo 设置")
      return
    }
    setLoading(true)
    const result = await fetchUsage(cookie)
    setLoading(false)
    if (result.data) {
      setUsage(result.data)
      setError(null)
    } else if (result.error) {
      setError(result.error)
    }
  }

  onMount(() => {
    try {
      setOpen(Boolean(props.api.kv.get(`${KV_PREFIX}.open`, true)))
    } catch {}

    doFetch()
    const interval = setInterval(doFetch, 60_000)
    onCleanup(() => clearInterval(interval))
  })

  const sep = createMemo(() => "\u2500".repeat(Math.max(1, panelWidth() - gutter)))

  const monthData = createMemo(() => {
    const data = usage()
    if (!data) return null
    const items = data.monthUsage?.items
    const item = items?.find((i) => i.name === "month_total_token")
    const pct = item?.percent ?? data.monthUsage?.percent
    if (pct == null) return null
    return { pct, item }
  })

  const planData = createMemo(() => {
    const data = usage()
    if (!data) return null
    const items = data.usage?.items
    const item = items?.find((i) => i.name === "plan_total_token")
    const pct = item?.percent ?? data.usage?.percent
    if (pct == null) return null
    return { pct, item }
  })

  const noPlan = createMemo(() => {
    const data = usage()
    if (!data) return false
    const mItems = data.monthUsage?.items
    const pItems = data.usage?.items
    const mPct = data.monthUsage?.percent ?? 0
    const pPct = data.usage?.percent ?? 0
    return (!mItems?.length && !pItems?.length && mPct === 0 && pPct === 0)
  })

  const hitColor = (p: number) => {
    if (p > 0.9) return pal().error
    if (p > 0.75) return pal().warning
    return pal().success
  }

  const barW = createMemo(() => {
    const overhead = visualWidth("本月") + 1 + 2 + 1 + 5 + gutter
    return Math.max(3, panelWidth() - overhead)
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
        <span style={{ fg: pal().primary }}><b>MiMo Token Plan</b></span>
        <Show when={!open() && monthData()}>
          {(md) => {
            const pctStr = (md().pct * 100).toFixed(1) + "%"
            const pad = Math.max(1, panelWidth() - gutter - visualWidth("MiMo Token Plan") - 2 - visualWidth(pctStr) - 1)
            return <>
              <span style={{ fg: pal().muted }}>{" ".repeat(pad)}</span>
              <span style={{ fg: hitColor(md().pct) }}>{pctStr}</span>
            </>
          }}
        </Show>
      </text>

      <Show when={open()}>
        <text fg={pal().muted}>{sep()}</text>

        <Show when={error()} fallback={
          <Show when={usage()} fallback={
            <text>
              <span style={{ fg: pal().muted }}>{"> "}</span>
              <span style={{ fg: pal().muted }}>{loading() ? "加载中..." : "等待数据..."}</span>
            </text>
          }>
            <Show when={!noPlan()} fallback={
              <text fg={pal().muted}>当前未订阅套餐</text>
            }>
            {/* month usage */}
            <Show when={monthData()}>
              {(md) => {
                const pctStr = (md().pct * 100).toFixed(1) + "%"
                return <>
                  <text>
                    <span style={{ fg: pal().text }}>{"本月 "}</span>
                    <span style={{ fg: hitColor(md().pct) }}>[{progressBar(md().pct, barW())}] </span>
                    <span style={{ fg: pal().text }}>{pctStr}</span>
                  </text>
                  <Show when={md().item}>
                    <text fg={pal().muted}>
                      {justify(formatTokens(md()!.item!.used), formatTokens(md()!.item!.limit))}
                    </text>
                  </Show>
                </>
              }}
            </Show>

            {/* plan usage */}
            <Show when={planData()}>
              {(pd) => {
                const pctStr = (pd().pct * 100).toFixed(1) + "%"
                return <>
                  <text>
                    <span style={{ fg: pal().text }}>{"总套餐 "}</span>
                    <span style={{ fg: hitColor(pd().pct) }}>[{progressBar(pd().pct, barW())}] </span>
                    <span style={{ fg: pal().text }}>{pctStr}</span>
                  </text>
                  <Show when={pd().item}>
                    <text fg={pal().muted}>
                      {justify(formatTokens(pd()!.item!.used), formatTokens(pd()!.item!.limit))}
                    </text>
                  </Show>
                </>
              }}
            </Show>
            </Show>{/* end noPlan */}
          </Show>
        }>
          {/* error state */}
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
    order: 55,
    slots: {
      sidebar_content(ctx: TuiSlotContext, input: { session_id: string }): JSX.Element {
        return <MiMoPanel theme={ctx.theme.current} api={api} sessionId={input.session_id} />
      },
    },
  }
}

// ── plugin entry ──

const tui: TuiPlugin = async (api: TuiPluginApi) => {
  api.slots.register(createSidebarSlot(api))

  api.command?.register(() => [
    {
      title: "MiMo: 设置 Cookie",
      value: "mimo.set.cookie",
      description: "设置 MiMo 平台 Cookie 以监控用量",
      category: "MiMo",
      slash: { name: "mimo" },
      onSelect: (dialog) => {
        dialog?.replace(() => (
          <api.ui.DialogPrompt
            title="设置 MiMo Cookie"
            placeholder="userId=xxx; api-platform_slh=xxx; api-platform_ph=xxx"
            onConfirm={async (value: string) => {
              api.kv.set("mimo.cookie", value)
              api.ui.toast({ variant: "success", message: "Cookie 已保存，刷新中..." })
              dialog?.clear()
            }}
            onCancel={() => dialog?.clear()}
          />
        ))
      },
    },
    {
      title: "MiMo: 退出登录",
      value: "mimo.logout",
      description: "清除已保存的 MiMo Cookie",
      category: "MiMo",
      slash: { name: "mimo-logout" },
      onSelect: () => {
        api.kv.set("mimo.cookie", "")
        api.ui.toast({ variant: "info", message: "Cookie 已清除" })
      },
    },
  ])
}

const mod: TuiPluginModule & { id: string } = {
  id: "mimo-usage",
  tui,
}

export default mod

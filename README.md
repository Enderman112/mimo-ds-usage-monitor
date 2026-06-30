# MiMo Usage Plugin

OpenCode / MiMo Code TUI 插件，用于在侧边栏实时监控 MiMo Token Plan 用量和 DeepSeek 账户余额。

## 功能

- **MiMo Token Plan 用量** — 显示本月和总套餐的进度条、已用/总量
- **DeepSeek 余额** — 显示总额、赠金、充值金额
- 自动刷新（每 60 秒）
- 根据当前使用的 provider 自动显示对应面板
- 通过 slash 命令配置认证信息

## 安装

### 最快方式：让 AI 帮你装

直接对 MiMo Code 或 OpenCode 说：

> 帮我从 https://github.com/Enderman112/mimo-ds-usage-monitor 安装插件

AI 会自动克隆仓库、安装依赖、配置好一切。

### 手动安装

#### OpenCode

1. 克隆本仓库
2. 在 `tui.jsonc` 中添加：
```json
{
  "plugin": ["./mimo-usage.tsx", "./ds-balance.tsx"]
}
```
3. 运行 `npm install` 安装依赖

#### MiMo Code

见 `mimocode-version/` 目录。

## 使用

在 OpenCode / MiMo Code 中运行 slash 命令配置认证信息：

| 命令 | 说明 |
|------|------|
| `/mimo` | 设置 MiMo 平台 Cookie |
| `/mimo-logout` | 清除 MiMo Cookie |
| `/ds` | 设置 DeepSeek API Key |
| `/ds-logout` | 清除 DeepSeek API Key |

### 获取 MiMo Cookie

1. 登录 https://platform.xiaomimimo.com
2. 打开浏览器 DevTools → Application → Cookies
3. 复制完整 cookie 字符串（需要 `userId`、`api-platform_slh`、`api-platform_ph`）

### 获取 DeepSeek API Key

1. 访问 https://platform.deepseek.com/api_keys
2. 创建并复制 API Key

## 文件说明

| 文件 | 说明 |
|------|------|
| `mimo-usage.tsx` | MiMo Token Plan 用量面板 |
| `ds-balance.tsx` | DeepSeek 余额面板 |
| `tui.jsonc` | TUI 插件配置 |
| `package.json` | 依赖声明 |
| `mimocode-version/` | MiMo Code 版本 |

## 技术栈

- SolidJS + `@opentui/solid`（TUI 渲染）
- `@opencode-ai/plugin` / `@mimo-ai/plugin`（插件 API）
- MiMo Token Plan API / DeepSeek Balance API

## License

MIT

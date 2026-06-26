# MiMo Usage Plugin - MiMo Code 版本

MiMo Code TUI 插件，用于监控 MiMo Token Plan 用量和 DeepSeek 余额。

## 安装

### 最快方式：让 AI 帮你装

直接对 MiMo Code 说：

> 帮我从 https://github.com/Enderman112/mimo-ds-usage-monitor 安装 MiMo Code 版本的插件，全局可用

AI 会自动克隆仓库、安装依赖、配置 `tui.json`。

### 手动安装

#### 方式一：全局安装（推荐）

1. 克隆本仓库
2. 进入 `mimocode-version/` 目录，安装依赖：
```bash
cd mimocode-version && npm install
```
3. 创建全局 TUI 配置文件 `~/.config/mimocode/tui.json`：
```json
{
  "plugin": [
    "/absolute/path/to/mimocode-version/mimo-usage.tsx",
    "/absolute/path/to/mimocode-version/ds-balance.tsx"
  ]
}
```
4. 重启 MiMo Code

#### 方式二：项目级安装

1. 将 `mimo-usage.tsx`、`ds-balance.tsx`、`package.json` 复制到项目的 `.mimocode/` 目录
2. 在 `.mimocode/tui.json` 中添加：
```json
{
  "plugin": ["./mimo-usage.tsx", "./ds-balance.tsx"]
}
```
3. 运行 `npm install` 安装依赖
4. 重启 MiMo Code

> **注意**：TUI 插件必须配置在 `tui.json` 中，不是 `mimocode.json`。

## 使用

| 命令 | 说明 |
|------|------|
| `/mimo` | 设置 MiMo 平台 Cookie |
| `/mimo-logout` | 清除 MiMo Cookie |
| `/ds` | 设置 DeepSeek API Key |
| `/ds-logout` | 清除 DeepSeek API Key |

用量面板会自动显示在侧边栏，根据当前 provider 自动切换。

## 与 OpenCode 版本的区别

| 项目 | OpenCode | MiMo Code |
|------|----------|-----------|
| 导入路径 | `@opencode-ai/plugin/tui` | `@mimo-ai/plugin/tui` |
| 配置文件 | `opencode.jsonc` | `tui.json` |
| 依赖包 | `@opencode-ai/plugin` | `@mimo-ai/plugin` |

## 文件说明

| 文件 | 说明 |
|------|------|
| `mimo-usage.tsx` | MiMo Token Plan 用量面板 |
| `ds-balance.tsx` | DeepSeek 余额面板 |
| `package.json` | 依赖声明 |

## License

MIT

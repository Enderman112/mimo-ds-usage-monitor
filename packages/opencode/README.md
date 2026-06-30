# mimo-ds-usage-plugin

OpenCode TUI 插件，在侧边栏实时监控 MiMo Token Plan 用量和 DeepSeek 账户余额。

## 安装

在 OpenCode 中按 `Ctrl + P` 打开命令面板，搜索 `install plugin`，输入：

```
mimo-ds-usage-plugin@latest
```

或手动安装：

```bash
npm install -g mimo-ds-usage-plugin
```

然后在 `~/.config/opencode/tui.json` 中添加：

```json
{
  "plugin": ["mimo-ds-usage-plugin"]
}
```

## 使用

| 命令 | 说明 |
|------|------|
| `/mimo` | 设置 MiMo 平台 Cookie |
| `/mimo-logout` | 清除 MiMo Cookie |
| `/ds` | 设置 DeepSeek API Key |
| `/ds-logout` | 清除 DeepSeek API Key |

## 功能

- **MiMo Token Plan 用量** — 显示本月和总套餐的进度条、已用/总量
- **DeepSeek 余额** — 显示总额、赠金、充值金额
- 自动刷新（每 60 秒）
- 根据当前使用的 provider 自动显示对应面板
- 无套餐时显示"当前未订阅套餐"
- Cookie 过期时提示重新设置

## License

MIT

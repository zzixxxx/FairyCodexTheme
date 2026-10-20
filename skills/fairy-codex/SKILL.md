---
name: fairy-codex
description: 启用或恢复本机 Fairy Codex 皮肤，查询真实账户用量，检查 Fairy 本地语音环境。用于明确涉及 Fairy 皮肤、H.D.D 或其语音设置的请求。
---

使用此技能目录下的 scripts/control.ps1。插件安装缓存和原始安装目录都可使用；不要硬编码用户目录。

执行方式：powershell.exe -NoProfile -ExecutionPolicy Bypass -File <此技能目录>/scripts/control.ps1 -Action <动作>

- Start：启动或重新启用 Fairy。若应用已运行但没有调试端口，告知需保存工作并正常退出后运行启动器；不要结束应用进程。
- Restore：恢复原貌并停止皮肤伴随程序，保留草稿和外观偏好。
- Status：只读检查当前皮肤状态。
- Usage：只读查询账户限额与本机 Token 元数据。现金余额未接入，不将限额百分比当成现金，不猜测费用。
- Check：检查 Windows、Node 和应用启动环境，不启动应用。

仅在用户要求启用或恢复时运行相应动作。安装插件不代表要求开启皮肤或改变所有聊天的风格。

语音控制位于已启用皮肤的 H.D.D → 语音朗读。默认使用系统中文语音；GPT-SoVITS 需用户另行提供服务、音色模型和参考音频。此插件不含原版音色，不读取或挪用账户凭据作语音调用。

DSH 的 browser-dock、balance-meter、fairy-startup、fairy-voice、fairy-visual 依赖其 ModuleLoader、slots、webServer 和 sessions。此包提供 Codex 适配入口，不是直接加载那些 DSH 模块。安装插件本身不会注入 CSS；Start 使用随包本地伴随程序。

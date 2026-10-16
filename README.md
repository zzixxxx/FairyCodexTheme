# FairyCodexTheme

绝区零 Fairy 风格的 Windows Codex 桌面主题。蓝紫独眼、Fairy 头像、深色空洞网格与日间外观，保留 Codex 原生聊天、模型和权限操作。非官方同人项目。

## 预览

以下是模拟界面的排版预览，聊天内容及用量均为示例。

![夜间聊天界面](preview-chat.png)
![日间界面](preview-day.png)

下载后可双击 `preview.html`，离线体验首页、聊天、思考状态和主题切换。

## 安装与启动

需要 Windows、Node.js 22 或更新版本，以及已安装的 Codex 桌面端。

1. 点击仓库的 **Code → Download ZIP** 并解压，保留目录中的所有文件。
2. 建议将工具放在 `%USERPROFILE%\Tools\Fairy-Codex-Windows`。也可以使用其他有写入权限的普通文件夹。
3. 保存工作，通过菜单正常退出 Codex。
4. 双击 `Start-Fairy.cmd`，切换到 **Codex** 模式，等待约 2 秒。

启动器通过 Windows 注册的应用身份启动 Codex，并开启只监听 `127.0.0.1:9341` 的 CDP 端口；随后启动隐藏的主题守护进程，刷新或新开窗口后会重新应用主题。不会强制关闭正在运行的聊天。

如需从 PowerShell 启动，在工具目录运行：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Start-Fairy.ps1
```

此执行策略仅作用于该进程，不修改系统执行策略。工具不修改 Codex 安装包、配置文件或开机启动项。

## 功能

- 隐藏首页原生装饰 logo，避免从 Fairy 眼睛后方露出；按钮和输入区图标保留。
- Fairy 头像与动态独眼：指针跟随、眨眼、处理状态轨道；支持关闭动画与低功耗模式。
- 日夜主题：H.D.D 设置和旁边的快捷按钮均可切换，偏好保存在本机。
- 聊天布局：上方独眼、独立消息区、加长输入框；底栏控件居中排列，文字左对齐。
- 工作区、模型、权限：无框样式，统一下拉箭头；模型和权限使用原生控件。选择工作区会打开对应项目入口，不更改运行中聊天的目录。
- 侧栏：蓝色文件夹、加粗项目名；工作区与 H.D.D 弹框支持点击外部或按 Esc 关闭。
- 用量卡片：现金余额未接入时显示「—」；今日电量显示本机 Token 增量；剩余用量直接列出 5 小时与 1 周剩余百分比、重置时间和更新时间，无需悬停。
- 性能：只响应会话结构、控件和尺寸变化，合并同一帧的刷新；复用节点、清理旧会话标记，相同用量不重复改写界面。切换页面的短暂容器空档保持主题挂载，减少闪烁。
- 窄窗口自动收回装饰和底栏布局；支持系统减少动态效果设置。

剩余额度每分钟通过已安装 Codex CLI 的只读 `account/rateLimits/read` 接口主动查询，不依赖新聊天或日志追加。查询由 CLI 使用已有登录完成，主题不读取或输出凭据。界面标注「查询」时间；接口不可用时回退到本机 `token_count` 额度记录，并标注「记录」时间，过期数据等待更新，不推测为 100%。

今日电量仍只解析本机会话日志的 Token 元数据，按北京时间自然日累计，包含缓存输入；本机记录不等同于完整账户账单。主题不保存聊天正文。

账户查询接口参考 [OpenAI App Server 文档](https://developers.openai.com/codex/app-server)。

## 恢复原貌

双击 `Restore-Fairy.cmd`，或在 H.D.D 设置中点击「恢复 Codex 原貌」。它会停止主题守护进程，清理已连接窗口中的主题样式、节点和监听器，保留输入草稿。

正常退出应用并从原快捷方式启动，也会清除本次注入及调试端口。

## 静态主题包

`Fairy-Hollow.codextheme` 面向 [Codex Themes](https://github.com/freestylefly/codex-themes) 第三方主题客户端，使用 schema v2 ZIP 格式。

静态包包含配色、主图、布局和文案，不包含动态眼睛、外观设置和用量运行时。动态版和静态版任选一种，避免叠加。此文件不是 Codex 原生的 `codex-theme-v1:` 字符串。

## 排障与兼容

已在 Windows 的 OpenAI.Codex 26.1007.2314.0 和 26.1007.9446.0 上验证。Codex 更新可能改变内部 DOM，适配位置在 `renderer.js` 和 `fairy.css`。主题仅在识别到 Codex 主界面时启用。

- 未生效：正常退出 Codex 后再运行启动器，确认已切到 Codex 模式。
- 启动报错：查看工具目录的 `fairy.log` 和 `fairy-error.log`。
- 只检查环境：运行 `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\Start-Fairy.ps1 -Check`。
- 进阶命令：`node fairy.mjs apply|watch|restore|status --port=9341`。

已检查模拟界面的日夜布局、偏好保存、窄窗口、草稿保留、弹框外部关闭和恢复；真实客户端检查了模型及权限菜单、工作区列表和用量显示。用量采集覆盖跨日、重复事件、计数器重置、继承计数、文件追加及额度窗口。

## 来源与第三方许可

- UI 与动态眼睛参考 [Fairy-DSH](https://github.com/Chengzhibense/Fairy-DSH)，固定提交 `d639887a386b0de6fef2e61c97dc268631854591`。眼睛 SVG 和几何代码保存在 `vendor/`，遵循 Apache-2.0，版权及许可全文随附。
- 实现参考 [codex-themes](https://github.com/freestylefly/codex-themes)，固定提交 `e33759183f6baa9c42856631cc8f9321486e60ae`。本机 CDP 传输逻辑经过适配，MIT 许可及其上游 NOTICE 随附。
- 顶栏头像由项目提供，Fairy、《绝区零》相关图形、名称和商标归各自权利人所有；第三方代码许可不代表这些素材的权利授权。

此项目不包含官方游戏音频、台词、私有语料或账户记录，也不提供角色人格和语音功能。

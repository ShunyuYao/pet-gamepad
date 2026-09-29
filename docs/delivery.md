# 首批实现记录 / First implementation batch

2026-09-29，experimental，尚未发布。

## 已验证

- 插件 6 组生命周期测试，包括快速启停重启、延迟注册和失败后恢复。
- 隔离的真实 Electron 宿主输入 E2E 17 项：真实普通插件进程、work 授权、同步快照、配置更新、冲突拒绝、页面重载、卸载清理、重新授权安装及新进程配置恢复。
- 原型 59 条交互与 11 条新进程持久化断言；真实 Chromium 键盘通道，浅/深主题与 390px 布局截图。自动手柄读数是测试夹具。
- 配套宿主的契约门禁、既有统一 SDK/HTML/普通插件回归、类型和脚手架实际路径对账通过。宿主输入候选基线为 Test 39d4567e；没有合入 main 或发布宿主。

## 本批未完成

- [macOS + PS5 真机表](hardware-acceptance.md)：USB、蓝牙、原生焦点。
- 把评审后的设置页接到插件真实配置；当前原型仅自身 localStorage。
- 六款游戏适配；当前 `examples/action-work.html` 仅用于动作 SDK 联调。
- npm、市场、安装包或最低支持版本发布。

## 修复与预防

AI 复查以重放测试发现：旧停用可能注销新实例、状态回调再次清理会出错、旧同步失败覆盖新状态、内置菜单默认绑定未参与改键冲突检查。已分别补回归后修复。宿主 E2E 等待实际首帧快照而不只等连接 Promise；卸载后的测试重装显式重新授权，避免错误假定旧授权仍有效。

## English

This unreleased batch includes the ordinary provider plugin, an action SDK sample and an interactive settings proposal. Six plugin lifecycle tests, 17 real isolated-host input checks and 70 prototype interaction/persistence assertions passed. Host SDK regressions and the actual type/scaffold delivery checks also passed. Synthetic input is not hardware evidence. The production settings panel, six game adapters, macOS/DualSense USB/Bluetooth/focus acceptance and all package/marketplace releases remain pending.

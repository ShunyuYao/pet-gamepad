# Pet Gamepad / 通用手柄支持

面向桌宠 Vibe 游戏的可安装手柄插件与统一动作接入标准。当前为开发中实验版本，尚未发布，不能视为现有正式宿主已支持。

## 方向

- 插件维护布局、默认参数和用户配置；宿主提供可信输入运行时；游戏接自己的动作与玩法。
- 首轮真机目标为 macOS + PS5 DualSense；总体目标包括 Xbox、PS4 和 PS5。
- 游戏保留键鼠操作。插件失活、失焦和设备断连都必须取消持续输入，不能误触攻击。
- 高频采样留在游戏窗口；设置面板关闭不影响插件服务。

实现规划见 [设计与阶段](docs/design.md)。设置页原型为交互评审用途，演示配置不写入宿主。

## English

An experimental, installable controller plugin and action-input contract for Desktop Pet Vibe games. The plugin manages preferences; the host owns the trusted input runtime; each game maps actions into its existing rules. The first hardware target is macOS with a PS5 DualSense. Xbox and PS4 remain compatibility targets, not verified claims.

This is unreleased development work. No public host download is provided. Availability in source does not imply support in an installed host build.

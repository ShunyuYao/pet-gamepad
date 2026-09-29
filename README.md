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

## 本地预览与验证

Node.js 22.12 或以上。原型无需安装依赖：

```sh
npm run dev:prototype
```

打开终端显示的本地地址。原型提供连接检测、明确标注的模拟设备、全局/单游戏映射和校准交互；保存仅作用于原型，尚未写入宿主。

运行完整开发验证（路径须指向本次 SDK 候选和已安装 Electron 的宿主）：

```sh
PET_GAMEPAD_HOST_DIR=/absolute/desktop-pet \
PET_HOST_DIR=/absolute/desktop-pet npm run test:delivery
```

`test:plugin` 验证插件生命周期；`test:host` 安装此仓库实际插件并验证隐藏宿主；`test:prototype:e2e` 验证原型真实键盘交互及新进程保存。缺宿主不能当作跳过成功。

`examples/action-work.html` 是动作 API 验证页。正式设置面板和七款游戏适配尚未完成；现有正式宿主不保证支持这个开发候选。真机 USB、蓝牙和原生焦点测试记录见后续验收，当前不标记通过。

### Development preview and checks

Run `npm run dev:prototype` for the local interactive proposal. It has separate prototype storage; no host settings are changed. The full delivery command above requires the actual experimental host checkout and its Electron dependencies. It exercises the real plugin, isolated host and prototype. The seven game adapters, production settings panel and physical controller compatibility are not yet delivered. No package or marketplace release has been made.

首批范围与证据见 [交付记录](docs/delivery.md)，设备测试见 [真机验收表](docs/hardware-acceptance.md)。

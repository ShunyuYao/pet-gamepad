# 通用手柄插件 v0.1：设计与实施阶段

2026-09-29。用户已授权开始实现；接口为 experimental，须经过真实宿主与真机验证后冻结。

## 已确定的职责

| 层 | 职责 |
| --- | --- |
| 普通插件 | 登记标准布局支持、全局与逐游戏设置、死区及提示偏好 |
| 宿主 SDK | 调用身份与权限、提供方登记及清理、原子持久化、活动游戏内本地输入运行时 |
| 游戏 | 声明动作与默认绑定；将动作接入原规则，适配菜单、瞄准和编辑器 |

插件不读取原始按键流，不注入游戏脚本。底层算法随宿主更新；预设和设置随插件更新。

## 第一阶段明确范围

1. `pet.input` 提供方登记、配置读写、失活清理和版本检查。
2. 游戏连接、本地动作快照、上下文切换、状态订阅和释放；样例先覆盖按钮与模拟轴。
3. 标准映射的方向键、双摇杆、按钮、肩键、扳机；未知映射明确不可用，不猜测按钮编号。
4. 原创设置页交互原型，与正式宿主配置分开。实机检测可在用户主动开启后运行；模拟设备必须标明。
5. 隔离的隐藏 Electron 验收、单元与权限反例、三仓类型和文档同步。

第一阶段不含震动、同机多人、陀螺仪、触摸板或自适应扳机。七款游戏全部接入仍是后续里程碑，不能用样例成功代替七款验收。

## 接口

提供方（tool；配置允许同插件 panel）：`registerProvider / getConfig / updateConfig / unregisterProvider`，权限 `input:provide`。

游戏（work）：`connect / read / setContext / onStatus / openSettings / disconnect`，消费权限 `service:gamepad-input`。命名服务权限兼容旧 HTML 声明解析器；新入口不存在时保留键鼠，不能把旧宿主解析失败伪装成运行期回退。

`read` 为隔离 preload 中同步、有限的数据快照，无逐帧主进程或插件 RPC。其余配置和生命周期必须由宿主确认，不接受游戏自报提供方、存储路径或游戏身份。

## 输入语义

- 动作类型为 button、axis1d（signed/unsigned）、axis2d。绑定采用物理位置名字；显示可选 Xbox、PlayStation 或通用布局。
- 每次采样只推进一次计数；多次读取不重复触发。pressCount/releaseCount 在会话内单调。
- 失焦、断连、配置替换、上下文切换增加 resetRevision 并中和，不产生代表物理松手的 releaseCount。
- 游戏看到 resetRevision 改变须取消旧持续动作、推进消费基线，不补发旧攻击。
- 重连、切换和恢复须等待相关按钮松开、摇杆回中。设备确认动作不能直接变成攻击。
- gameplay/menu/text-entry/suspended 分离。输入 SDK 不替游戏暂停网络对局或判负。
- 状态与有效绑定提示低频更新；改键后提示一起变化。

## 配置与身份

配置初始字段：layout、deadzone、buttonThreshold、bindings。有限数据结构，不允许脚本、路径、URL 或任意正则。

配置按 expectedRevision 比较并原子落盘，失败不广播成功；启动默认值不覆盖已保存偏好。默认参数 → 游戏默认绑定 → 用户全局设置 → 单游戏覆盖。

首期首次获授权的提供方成为持久选择，第二提供方不能按启动顺序抢占；停用不自动切换。游戏身份初期严格按宿主来源和内容摘要隔离，跨版本绑定留给后续明确的用户流程，不用自报 gameId 放宽权限。

## 验收里程碑

- M1：SDK 与最小插件在真实隔离宿主中连通；生命周期、配置持久化、权限、生成桥和类型通过。
- M2：macOS + DualSense 真机验证首次激活、焦点、按钮、轴、USB/蓝牙分别记录；设置原型评审。
- M3：黄金矿工与赛车全流程适配；再推广大乱斗、颜料、躲猫猫、水球和猫猫点击游戏。
- M4：完整受影响回归、兼容记录及分发材料；实际发布另行进行。

当前硬件尚未完成测试。可交互原型不代表生产设置页面已经交付。

## 上游依据

- [Gamepad specification](https://www.w3.org/TR/gamepad/)
- [Electron contextBridge](https://www.electronjs.org/docs/latest/api/context-bridge)
- [Electron sandbox](https://www.electronjs.org/docs/latest/tutorial/sandbox)


## 2026-09-30 游戏基线更新

宿主输入候选先合并用户指定的最新 Test f1f1bbf0，重新执行全部首批门禁，包括本机 HTML 授权记忆和账号授权。游戏从下面的源码基线开工，不回退已经修复的联机规则。

| 游戏 | 版本 / 提交 | 接入边界 |
| --- | --- | --- |
| 黄金矿工 | 0.5.1 / 76ce2cc | 使用现有 fire() 节流和发射计数，不另发网络消息 |
| 桌宠赛车 | 0.5.1 / 0e275f1 | 模拟转向、道具边沿；SDK 接管时关闭旧手柄读取 |
| 桌宠大乱斗 | 0.5.2 / d48d897 | 保留按住和边沿；SDK 与旧采样互斥，reset 显式取消蓄力 |
| 躲猫猫对决 | 2.0.2 / 276d020 | 大厅确认姿势、局内锁定；躲藏方左右移动/旋转，寻找方二维瞄准 |
| 颜料大作战 | 0.1.0 / acfa928 | 双摇杆、开火和潜行只影响本机输入 |
| 水球大作战 | 0.1.1 / ebf28c6 | 四方向后按优先；放水球、用针各一次边沿，踢球仍由移动触发 |
| 巴巴波以大战比比拉布 | 1.6.0 / codex/account-leaderboard@c906995 | 使用 bababoyi-leaderboard 独立源码仓，保留真实命中、先计时再判定与账号排行榜 |

水球加入七款清单；本地 readInput() 适配，不改游戏规则或 req-place/req-needle 的可靠网络事件。黄金矿工只允许用 GOLD_PUBLIC=1 构建公开产物，私人角色包不能随源码或 HTML 分发。坦克营未开工，后续直接使用动作标准。

This batch adds Water Balloon to the seven-game plan. Use the listed post-network-fix baselines, retain existing action counters and network rules, and make legacy Gamepad polling yield whenever the SDK owns input, including suspended states. Brawl needs explicit charge cancellation rather than a simulated release. Hide-and-seek locks the pose after lobby confirmation; gameplay keeps lateral movement, planar rotation and two-dimensional aiming. Bababoyi must retain its account-leaderboard branch and real hit-testing/timing. Public Gold Miner builds require GOLD_PUBLIC=1; private character assets must not be distributed.

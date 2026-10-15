# Lu aiTV 品牌资源

- 可见应用名改为 `Lu aiTV`：首页、引导页、关于页、Agent 欢迎语、窗口标题、桌面菜单、Windows 安装器、Android 应用标签与相关提示。
- 桌面配置中的应用名称改为 Lu aiTV，Windows 安装包名使用 luAiTv 前缀；发布脚本同步匹配。内部包名、应用标识、通信协议、数据文件名保持兼容。上游许可证和来源说明保留。
- 主图标为黑底、白蓝交织 LU、外侧透明圆角；`packages/assets/logo.svg` 内嵌 PNG 以兼容原有界面引用，同时提供 ICO、PNG 和各平台所需尺寸。
- 启动字标使用单独的纯黑透明 LU，源图保存在 `packages/assets/luSplash.png`。
- 启动动画 `packages/startup/assets/startup.json` 为纯矢量 Lottie，不依赖原生 DLL 不支持的图片解码或字体加载。背景透明，黑色 LU 沿笔画书写入场，先写 L，再写 U 与交织笔画，下面显示 Lu aiTV。
- Windows 启动器及辅助程序编译时嵌入 LU ICO；安装结束通知 Shell 刷新同路径覆盖后的图标。
- intro 约 2.4 秒；加载时保持可见；就绪后约 0.4 秒淡出。播放器兼容无 intro 标记的旧动画，快速启动也保留一次完整书写。

Windows 2.0.6 安装包已生成。此次移除白底后，已用 Windows ThorVG 实际渲染书写、加载和淡出帧，背景 Alpha 为 0；启动器携带 LU 内嵌图标并编译通过。安装器刷新图标的实际桌面效果仍需覆盖安装修正版确认；未在 macOS 真机验证。独立类型检查受原源码缺少 `.hutch/devkit/api/config/ElectrobunConfig` 影响。

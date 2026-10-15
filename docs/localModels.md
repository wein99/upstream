# 本地默认模型配置

本次修改沿用 Toonflow 2.x 的供应商插件、配置表单和启动初始化机制。

## 默认供应商

- 语言：DeepSeek 官方 API，`https://api.deepseek.com`。预置 `deepseek-flash` 和 `deepseek-v4-pro`，Flash 排在首位；填写自己的 DeepSeek API Key 后可获取最新模型列表。
- 媒体：火山方舟官方 API，北京区域 `https://ark.cn-beijing.volces.com/api/v3`。默认图片 `doubao-seedream-5-0-pro-260628`，默认视频 `doubao-seedance-2-5-260628`。
- 原 TF-Router、APIMart、秘塔、优云智算不再默认安装，也不在内置媒体供应商选择列表展示。原适配文件保留，便于兼容用户主动导入的配置。
- 首次引导改为配置 DeepSeek 与火山方舟，不再通过 TF-Router 登录自动安装媒体供应商。

## 使用

1. 按仓库说明安装 Bun 1.3.14，在项目根目录执行 `bun install --frozen-lockfile`。
2. 执行 `bun run build:server`，再执行 `bun run start:server`；本机访问 `http://127.0.0.1:3000`。
3. 在首次引导或设置的语言模型面板，填写 DeepSeek API Key。
4. 在媒体模型面板编辑「火山引擎 · 火山方舟」，填写火山方舟 API Key。先在火山控制台开通所需模型权限。
5. 没有自定义推理接入点时，图片和视频模型接入点字段留空。填写 ep-… 时，应选择与默认模型同系列、同能力的接入点；切换其他系列还需编辑模型能力与适配实现。

两家的 API Key 相互独立，源码中均留空。模型调用按各平台规则收费。

## 当前能力与边界

- 图片：文生图、单图与多参考图，1K / 1.5K / 2K，8 种比例。生成数量 1～8 张，Pro 按数量串行生成，不自动重试付费请求。
- 视频：文生视频、单图、首尾帧、多图片参考；适配界面提供 4～30 秒、480p / 720p / 1080p、可选原生声音。本次实现的是该模型的一部分能力。
- 视频多参模式最多 9 张图片。画布将本地视频/音频读成 Base64，而官方接口要求公网 URL 或素材 ID；因未接入上传流程，内置模型不声明视频/音频参考。视频编辑、尾帧单独生成和素材上传不在本次范围内。
- 图片比例映射为官方像素尺寸；图片直接读取生成结果。视频通过官方创建任务接口提交并轮询查询结果。
- 取消只终止本地等待，不删除云端任务。任务可能继续运行和计费。
- 首次初始化不覆盖已存在的用户语言模型列表，亦不删除既有运行数据中的供应商文件。
- 锁文件中的旧淘宝下载地址已换成 npm 官方 HTTPS 地址，保留依赖版本和完整性校验值。

## 验证记录

- Bun 1.3.14 安装锁定依赖成功。
- 原项目 `build:server` 完整构建成功，包括节点、工具、扩展、Web、Server 与 MCP。
- 原项目供应商源码解析校验成功；临时空数据目录默认语言供应商仅 DeepSeek。
- 本机临时服务读取 `/api/providers/media/list` 返回 HTTP 200，默认媒体供应商仅 volcengine，两个模型均加载成功。服务已关闭。
- Web 与 Server 类型检查仍被原项目缺少 `.hutch/devkit/api/config/ElectrobunConfig` 类型文件阻断；修正本次供应商 icon 类型问题后，剩余报错仅该缺失文件。
- 未使用真实 API Key，未执行真实图片/视频生成，未产生生成费用。构建通过不等于云端生成已验证。

## 视频参数一致性修正

- Seedance 2.5 内置时长扩展为 4～30 秒，分辨率支持 480p / 720p / 1080p，不声明 4K。首帧/首尾帧模式只能选择 adaptive，普通参考图和纯文本模式可选固定画幅。
- 修复首帧可选模式仅接一张图片时误填入 lastFrame 的错误。
- 仅为未配置的新节点初始化默认值；已有时长和分辨率不再自动降级为列表第一项。不兼容的设置在生成前明确报错。
- Agent 一次 setConfig 内的模型、模式、时长、画质作为同一组参数应用，避免同步 watcher 在中途覆盖字段。设置后回读 getConfig。
- 火山适配要求明确提供整数 duration、resolution、ratio、generateAudio，不再通过 duration 缺省值回退到 5 秒。采用官方 JSON 顶层字段；不同时提交优先级更高的 frames，拒绝提示词中的旧式 --dur/--rs 等冲突参数。
- 保存云端 taskId、requested、reported 和 warnings，随生成文件结果返回，画布保存在 lastGeneration；Agent 从 getConfig/getGenerationStatus 读取。没有记录 API Key、授权头、临时下载链接或完整提示词。
- 平台查询 duration 是向下取整的约数，偏差超过 1 秒时提示。视频能在播放器加载时，另外记录实际秒数、宽高，检查时长/画幅及常见横竖屏分辨率。不符时保留付费生成的文件并显示警告，不自动再付费生成。
- 用户已确认历史“14 秒变 5 秒”由配置不正确造成，不将其归因为代码丢参数。此次改动用于规范当前适配的参数传递、避免隐式回退并核对输出；尚未使用真实账号执行云端生成。

## 提示词兼容性检查

- 系统提示词与 canvas 技能取消优先选择 gpt-image 的旧偏好。语言默认 DeepSeek，图片/视频使用当前适用配置或实际可用的火山方舟模型。
- workflow 不再强制询问 Seedance 2.0/2.5，允许并要求在提示词规划前只读查询真实模型能力。
- 单段上限来自运行时可选时长，当前适配为 4～30 秒，支持显式设置 4～30 秒，不使用省略 duration 的智能时长。
- 旧 v1.1.8 技能中的其他模型模板只作条件适用的历史参考，不参与默认模型选择，也不成为当前参数白名单。
- 保留剧情保真、真实参考绑定、生成授权和结果核验要求，没有删除创作约束来规避兼容问题。
- 原启动机制只首次复制技能；已经安装过旧技能的数据目录不会自动覆盖，以免丢失用户编辑。更新已有安装时需通过技能管理同步本次更新的内置技能；新数据目录使用新版本。F 盘当前源码没有 data 目录，本次未改动任何已有运行数据或用户自定义系统提示词。

## 官方接口资料

- https://api-docs.deepseek.com/quick_start/pricing-details-cny/
- https://docs.volcengine.com/docs/ark/model-list?lang=zh
- https://docs.volcengine.com/docs/ark/image-generation-api?lang=zh
- https://docs.volcengine.com/docs/ark/create-video-generation-task-api?lang=zh
- https://docs.volcengine.com/docs/ark/get-video-generation-task-api?lang=zh

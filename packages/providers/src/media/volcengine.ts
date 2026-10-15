const rules = [
  { type: "input", field: "apiKey" as const, title: "火山方舟 API Key", value: "", props: { type: "password", showPassword: true, autocomplete: "off" } },
  { type: "input", field: "imageModel" as const, title: "图片模型或接入点（可选）", value: "", props: { placeholder: "留空使用内置模型，或填写 ep-…" } },
  { type: "input", field: "videoModel" as const, title: "视频模型或接入点（可选）", value: "", props: { placeholder: "留空使用内置模型，或填写 ep-…" } },
] as const;

// 火山方舟官方直连：https://docs.volcengine.com/docs/ark/image-generation-api
// https://docs.volcengine.com/docs/ark/create-video-generation-task-api
const apiUrl = "https://ark.cn-beijing.volces.com/api/v3";
const imageSizes: Record<string, Record<string, string>> = {
  "1K": { "1:1": "1024x1024", "4:3": "1152x864", "3:4": "864x1152", "16:9": "1424x800", "9:16": "800x1424", "3:2": "1248x832", "2:3": "832x1248", "21:9": "1568x672" },
  "1.5K": { "1:1": "1536x1536", "4:3": "1792x1344", "3:4": "1344x1792", "16:9": "2048x1152", "9:16": "1152x2048", "3:2": "1872x1248", "2:3": "1248x1872", "21:9": "2352x1008" },
  "2K": { "1:1": "2048x2048", "4:3": "2368x1776", "3:4": "1776x2368", "16:9": "2816x1584", "9:16": "1584x2816", "3:2": "2496x1664", "2:3": "1664x2496", "21:9": "3136x1344" },
};

function mediaUrl(input: MediaInput, kind: "image" | "video" | "audio") {
  if (input.type === "url") {
    if (!/^https?:\/\//i.test(input.url) && !(kind !== "image" && /^asset:\/\/[^\s]+$/.test(input.url)))
      throw new Error("参考媒体需要 HTTP/HTTPS 地址或火山素材 ID");
    return input.url;
  }
  if (kind !== "image") throw new Error("视频和音频参考请使用火山方舟可访问的公网 URL 或 asset:// 素材 ID");
  if (!input.mimeType.startsWith("image/")) throw new Error("图片参考的 MIME 类型无效");
  const data = input.type === "binary" ? Buffer.from(input.data).toString("base64") : input.data;
  return data.startsWith("data:") ? data : `data:${input.mimeType};base64,${data}`;
}

async function requestJson(context: ProviderContext, path: string, signal: AbortSignal, body?: unknown) {
  const apiKey = typeof context.config.apiKey === "string" ? context.config.apiKey.trim().replace(/^Bearer\s+/i, "") : "";
  if (!apiKey) throw new Error("请在媒体模型设置中填写火山方舟 API Key");
  signal.throwIfAborted();
  const response = await context.tool.fetch(`${apiUrl}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body), signal, redirect: "error",
  });
  const data = await response.json() as { error?: unknown; data?: { url?: string; b64_json?: string; error?: unknown }[]; id?: string; status?: string; duration?: number; resolution?: string; ratio?: string; generate_audio?: boolean; content?: { video_url?: string } };
  if (!response.ok || data.error) throw new Error(context.tool.errorMessage(data) || `火山方舟请求失败：HTTP ${response.status}`);
  return data;
}

function wait(signal: AbortSignal) {
  signal.throwIfAborted();
  return new Promise<void>((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(signal.reason); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, 5000);
    signal.addEventListener("abort", abort, { once: true });
  });
}

export default {
  id: "volcengine",
  label: "火山引擎 · 火山方舟",
  icon: "",
  version: "1.1.0",
  readme: "官方直连火山方舟，北京区域。请分别在 DeepSeek 和本供应商填写各自的 API Key，并在火山方舟开通模型权限。图片默认 Seedream 5.0 Pro，视频默认 Seedance 2.5；可填写同系列模型的推理接入点 ep-…，其他模型能力请通过编辑模型调整。支持文生图、参考图、文生视频、首尾帧和多图片参考。画布当前支持本地图片参考，不支持本地视频/音频参考上传；原生声音生成可用。取消等待不会删除云端任务，任务可能继续计费。",
  rules,
  models: [
    { id: "doubao-seedream-5-0-pro-260628", label: "Seedream 5.0 Pro", type: "image", mode: ["text", "singleImage", "multiReference"], imageSizes: ["1K", "1.5K", "2K"], imageRatios: ["1:1", "4:3", "3:4", "16:9", "9:16", "3:2", "2:3", "21:9"] },
    { id: "doubao-seedance-2-5-260628", label: "Seedance 2.5", type: "video", mode: ["text", "singleImage", "startFrameOptional", "startEndRequired", ["imageReference:9"]], audio: "optional", videoRatios: ["16:9", "4:3", "1:1", "3:4", "9:16", "21:9", "adaptive"], frameRatios: ["adaptive"], durationResolutionMap: [{ duration: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30], resolution: ["480p", "720p", "1080p"] }] },
  ] satisfies ProviderModel[],
  async generateImage(request: ImageRequest): Promise<MediaAsset[]> {
    if (!request.prompt.trim()) throw new Error("请填写图片提示词");
    if (request.mask) throw new Error("当前 Seedream 适配不支持蒙版参数");
    const count = request.n ?? 1;
    if (!Number.isInteger(count) || count < 1 || count > 8) throw new Error("单次图片数量应为 1～8 张");
    const size = imageSizes[request.size ?? "2K"]?.[request.ratio ?? "1:1"];
    if (!size) throw new Error("请选择内置的图片尺寸和比例");
    const image = (request.images ?? []).map(input => mediaUrl(input, "image"));
    if (image.length > 14) throw new Error("参考图最多 14 张");
    const outputFormat = request.outputFormat ?? "jpeg";
    if (!["jpeg", "png"].includes(outputFormat)) throw new Error("图片格式仅支持 jpeg 和 png");
    const signal = AbortSignal.any([AbortSignal.timeout(10 * 60_000), ...(this.signal ? [this.signal] : [])]);
    const assets: MediaAsset[] = [];
    // ACT: Pro 为单图生成，按用户指定数量串行调用，不自动重试付费请求。
    for (let index = 0; index < count; index++) {
      const data = await requestJson(this, "/images/generations", signal, {
        model: this.config.imageModel?.trim() || request.model, prompt: request.prompt, size,
        ...(image.length ? { image } : {}), response_format: "url", output_format: outputFormat, watermark: false,
      });
      if (!data.data?.length) throw new Error("火山方舟未返回图片");
      for (const item of data.data) {
        if (item.error) throw new Error(this.tool.errorMessage(item) || "图片生成失败");
        if (item.url) assets.push({ mediaType: "image", type: "url", url: item.url });
        else if (item.b64_json) assets.push({ mediaType: "image", type: "base64", data: item.b64_json, mimeType: `image/${outputFormat}` });
        else throw new Error("火山方舟未返回有效图片地址");
      }
    }
    return assets;
  },
  async generateVideo(request: VideoRequest): Promise<MediaAsset[]> {
    if (!request.prompt.trim()) throw new Error("请填写视频提示词");
    if (/(?:^|\s)--(?:dur|duration|rs|resolution|rt|ratio|ar|frames|fps|wm|watermark)\b/i.test(request.prompt))
      throw new Error("提示词含旧版视频参数标记，请移除 --dur/--rs/--ratio 等标记，使用节点或 Agent 的独立参数设置，避免参数冲突");
    if (request.other?.frames !== undefined) throw new Error("当前适配按秒设置 duration，不允许同时设置优先级更高的 frames");
    const content: Record<string, unknown>[] = [{ type: "text", text: request.prompt }];
    const images = request.images ?? [];
    const videos = request.videos ?? [];
    const audios = request.audios ?? [];
    const mode = request.mode ?? (request.firstFrame || request.lastFrame ? "startFrameOptional" : images.length || videos.length || audios.length ? ["imageReference:9"] : "text");
    const addImage = (input: MediaInput, role: string) => content.push({ type: "image_url", image_url: { url: mediaUrl(input, "image") }, role });
    if (Array.isArray(mode)) {
      if (request.firstFrame || request.lastFrame) throw new Error("多模态参考不能同时指定首尾帧");
      if (images.length > 9 || videos.length > 3 || audios.length > 3) throw new Error("参考数量上限：9 张图片、3 个视频、3 个音频");
      images.forEach(input => addImage(input, "reference_image"));
      videos.forEach(input => content.push({ type: "video_url", video_url: { url: mediaUrl(input, "video") }, role: "reference_video" }));
      audios.forEach(input => content.push({ type: "audio_url", audio_url: { url: mediaUrl(input, "audio") }, role: "reference_audio" }));
      if (!images.length && !videos.length) throw new Error("多模态参考至少需要一张图片或一个视频");
    } else {
      if (videos.length || audios.length) throw new Error("视频和音频参考需要选择多模态参考模式");
      if (mode === "text") {
        if (images.length || request.firstFrame || request.lastFrame) throw new Error("文生视频模式不能传入参考媒体");
      } else {
        if (mode !== "singleImage" && images.length) throw new Error("首尾帧模式请使用首尾帧输入");
        if (mode === "singleImage" && (images.length !== 1 || request.firstFrame || request.lastFrame)) throw new Error("单图模式需要且仅需要一张参考图");
        const first = request.firstFrame ?? images[0];
        if (!first) throw new Error("请提供首帧图片");
        if (mode === "startEndRequired" && !request.lastFrame) throw new Error("请提供尾帧图片");
        addImage(first, "first_frame");
        if (request.lastFrame) addImage(request.lastFrame, "last_frame");
      }
    }
    const duration = request.duration;
    if (duration === undefined || !Number.isInteger(duration) || duration < 4 || duration > 30) throw new Error("请显式设置 4～30 秒的整数时长，不能省略时长后回退默认值");
    const resolution = request.resolution?.trim().toLowerCase();
    if (!resolution) throw new Error("请显式设置视频分辨率");
    if (!["480p", "720p", "1080p"].includes(resolution)) throw new Error("视频分辨率不支持");
    const ratio = request.ratio?.trim();
    if (!ratio) throw new Error("请显式设置视频比例");
    if (!["16:9", "4:3", "1:1", "3:4", "9:16", "21:9", "adaptive"].includes(ratio)) throw new Error("视频比例不支持");
    if (content.some(item => item.role === "first_frame" || item.role === "last_frame") && ratio !== "adaptive")
      throw new Error("Seedance 2.5 首帧/首尾帧模式的比例必须设为 adaptive，输出画幅跟随首帧；需要固定画幅时请调整首帧图片或使用参考图模式");
    if (typeof request.generateAudio !== "boolean") throw new Error("请显式设置是否生成音频");
    const model = this.config.videoModel?.trim() || request.model;
    if (!/^ep-[a-zA-Z0-9-]+$/.test(model) && !/^doubao-seedance-2-5-/.test(model)) throw new Error("当前长视频适配仅用于 Seedance 2.5 或其同能力推理接入点，不能隐藏替换成其他型号");
    const requested = { model, duration, resolution, ratio, generateAudio: request.generateAudio };
    const signal = AbortSignal.any([AbortSignal.timeout(30 * 60_000), ...(this.signal ? [this.signal] : [])]);
    const task = await requestJson(this, "/contents/generations/tasks", signal, {
      model, content, duration, resolution, ratio, output_format: "mp4",
      ...(Array.isArray(mode) ? { omni_reference_task_type: "reference" } : {}),
      generate_audio: request.generateAudio, watermark: request.watermark ?? false,
    });
    if (!task.id) throw new Error("火山方舟未返回任务 ID");
    while (true) {
      const result = await requestJson(this, `/contents/generations/tasks/${encodeURIComponent(task.id)}`, signal);
      if (result.status === "succeeded") {
        if (!result.content?.video_url) throw new Error("视频任务成功但未返回视频地址");
        const reported = { duration: result.duration, resolution: result.resolution, ratio: result.ratio, generateAudio: result.generate_audio };
        const warnings: string[] = [];
        // 官方查询 duration 向下取整；不足一秒的差异不能直接当作参数丢失。
        if (typeof result.duration === "number" && Math.abs(result.duration - duration) > 1) warnings.push(`请求 ${duration} 秒，平台返回约 ${result.duration} 秒，请检查实际视频时长`);
        if (result.resolution && result.resolution.toLowerCase() !== resolution) warnings.push(`请求 ${resolution}，平台返回 ${result.resolution}`);
        if (ratio !== "adaptive" && result.ratio && result.ratio !== ratio) warnings.push(`请求画幅 ${ratio}，平台返回 ${result.ratio}`);
        if (typeof result.generate_audio === "boolean" && result.generate_audio !== request.generateAudio) warnings.push("平台返回的音频开关与请求不一致");
        return [{ mediaType: "video", type: "url", url: result.content.video_url, generation: { taskId: task.id, requested, reported, warnings } }];
      }
      if (!["queued", "running"].includes(result.status ?? "")) throw new Error(`视频任务结束或状态异常：${result.status ?? "unknown"}`);
      await wait(signal);
    }
  },
} satisfies ProviderDefinition<typeof rules>;

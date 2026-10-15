# Lu aiTV Git 基线

## 来源与分支

- 官方仓库（远程别名 `upstream`）：https://github.com/HBAI-Ltd/Toonflow-app.git
- 个人 Fork（远程别名 `origin`）：https://github.com/wein99/upstream.git
- 原始基线：`d2e94aca7b59659ff6b4ca15f03cf134ec7f0e1d`，2026-10-13，提交说明「更新README」。
- 版本关系：官方 v2.0.6 标签位于 `c6756b9`，当前源码基线位于其后一次 README 更新。
- 基线核对：将修改前备份还原后，868 个原始文件与该提交完全对应；比较时兼容 Windows CRLF 与 LF 换行。
- 定制分支：`codex/lu-aitv`；本地及个人仓库的基线标签为 `baseline/toonflow-d2e94ac`。
- 仓库名称虽然叫 upstream，仍是自己的 origin；远程别名与 GitHub 仓库名称相互独立。

## 已有定制

1. 默认语言模型 DeepSeek，媒体模型通过火山方舟官方 API 接入。
2. 视频 4～30 秒、分辨率、画幅、声音参数及画布/Agent 传递与结果规格提示。
3. Lu aiTV 名称、LU 图标及原生书写启动动画。
4. 锁文件旧淘宝下载地址替换为 npm 官方 HTTPS 地址，依赖版本及校验值保留。

细节见 localModels.md 和 luBranding.md。保留官方 LICENSE 和来源说明。

## 日常保存

在项目目录修改后先审阅差异，再按需要提交和推送：

```sh
git status
git diff
git add <本次修改的文件>
git commit -m "说明本次具体修改"
git push origin codex/lu-aitv
```

不提交 API Key、`.env`、运行数据、依赖、构建产物或签名凭据。提交前检查暂存文件；已有 .gitignore 已排除常用目录与密钥格式。

## 后续同步官方更新

先保存本地工作，再取官方更新并阅读变化。不要直接将当前定制分支重置到官方分支。

```sh
git fetch upstream --tags
git log --oneline HEAD..upstream/master
git diff HEAD...upstream/master --stat
git switch -c codex/update-toonflow
git merge upstream/master
```

在更新分支处理冲突，重点核对默认供应商、参数链、启动动画、品牌资源和依赖变更。完成相关类型检查、构建与必要的实际验证，再合并回 codex/lu-aitv 并推送。类型检查若仍缺少原项目桌面 SDK，应如实记录，不能把构建通过当作真实云端生成或真机安装验证。

`baseline/toonflow-d2e94ac` 保持固定，未来可为新的官方基线另外创建标签，保留来源轨迹。

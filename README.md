# 答题系统（GitHub Pages 静态站点）

学号+姓名登录 → 选择单元（点击单元名称进入对应题库）→ 逐题作答 → 提交后查看成绩与每题正确答案。

## 部署到 GitHub Pages

1. 新建/使用一个 Public 仓库（例如 `SUN-quiz`）。
2. 将本目录所有文件上传到仓库**根目录**（`index.html`、`style.css`、`script.js` 要在根目录，`data/` 文件夹保持原样）。
3. Settings → Pages → Source 选 `Deploy from a branch` → 分支 `main`、目录 `/ (root)` → Save。
4. 访问 `https://用户名.github.io/仓库名/`。

## 更新题库

1. 网站底部/单元页点「题库管理」，密码默认 `admin2026`（在 script.js 顶部 `ADMIN_PASSWORD` 可改）。
2. 下载题库模板 xlsx，按格式填写（列：题干、选项A、选项B、选项C、选项D、答案；单选填 `A`，多选填 `ABD`）。
3. 选择目标单元 → 上传 xlsx → 解析预览 → 下载 `unitX.json`。
4. 到仓库 `data/` 目录，Add file → Upload files 覆盖同名文件 → Commit，1~2 分钟后生效。

## 说明

- 单元总数：`script.js` 顶部 `UNITS` 常量（默认 8，改数字即可）。
- `data/unit1.json ~ unit8.json` 目前是示例题，导入正式题库时直接覆盖。
- 答题记录保存在答题者浏览器本地（按学号区分）。

## 本地运行（可选）

```
cd sun-quiz
python -m http.server 8123
# 打开 http://localhost:8123
```

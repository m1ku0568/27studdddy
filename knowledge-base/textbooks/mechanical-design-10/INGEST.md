# 《机械设计》第十版：私有全文导入指南

## 目前状态
- 已记录教材书名和第十版信息。
- 已有45条来源于试卷的知识点作为索引锚点。
- **没有收到可读取的教材正文PDF**，目前无法核对教材原始目录、章号和印刷页码。
- 可选中文字的50MB—100MB PDF适合按页导出；不必先做OCR。

## 推荐方案：用户本机或经授权的私有空间处理，不上传 Public GitHub
1. 本地将PDF直接提取为UTF-8文本，保留分页符。例如已安装 Poppler 时：
   ```bash
   pdftotext -layout -enc UTF-8 "机械设计第十版.pdf" "private-textbook-data/md10.txt"
   ```
2. 如果没有 `pdftotext`，可使用 PyMuPDF 按页提取文本，写入同一个UTF-8文件。保留 `\f` 分页符以追踪PDF页序。
3. 运行：
   ```bash
   node scripts/ingest-textbook-text.mjs private-textbook-data/md10.txt
   ```
4. 脚本会生成 `private-textbook-data/md10-chunks.json`，默认按PDF页及短文本块拆分；这些文件已在 .gitignore 中排除，不会进入公开仓库。
5. 先核对目录页、章节标题与印刷页码的对应关系，再为考点补全准确章节与页码。不能仅凭PDF阅读器页码填写印刷页码。
6. 公开仓库只更新经过核实的**自写知识摘要和索引元数据**，不公开完整教材正文。全文只存在本地/经授权私有存储，并在需要时由ChatGPT读取相关小片段。

## 后续文件
若你将教材分卷、按章或导出文本提供给ChatGPT，我可以继续提取目录、公式和术语的索引与页码关系。不要将未经授权的整本书上传到此公共仓库。

## 版本和来源区分
- 真实教材章节、页码：`verifiedAgainstTextbook=true` 并附PDF页码与印刷页码的核查结果。
- 试卷知识点拟合：`verifiedAgainstTextbook=false`，即使知识点看似正确也不能伪造页码。

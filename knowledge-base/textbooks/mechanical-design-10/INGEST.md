# 第十版扫描教材的分页导入

在仓库根目录运行。公开索引提供 18 章、目录小节和优先检索范围，可直接搜索。目录来源和扫描件 SHA-256 记录在 page-index.json。正文印刷页 3–438 对应 PDF 14–449；封面、目录、附录等可直接按 PDF 页选择。

```sh
node scripts/knowledge-search.mjs "应力比"
node scripts/knowledge-search.mjs "螺栓 预紧力"
```

## 复用已有识别结果

安装 Python 3.9+。将原始 PDF 与《机械设计第十版_逐页OCR检索.jsonl》放在本地。本例假定都放在已被 git 忽略的 private-textbook-data 下。可先导入第 3 章，也可去掉选择条件复用整份草稿。文件名可变，内容指纹须匹配。

```sh
python3 scripts/scan-textbook.py reuse "private-textbook-data/机械设计第十版_逐页OCR检索.jsonl" --chapter 3
python3 scripts/scan-textbook.py status --printed 27-38
python3 scripts/scan-textbook.py search "对称循环" --chapter 3
```

每个阅读器页在私有 SQLite 库中最多一条 OCR 草稿。已有页自动跳过，页码占位行被排除。status 分列已入库草稿、已目视分类的空白或篇扉页、剩余待处理页。OCR 字符可能错漏；仅有很少字符的草稿也应查看原图。公开 metadata.json 的 ingestedPdfPages、ingestedTextChunks 统计仓库内的正文；privateArchiveSnapshot 记录本次私有验收数字。当前本机数字以 status 为准。

## 只对指定页运行 OCR

另需 Poppler 的 pdftoppm、Tesseract 及 chi_sim、eng 语言数据。命令按一页一次渲染，不生成整书图片。可用 --chapter、--printed、--pdf-pages 三者之一。中途失败保留已完成页；重跑同一命令即可。主动纠正劣质草稿时，仅对目标页加 --redo。失败不会覆盖旧草稿。已分类的空白和篇扉页自动跳过。

```sh
python3 scripts/scan-textbook.py ocr "private-textbook-data/机械设计  第10版_14743852.pdf" --printed 27-29
python3 scripts/scan-textbook.py ocr "private-textbook-data/机械设计  第10版_14743852.pdf" --pdf-pages 337 --redo
```

## 原页核验

先查目录，再用私有草稿定位。第 3 章先核对循环应力的符号，第 5 章区分装配预紧力与工作载荷，第 10 章核对齿轮受力和强度计算条件。打开相应阅读器页，核对页脚、标题、上下标、系数、单位与适用条件；只将核清的独立条目、自写摘要、双页码和页内位置写入 reviewed-items.json。某条通过核验仅覆盖该条。现有试卷来源与公式档案保留其证据状态。

旧版 UTF-8 TXT 分块入口仍为 node scripts/ingest-textbook-text.mjs。其分页取决于输入中的换页符，不能用来推定本扫描件的原页位置。

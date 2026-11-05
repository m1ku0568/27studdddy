# 考研机械设计知识库（初版）

> **当前状态：已导入45个试卷考点、15条公式记录、11条易混点；教材正文尚未提供。**

此仓库是公开的结构化学习知识索引，供 ChatGPT 读取并完成：
- OCR残缺文本 → 候选考点匹配
- 考点 → 相关公式和易混概念
- 考点 → 濮良贵等《机械设计》第十版的*候选主题*（准确章号/页码待教材全文核实）
- 生成 Quiz 变式时保留来源、题号、证据等级

## 数据目录
- `index.json`：轻量化知识点列表，可先读后精读
- `mechanical-design/topics.json`：试题4与试题5的45条考点映射
- `mechanical-design/formulas.json`：从既有Quiz解析提取的公式与适用条件（待核对教材）
- `mechanical-design/confusions.json`：易混辨析
- `textbooks/mechanical-design-10/metadata.json`：教材登记及**主题索引**，不是正式目录
- `textbooks/mechanical-design-10/INGEST.md`：本地导入教材方法
- `EVIDENCE_POLICY.md`：原文、推断和不确定性分离规范

## 搜索示例
```bash
node scripts/knowledge-search.mjs "螺栓 预紧力"
node scripts/knowledge-search.mjs "齿轮 模数 疲劳"
node scripts/knowledge-search.mjs "轴承 寿命"
```

## 重要限制
本仓库不是教材的正版电子书镜像。由于教材PDF目前并未在可访问附件中，未提取真实教材章节页码；所有 `textbook.verifiedAgainstTextbook` 为 false。不要从题库记录反向声称已核对教材正文。后续需要原始可搜索 PDF，经本地私有导入和逐章核验后更新章节映射。

公开仓库不得提交用户个人答题数据，也不要直接提交完整教材PDF或全文复制内容。

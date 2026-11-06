# 考研机械专业课知识库

> **当前状态：已导入45个试卷考点、15条公式记录、11条易混点；扫描教材已建目录索引；逐页 OCR 私有保存。**

此仓库是公开的结构化学习知识索引，供 ChatGPT 读取并完成：
- OCR残缺文本 → 候选考点匹配
- 考点 → 相关公式和易混概念
- 考点 → 濮良贵等《机械设计》第十版的*候选主题*（可查章号、目录页段及已核实条目）
- 生成 Quiz 变式时保留来源、题号、证据等级

机械原理参考书另见[《机械原理学习指导》第 3 版检索指南](textbooks/mechanisms-guide-3/README.md)，可按全书目录、自测题号或原页核实条目定位。

## 数据目录
- `index.json`：轻量化知识点列表，可先读后精读
- `mechanical-design/topics.json`：试题4与试题5的45条考点映射
- `mechanical-design/formulas.json`：从既有Quiz解析提取的公式与适用条件（待核对教材）
- `mechanical-design/confusions.json`：易混辨析
- `textbooks/mechanical-design-10/metadata.json`：教材登记与私有导入快照；同目录 page-index.json 提供章节和页段
- `textbooks/mechanical-design-10/INGEST.md`：本地导入教材方法
- `EVIDENCE_POLICY.md`：原文、推断和不确定性分离规范

## 搜索示例
```bash
node scripts/knowledge-search.mjs "螺栓 预紧力"
node scripts/knowledge-search.mjs "齿轮 模数 疲劳"
node scripts/knowledge-search.mjs "轴承 寿命"
```

## 重要限制
目录定位、OCR 搜索命中和原页核实分别记录。试卷考点仍保留其原始出处。查阅具体公式时，优先使用 reviewed-items.json 中已目视核对的条目。

公开仓库不得提交用户个人答题数据，也不要直接提交完整教材PDF或全文复制内容。

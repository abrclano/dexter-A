# Dexter 🤖

[English](./README.md) | [中文](./README.zh.md)

> Fork 自 [virattt/dexter](https://github.com/virattt/dexter)。本版本在原版基础上增加了对 **A 股（中国股票市场）的支持**。

Dexter 是一个自主金融研究 Agent，能够边思考、边规划、边学习。它通过任务规划、自我反思和实时市场数据完成分析工作。可以把它理解为专为金融研究打造的 Claude Code。

<img width="1098" height="659" alt="Screenshot 2026-01-21 at 5 25 10 PM" src="https://github.com/user-attachments/assets/3bcc3a7f-b68a-4f5e-8735-9d22196ff76e" />

## 目录

- [👋 概述](#-概述)
- [✅ 前置条件](#-前置条件)
- [💻 安装](#-安装)
- [🚀 运行](#-运行)
- [📊 评估](#-评估)
- [🐛 调试](#-调试)
- [📱 WhatsApp 接入](#-whatsapp-接入)
- [🤝 贡献](#-贡献)
- [📄 许可证](#-许可证)


## 👋 概述

Dexter 能将复杂的金融问题转化为清晰的、分步骤的研究计划，利用实时市场数据执行任务，自我校验结果，持续迭代直到给出有数据支撑的可靠答案。

**核心能力：**
- **智能任务规划**：自动将复杂查询拆解为结构化的研究步骤
- **自主执行**：自动选择并调用合适的工具获取金融数据
- **自我验证**：检查自身工作并持续迭代直到任务完成
- **实时金融数据**：获取利润表、资产负债表和现金流量表
- **A 股支持**：查询 A 股数据（历史行情、基本面、财务报表）
- **安全机制**：内置循环检测和步骤上限，防止失控执行

<img width="1042" height="638" alt="Screenshot 2026-02-18 at 12 21 25 PM" src="https://github.com/user-attachments/assets/2a6334f9-863f-4bd2-a56f-923e42f4711e" />


## ✅ 前置条件

- [Bun](https://bun.com) 运行时（v1.0 或更高）
- OpenAI API Key（[获取地址](https://platform.openai.com/api-keys)）
- Financial Datasets API Key（[获取地址](https://financialdatasets.ai)）— 用于美股数据
- Tushare API Key（[注册地址](https://tushare.pro/register)）— 用于 A 股数据
- East Money MX API Key （[注册地址](https://marketing.dfcfs.com/views/finskillshub/)）— 用于 A 股数据
- Exa API Key（[获取地址](https://exa.ai)）— 可选，用于网络搜索

#### 安装 Bun

**macOS/Linux：**
```bash
curl -fsSL https://bun.com/install | bash
```

**Windows：**
```bash
powershell -c "irm bun.sh/install.ps1|iex"
```

安装完成后重启终端，验证安装：
```bash
bun --version
```

## 💻 安装

1. 克隆仓库：
```bash
git clone https://github.com/virattt/dexter.git
cd dexter
```

2. 安装依赖：
```bash
bun install
```

3. 配置环境变量：
```bash
# 复制示例环境文件
cp env.example .env

# 编辑 .env，填入你的 API Keys
# OPENAI_API_KEY=your-openai-api-key
# ANTHROPIC_API_KEY=your-anthropic-api-key（可选）
# GOOGLE_API_KEY=your-google-api-key（可选）
# XAI_API_KEY=your-xai-api-key（可选）
# OPENROUTER_API_KEY=your-openrouter-api-key（可选）

# 美股机构级行情数据；AAPL、NVDA、MSFT 免费
# FINANCIAL_DATASETS_API_KEY=your-financial-datasets-api-key

# A 股行情数据
# Tushare API Key
# TUSHARE_API_KEY=your-tushare-api-key
# East Money MX API Key
# MX_APIKEY=your-eastmoneymx-api-key

# 本地 Ollama（可选）
# OLLAMA_BASE_URL=http://127.0.0.1:11434

# 网络搜索（优先 Exa，备选 Tavily）
# EXASEARCH_API_KEY=your-exa-api-key
# TAVILY_API_KEY=your-tavily-api-key
```

## 🇨🇳 A 股支持

本 Fork 集成了 [Tushare](https://tushare.pro) 以及 [EastMoney MX](https://marketing.dfcfs.com/views/finskillshub/)，支持对上交所和深交所 A 股上市公司进行研究分析。

**支持的功能：**
- 查询 A 股日/周/月 K 线数据（如 `000001.SZ`、`600519.SH`）
- 获取基本面数据：市盈率、市净率、市值、换手率
- 获取财务报表：利润表、资产负债表、现金流量表
- 查询公司基本信息和行业分类

**配置步骤：**
1. 在 [tushare.pro](https://tushare.pro/register) 注册并获取 API Key
2. 添加到 `.env` 文件：
   ```
   TUSHARE_API_KEY=your-tushare-api-key
   ```
3. 配置 Key 后，`tushare_search` 工具将自动启用

**示例查询：**
- "贵州茅台最近一年的营收和净利润趋势如何？"
- "对比 600519.SH 和 000858.SZ 的市盈率"
- "比亚迪（002594.SZ）当前市值是多少？"

完整的接口列表和开发者指南，请参阅 [Tushare 模块文档](src/tools/finance/tushare/README.zh.md)。

### 东方财富妙想（EastMoney MX）— 高级金融数据

**东方财富妙想**集成了东方财富权威数据库的实时行情和机构级金融数据：

**支持的功能：**
- 查询股票、指数、基金、债券等实时行情数据
- 获取完整的财务报表和上市公司基本面数据
- 检索公司、股东、高管之间的关联关系信息
- 搜索行业分析和估值指标
- 提取企业经营信息和融资详情

**配置步骤：**
1. 从 [东方财富妙想数据平台](https://marketing.dfcfs.com/views/finskillshub/) 获取 API Key
2. 添加到 `.env` 文件：
   ```
   MX_APIKEY=your-eastmoney-mx-api-key
   ```
3. 配置 Key 后，`EastMoney MX(data, search, self-select, simulator)` skill 将自动启用

**示例查询：**
- "获取 600519.SH 的最新股价和行情数据"
- "主要科技公司最新的财务指标和市盈率是多少？"
- "获取制药行业上市公司的资产负债表数据"
- "查找公司 002594.SZ 的高管和股东信息"

**输出格式：**
- Excel 文件，包含多个 sheet 便于数据可视化
- JSON 格式，支持程序化访问
- 文本描述总结查询结果

详细的 API 文档和使用示例，请访问 [东方财富妙想文档](https://marketing.dfcfs.com/views/finskillshub/)。

## 🚀 运行

以交互模式运行 Dexter：
```bash
bun start
```

开发模式（热重载）：
```bash
bun dev
```

## 📊 评估

Dexter 内置评估套件，可针对金融问题数据集测试 Agent 表现。评估使用 LangSmith 追踪，并采用 LLM-as-judge 方式评分。

**运行全量评估：**
```bash
bun run src/evals/run.ts
```

**随机抽样评估：**
```bash
bun run src/evals/run.ts --sample 10
```

评估运行器会实时展示进度、当前问题和准确率统计，结果记录到 LangSmith 供后续分析。

## 🐛 调试

Dexter 将所有工具调用记录到 scratchpad 文件，便于调试和历史追踪。每次查询会在 `.dexter/scratchpad/` 下生成一个新的 JSONL 文件。

**文件位置：**
```
.dexter/scratchpad/
├── 2026-01-30-111400_9a8f10723f79.jsonl
├── 2026-01-30-143022_a1b2c3d4e5f6.jsonl
└── ...
```

每个文件包含以下类型的 JSON 条目：
- **init**：原始查询
- **tool_result**：每次工具调用的参数、原始结果和 LLM 摘要
- **thinking**：Agent 推理步骤

**示例条目：**
```json
{"type":"tool_result","timestamp":"2026-01-30T11:14:05.123Z","toolName":"get_income_statements","args":{"ticker":"AAPL","period":"annual","limit":5},"result":{...},"llmSummary":"Retrieved 5 years of Apple annual income statements showing revenue growth from $274B to $394B"}
```

## 📱 WhatsApp 接入

通过 WhatsApp 与 Dexter 对话，将手机与网关绑定后，发给自己的消息会由 Dexter 处理并回复。

**快速开始：**
```bash
# 绑定 WhatsApp 账号（扫描二维码）
bun run gateway:login

# 启动网关
bun run gateway
```

打开 WhatsApp，进入"给自己发消息"的对话，向 Dexter 提问即可。

详细配置说明和故障排查请参阅 [WhatsApp Gateway README](src/gateway/channels/whatsapp/README.md)。

## 🤝 贡献

1. Fork 本仓库
2. 创建功能分支
3. 提交你的更改
4. 推送到分支
5. 创建 Pull Request

**注意**：请保持 PR 小而专注，这样更容易审查和合并。


## 📄 许可证

本项目基于 MIT 许可证开源。

/**
 * Eastmoney financial data search tool
 *
 * Routes natural language queries to the Eastmoney API using Python script.
 */

import { DynamicStructuredTool } from '@langchain/core/tools';
import type { RunnableConfig } from '@langchain/core/runnables';
import { z } from 'zod';
import { spawn } from 'child_process';
import { join } from 'path';
import { formatToolResult } from '../../../types.js';

const EastmoneySearchSchema = z.object({
  query: z.string().describe('Natural language query for financial data (e.g., "东方财富最新价", "股票行情", "财务数据")'),
});

export const EASTMONEY_DATA_DESCRIPTION = `
Search Chinese financial data using Eastmoney's API. Supports stock prices, financial statements, and company information.

Based on Eastmoney's authoritative database and latest market data, this tool supports natural language queries for three types of data:

1. **Market Data**
   Real-time quotes, main capital flows, valuations for stocks, industries, sectors, indices, funds, and bonds.

2. **Financial Data**
   Basic information, financial indicators, executive information, main business, shareholder structure, and financing for listed and unlisted companies.

3. **Relationship & Operations Data**
   Relationship data between stocks, unlisted companies, shareholders and executives, plus enterprise operations data.

## When to Use

- For Chinese A-share market data and financial statements
- When you need authoritative, up-to-date financial data from Eastmoney
- For queries about company fundamentals, valuations, and relationships

## When NOT to Use

- For non-Chinese markets (use other financial tools)
- For real-time trading (this is for research/analysis)

## Output

- Excel file with multiple sheets (.xlsx)
- Text description file
- Raw JSON data from API

## Environment

- Requires MX_APIKEY environment variable.
`;

export const EASTMONEY_SEARCH_DESCRIPTION = `
Search Chinese financial news and information using Eastmoney's API. Supports news, announcements, research reports, and policy information.

Based on Eastmoney's intelligent search capabilities with financial scenario source filtering, this tool retrieves timely information and specific event data including news, announcements, research reports, policies, trading rules, specific events, impact analysis, and non-common knowledge requiring external data retrieval.

## When to Use

- For Chinese financial news and announcements
- When you need authoritative, timely financial information from Eastmoney
- For research reports, policy updates, and market analysis
- To avoid AI referencing non-authoritative or outdated financial information

## When NOT to Use

- For non-Chinese financial markets
- For general web search (use web_search tool)
- For real-time trading decisions

## Output

- Extracted plain text results (.txt)
- Raw JSON data from API

## Environment
- Requires MX_APIKEY environment variable.
`;

export const EASTMONEY_SELFSELECT_DESCRIPTION = `
Manage self-selected stocks and portfolios using Eastmoney's API. Supports adding/removing stocks from watchlists and portfolio management.

Based on Eastmoney passport account data and underlying market data, this tool supports natural language queries, adding, and deleting stocks from self-selected lists.

## Features

- Query my self-selected stock list
- Add specified stocks to my self-selected list
- Remove specified stocks from my self-selected list

## When to Use

- For managing personal stock watchlists
- When you need to track specific stocks of interest
- For portfolio organization and monitoring

## When NOT to Use

- For trading operations (use stock simulator tool)
- For general market data (use data tool)

## Output

- Self-selected stock list in CSV format
- Raw JSON data from API

## Environment
- Requires MX_APIKEY environment variable.
`;

export const EASTMONEY_STOCK_SIMULATOR_DESCRIPTION = `
Stock trading simulation using Eastmoney's API. Supports virtual trading, portfolio simulation, and investment strategy testing.

Provides a stock portfolio simulation management system supporting position queries, buy/sell operations, order cancellation, order queries, historical transaction queries, and capital queries. Implements real trading experience through secure API interfaces.

## Features

- Position queries
- Buy/sell operations
- Order cancellation
- Order queries
- Historical transaction queries
- Capital/funds queries

## When to Use

- For practicing stock trading skills
- To test investment strategies virtually
- For learning trading operations without real money
- For portfolio simulation and analysis

## When NOT to Use

- For real money trading
- For investment advice or decision making
- For non-A-share markets (futures, forex, HK stocks, US stocks)

## Environment
- Requires MX_APIKEY environment variable.
`;

/**
 * Execute the Python script for Eastmoney data query
 */
async function executeEastmoneyQuery(query: string, skill: string = 'mx-data'): Promise<{ success: boolean; data?: any; error?: string }> {
  return new Promise((resolve) => {
    const scriptPath = join(process.cwd(), 'src', 'skills', 'eastmoney', skill, `${skill.replace('-', '_')}.py`);
    const pythonCommand = process.env.PYTHON_COMMAND || (process.platform === 'win32' ? 'python' : 'python3');

    const pythonProcess = spawn(pythonCommand, [scriptPath, query], {
      env: { ...process.env, MX_APIKEY: process.env.MX_APIKEY },
      cwd: process.cwd(),
    });

    let stdout = '';
    let stderr = '';

    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    pythonProcess.on('close', (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(stdout);
          resolve({ success: true, data: result });
        } catch (e) {
          resolve({ success: true, data: stdout });
        }
      } else {
        resolve({ success: false, error: stderr || `Process exited with code ${code}` });
      }
    });

    pythonProcess.on('error', (error) => {
      resolve({ success: false, error: error.message });
    });
  });
}

export function createEastmoneySearch(model: string, skill: string = 'mx-data'): DynamicStructuredTool {
  const skillName = skill.replace('-', '_');
  const displayName = skill === 'mx-data' ? 'Data' : skill === 'mx-search' ? 'Search' : skill.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());

  return new DynamicStructuredTool({
    name: `eastmoney_${skillName}`,
    description: `Search Chinese financial ${displayName.toLowerCase()} using Eastmoney's API.`,
    schema: EastmoneySearchSchema,
    func: async (input, _runManager, config?: RunnableConfig) => {
      const onProgress = config?.metadata?.onProgress as ((msg: string) => void) | undefined;

      onProgress?.(`Querying Eastmoney ${displayName}...`);

      const result = await executeEastmoneyQuery(input.query, skill);

      if (!result.success) {
        return formatToolResult(
          {
            error: 'Failed to query Eastmoney API',
            details: result.error,
            query: input.query,
          },
          []
        );
      }

      onProgress?.(`${displayName} data retrieved successfully`);

      return formatToolResult(
        {
          query: input.query,
          result: result.data,
          note: `Data saved to .dexter/mx_data/output/ directory`,
        },
        []
      );
    },
  });
}
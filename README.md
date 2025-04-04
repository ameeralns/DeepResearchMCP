# DeepResearch MCP

<div align="center">
  
![DeepResearch Logo](https://img.shields.io/badge/DeepResearch-MCP-blue?style=for-the-badge)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![OpenAI](https://img.shields.io/badge/OpenAI-412991?style=for-the-badge&logo=openai&logoColor=white)](https://openai.com/)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)](https://nodejs.org/)

</div>

## 📚 Overview

DeepResearch MCP is a powerful research assistant built on the Model Context Protocol (MCP). It conducts intelligent, iterative research on any topic through web searches, analysis, and comprehensive report generation.

### 🌟 Key Features

- **Intelligent Topic Exploration** - Automatically identifies knowledge gaps and generates focused search queries
- **Comprehensive Content Extraction** - Enhanced web scraping with improved content organization
- **Structured Knowledge Processing** - Preserves important information while managing token usage
- **Scholarly Report Generation** - Creates detailed, well-structured reports with executive summaries, analyses, and visualizations
- **Complete Bibliography** - Properly cites all sources with numbered references
- **Adaptive Content Management** - Automatically manages content to stay within token limits
- **Error Resilience** - Recovers from errors and generates partial reports when full processing isn't possible

## 🛠️ Architecture

<div align="center">
  
```
┌────────────────────┐     ┌─────────────────┐     ┌────────────────┐
│                    │     │                 │     │                │
│  MCP Server Layer  ├────►│ Research Service├────►│ Search Service │
│  (Tools & Prompts) │     │ (Session Mgmt)  │     │  (Firecrawl)   │
│                    │     │                 │     │                │
└────────────────────┘     └─────────┬───────┘     └────────────────┘
                                     │
                                     ▼
                           ┌─────────────────┐
                           │                 │
                           │  OpenAI Service │
                           │ (Analysis/Rpt)  │
                           │                 │
                           └─────────────────┘
```

</div>

## 💻 Installation

### Installing via Smithery

To install DeepResearch for Claude Desktop automatically via [Smithery](https://smithery.ai/server/@ameeralns/DeepResearchMCP):

```bash
npx -y @smithery/cli install @ameeralns/DeepResearchMCP --client claude
```

### Prerequisites

- Node.js 18 or higher
- OpenAI API key
- Firecrawl API key

### Setup Steps

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd deep-research-mcp
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit the `.env` file and add your API keys:
   ```
   OPENAI_API_KEY=sk-your-openai-api-key
   FIRECRAWL_API_KEY=your-firecrawl-api-key
   ```

4. **Build the project**
   ```bash
   npm run build
   ```

## 🚀 Usage

### Running the MCP Server

Start the server on stdio for MCP client connections:

```bash
npm start
```

### Using the Example Client

Run research on a specific topic with a specified depth:

```bash
npm run client "Your research topic" 3
```

Parameters:
- First argument: Research topic or query
- Second argument: Research depth (number of iterations, default: 2)
- Third argument (optional): "complete" to use the complete-research tool (one-step process)

Example:
```bash
npm run client "the impact of climate change on coral reefs" 3 complete
```

### Example Output

The DeepResearch MCP will produce a comprehensive report that includes:

- **Executive Summary** - Concise overview of the research findings
- **Introduction** - Context and importance of the research topic
- **Methodology** - Description of the research approach
- **Comprehensive Analysis** - Detailed examination of the topic
- **Comparative Analysis** - Visual comparison of key aspects
- **Discussion** - Interpretation of findings and implications
- **Limitations** - Constraints and gaps in the research
- **Conclusion** - Final insights and recommendations
- **Bibliography** - Complete list of sources with URLs

## 🔧 MCP Integration

### Available MCP Resources

| Resource Path | Description |
|--------------|-------------|
| `research://state/{sessionId}` | Access the current state of a research session |
| `research://findings/{sessionId}` | Access the collected findings for a session |

### Available MCP Tools

| Tool Name | Description | Parameters |
|-----------|-------------|------------|
| `initialize-research` | Start a new research session | `query`: string, `depth`: number |
| `execute-research-step` | Execute the next research step | `sessionId`: string |
| `generate-report` | Create a final report | `sessionId`: string, `timeout`: number (optional) |
| `complete-research` | Execute the entire research process | `query`: string, `depth`: number, `timeout`: number (optional) |

## 🖥️ Claude Desktop Integration

DeepResearch MCP can be integrated with Claude Desktop to provide direct research capabilities to Claude.

### Configuration Steps

1. **Copy the sample configuration**
   ```bash
   cp claude_desktop_config_sample.json ~/path/to/claude/desktop/config/directory/claude_desktop_config.json
   ```

2. **Edit the configuration file**
   
   Update the path to point to your installation of deep-research-mcp and add your API keys:

   ```json
   {
     "mcpServers": {
       "deep-research": {
         "command": "node",
         "args": [
           "/absolute/path/to/your/deep-research-mcp/dist/index.js"
         ],
         "env": {
           "FIRECRAWL_API_KEY": "your-firecrawler-api-key",
           "OPENAI_API_KEY": "your-openai-api-key"
         }
       }
     }
   }
   ```

3. **Restart Claude Desktop**
   
   After saving the configuration, restart Claude Desktop for the changes to take effect.

4. **Using with Claude Desktop**
   
   Now you can ask Claude to perform research using commands like:
   
   ```
   Can you research the impact of climate change on coral reefs and provide a detailed report?
   ```

## 📋 Sample Client Code

```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function main() {
  // Connect to the server
  const transport = new StdioClientTransport({
    command: "node",
    args: ["dist/index.js"]
  });

  const client = new Client({ name: "deep-research-client", version: "1.0.0" });
  await client.connect(transport);

  // Initialize research
  const initResult = await client.callTool({
    name: "initialize-research",
    arguments: {
      query: "The impact of artificial intelligence on healthcare",
      depth: 3
    }
  });
  
  // Parse the response to get sessionId
  const { sessionId } = JSON.parse(initResult.content[0].text);
  
  // Execute steps until complete
  let currentDepth = 0;
  while (currentDepth < 3) {
    const stepResult = await client.callTool({
      name: "execute-research-step",
      arguments: { sessionId }
    });
    
    const stepInfo = JSON.parse(stepResult.content[0].text);
    currentDepth = stepInfo.currentDepth;
    
    console.log(`Completed step ${stepInfo.currentDepth}/${stepInfo.maxDepth}`);
  }
  
  // Generate final report with timeout
  const report = await client.callTool({
    name: "generate-report",
    arguments: { 
      sessionId,
      timeout: 180000 // 3 minutes timeout
    }
  });
  
  console.log("Final Report:");
  console.log(report.content[0].text);
}

main().catch(console.error);
```

## 🔍 Troubleshooting

### Common Issues

- **Token Limit Exceeded**: For very large research topics, you may encounter OpenAI token limit errors. Try:
  - Reducing the research depth
  - Using more specific queries
  - Breaking complex topics into smaller sub-topics

- **Timeout Errors**: For complex research, the process may time out. Solutions:
  - Increase the timeout parameters in tool calls
  - Use the `complete-research` tool with a longer timeout
  - Process research in smaller chunks

- **API Rate Limits**: If you encounter rate limit errors from OpenAI or Firecrawl:
  - Implement a delay between research steps
  - Use an API key with higher rate limits
  - Retry with exponential backoff

## 📝 License

ISC

## 🙏 Acknowledgements

- Built with [Model Context Protocol](https://github.com/mhuggins7278/model-context-protocol)
- Powered by [OpenAI](https://openai.com/) and [Firecrawl](https://firecrawl.dev/)

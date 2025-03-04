import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import * as crypto from 'crypto';
import dotenv from 'dotenv';

// Import our services
import { initializeResearch, executeResearchStep, getResearchState, generateResearchReport } from './services/research.js';
import { ResearchReport } from './types/index.js';

// Load environment variables
dotenv.config();

// Create MCP server
const server = new McpServer({
  name: process.env.MCP_SERVER_NAME || 'DeepResearch',
  version: process.env.MCP_SERVER_VERSION || '1.0.0'
});

// Resource to access research state
server.resource(
  'research-state',
  new ResourceTemplate('research://state/{sessionId}', { list: undefined }),
  async (uri, params) => {
    const sessionId = params.sessionId as string;
    const state = getResearchState(sessionId);
    if (!state) {
      throw new Error(`Research session not found: ${sessionId}`);
    }

    return {
      contents: [{
        uri: uri.href,
        text: JSON.stringify(state, null, 2)
      }]
    };
  }
);

// Resource to access research findings
server.resource(
  'research-findings',
  new ResourceTemplate('research://findings/{sessionId}', { list: undefined }),
  async (uri, params) => {
    const sessionId = params.sessionId as string;
    const state = getResearchState(sessionId);
    if (!state) {
      throw new Error(`Research session not found: ${sessionId}`);
    }

    return {
      contents: [{
        uri: uri.href,
        text: state.findings.join('\n\n---\n\n')
      }]
    };
  }
);

// Tool to initialize research
server.tool(
  'initialize-research',
  {
    query: z.string(),
    depth: z.number().default(3),
  },
  async ({ query, depth }) => {
    try {
      // Generate a unique session ID
      const sessionId = crypto.randomUUID();
      const state = initializeResearch(sessionId, query, depth);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ 
            sessionId, 
            message: 'Research session initialized',
            state 
          }, null, 2)
        }]
      };
    } catch (error) {
      console.error('Error initializing research:', error);
      return {
        content: [{
          type: 'text',
          text: `Error initializing research: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  }
);

// Tool to execute a research step
server.tool(
  'execute-research-step',
  {
    sessionId: z.string(),
  },
  async ({ sessionId }) => {
    try {
      const updatedState = await executeResearchStep(sessionId);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            message: 'Research step executed',
            currentDepth: updatedState.currentDepth,
            maxDepth: updatedState.depth,
            lastTopic: updatedState.topics[updatedState.topics.length - 1],
            nextTopic: updatedState.nextSearchTopic,
            shouldContinue: updatedState.shouldContinue,
            state: updatedState
          }, null, 2)
        }]
      };
    } catch (error) {
      console.error('Error executing research step:', error);
      
      // Get the current state, even if there was an error
      const currentState = getResearchState(sessionId);
      
      // If we have a valid state, return a properly formatted JSON response with the error
      if (currentState) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              message: `Error: ${error instanceof Error ? error.message : String(error)}`,
              currentDepth: currentState.currentDepth,
              maxDepth: currentState.depth,
              lastTopic: currentState.topics.length > 0 ? currentState.topics[currentState.topics.length - 1] : currentState.query,
              nextTopic: currentState.nextSearchTopic,
              shouldContinue: false, // Stop research on error
              state: currentState,
              error: true
            }, null, 2)
          }]
        };
      }
      
      // Fallback if we can't get the current state
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            message: `Error executing research step: ${error instanceof Error ? error.message : String(error)}`,
            error: true
          }, null, 2)
        }],
        isError: true
      };
    }
  }
);

// Tool to generate a final research report
server.tool(
  'generate-report',
  {
    sessionId: z.string(),
    timeout: z.number().optional().default(60000)
  },
  async ({ sessionId, timeout }) => {
    // Create a promise that rejects after the timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Report generation timed out')), timeout);
    });

    try {
      // Race the report generation against the timeout
      const report = await Promise.race([
        generateResearchReport(sessionId),
        timeoutPromise
      ]) as ResearchReport;
      
      return {
        content: [{
          type: 'text',
          text: report.report
        }]
      };
    } catch (error) {
      console.error('Error generating research report:', error);
      
      // Get the current state, even if there was an error
      const currentState = getResearchState(sessionId);
      
      // If we have a valid state, try to generate a basic report from what we have
      if (currentState && currentState.findings.length > 0) {
        return {
          content: [{
            type: 'text',
            text: `# Research Report (Error Recovery)\n\n` +
                  `**Original Query:** ${currentState.query}\n\n` +
                  `**Note:** This is a partial report generated after an error occurred: ${error instanceof Error ? error.message : String(error)}\n\n` +
                  `## Summary of Findings\n\n` +
                  `The research process collected ${currentState.findings.length} sets of findings ` +
                  `across ${currentState.topics.length} topics but encountered an error during the final report generation.\n\n` +
                  `### Topics Researched\n\n` +
                  currentState.topics.map((topic, index) => `${index + 1}. ${topic}`).join('\n')
          }]
        };
      }
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            message: `Error generating research report: ${error instanceof Error ? error.message : String(error)}`,
            error: true
          }, null, 2)
        }],
        isError: true
      };
    }
  }
);

// NEW TOOL: Complete Research in one step
server.tool(
  'complete-research',
  {
    query: z.string(),
    depth: z.number().default(3),
    timeout: z.number().optional().default(180000) // 3 minute timeout (same as client setting)
  },
  async ({ query, depth, timeout }) => {
    // Define and initialize sessionId in the outer scope
    const sessionId = crypto.randomUUID();
    
    try {
      // Step 1: Initialize research
      console.error(`Initializing research session for: "${query}" with depth ${depth}`);
      initializeResearch(sessionId, query, depth);
      console.error(`Research session initialized with ID: ${sessionId}`);
      
      // Step 2: Execute all research steps sequentially
      let currentDepth = 0;
      let stepData;
      
      while (currentDepth < depth) {
        console.error(`Executing research step ${currentDepth + 1}/${depth}...`);
        try {
          stepData = await executeResearchStep(sessionId);
          currentDepth = stepData.currentDepth;
          
          console.error(`Completed step ${currentDepth}/${depth}`);
          console.error(`Last topic searched: ${stepData.topics[stepData.topics.length - 1]}`);
          
          if (stepData.nextSearchTopic) {
            console.error(`Next topic to search: ${stepData.nextSearchTopic}`);
          } else {
            console.error(`No further topics to search.`);
          }
        } catch (stepError) {
          // Log the error but continue with next steps
          console.error(`Error in research step ${currentDepth + 1}: ${stepError}`);
          // Get the current state to determine the new depth
          const currentState = getResearchState(sessionId);
          if (currentState) {
            currentDepth = currentState.currentDepth;
          } else {
            // If we can't get the state, just increment manually
            currentDepth++;
          }
        }
      }
      
      // Step 3: Generate the final report with timeout handling
      console.error(`Generating final research report...`);
      
      // Create a promise that rejects after the timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Report generation timed out')), timeout);
      });
      
      // Race the report generation against the timeout
      const report = await Promise.race([
        generateResearchReport(sessionId),
        timeoutPromise
      ]) as ResearchReport;
      
      return {
        content: [{
          type: 'text',
          text: `# Complete Research Results for "${query}"\n\n` +
                `Research completed with depth: ${depth}\n\n` +
                `## Final Report\n\n${report.report}`
        }]
      };
    } catch (error) {
      console.error('Error in complete research process:', error);
      
      // Get the current state to generate a fallback report
      const currentState = getResearchState(sessionId);
      
      if (currentState && currentState.findings.length > 0) {
        return {
          content: [{
            type: 'text',
            text: `# Research Report (Error Recovery)\n\n` +
                  `**Original Query:** ${currentState.query}\n\n` +
                  `**Note:** This is a partial report generated after an error occurred: ${error instanceof Error ? error.message : String(error)}\n\n` +
                  `## Summary of Findings\n\n` +
                  `The research process collected ${currentState.findings.length} sets of findings ` +
                  `across ${currentState.topics.length} topics but encountered an error during the final report generation.\n\n` +
                  `### Topics Researched\n\n` +
                  currentState.topics.map((topic, index) => `${index + 1}. ${topic}`).join('\n')
          }]
        };
      }
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            message: `Error performing research: ${error instanceof Error ? error.message : String(error)}`,
            error: true
          }, null, 2)
        }],
        isError: true
      };
    }
  }
);

// Prompt for complete research flow
server.prompt(
  'deep-research',
  'A deep research tool that explores topics thoroughly through iterative search',
  () => ({
    messages: [{
      role: 'user',
      content: {
        type: 'text',
        text: `Please conduct a deep research session on a topic of interest.
        
I'm looking for a comprehensive analysis with multiple angles and perspectives. The research should explore the topic thoroughly, considering different viewpoints and citing reliable sources.

Please follow these steps:
1. Initialize a research session with my topic
2. Perform multiple rounds of iterative research, exploring different aspects
3. Generate a comprehensive report with your findings`
      }
    }]
  })
);

// Start the server
async function startServer() {
  const transport = new StdioServerTransport();
  
  const serverName = server?.constructor?.name || 'DeepResearch';
  const serverVersion = '1.0.0';
  console.error(`Starting DeepResearch MCP Server (${serverName} v${serverVersion})`);
  
  try {
    await server.connect(transport);
    console.error('Server connected. Waiting for requests...');
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer().catch(console.error); 
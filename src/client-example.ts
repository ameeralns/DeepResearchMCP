import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import dotenv from 'dotenv';

dotenv.config();

// Define types for our tool responses
interface ToolResponse {
  content: Array<{
    type: string;
    text: string;
  }>;
  isError?: boolean;
}

interface InitResponse {
  sessionId: string;
  message: string;
  state: any;
}

interface StepResponse {
  message: string;
  currentDepth: number;
  maxDepth: number;
  lastTopic: string;
  nextTopic: string | null;
  shouldContinue: boolean;
  state: any;
}

/**
 * Example MCP client that connects to the DeepResearch server
 * and performs a complete research workflow
 */
async function main() {
  // Get the research query from command line arguments or use a default
  const query = process.argv[2] || "The impact of quantum computing on cryptography";
  const depth = Number(process.argv[3]) || 2;
  const useCompleteResearch = process.argv[4] === "complete" || false;
  
  console.error(`Starting research on: "${query}" with depth ${depth}`);
  if (useCompleteResearch) {
    console.error("Using complete-research flow (all steps in one call)");
  }
  
  // Connect to the server
  const transport = new StdioClientTransport({
    command: "node",
    args: ["dist/index.js"]
  });

  const client = new Client({
    name: "deep-research-client",
    version: "1.0.0"
  }, {
    capabilities: {
      resources: {},
      tools: {},
      prompts: {}
    }
  });
  
  console.error("Connecting to DeepResearch MCP server...");
  await client.connect(transport);
  console.error("Connected successfully.");
  
  try {
    if (useCompleteResearch) {
      // Use the complete-research tool for a one-step process
      console.error("Executing complete research process...");
      const completeResult = await client.callTool({
        name: "complete-research",
        arguments: {
          query,
          depth,
          timeout: 180000 // 3 minutes timeout
        },
        timeout: 240000 // Give the client a bit extra time (4 minutes)
      }) as ToolResponse;
      
      if (!completeResult.content || !completeResult.content[0] || typeof completeResult.content[0].text !== 'string') {
        throw new Error('Invalid response format from complete-research');
      }
      
      // Check if this is an error response
      if (completeResult.isError) {
        console.error(`Error in complete research flow: ${completeResult.content[0].text}`);
      } else {
        const reportText = completeResult.content[0].text;
        
        console.error("\n================================");
        console.error("FINAL RESEARCH REPORT");
        console.error("================================\n");
        console.error(reportText);
      }
    } else {
      // Original step-by-step process
      // Initialize research
      console.error("Initializing research session...");
      const initResult = await client.callTool({
        name: "initialize-research",
        arguments: {
          query,
          depth
        }
      }) as ToolResponse;
      
      // Parse the response to get sessionId
      if (!initResult.content || !initResult.content[0] || typeof initResult.content[0].text !== 'string') {
        throw new Error('Invalid response format from initialize-research');
      }
      
      const initData = JSON.parse(initResult.content[0].text) as InitResponse;
      const { sessionId } = initData;
      console.error(`Research session initialized with ID: ${sessionId}`);
      
      // Execute steps until complete
      let currentDepth = 0;
      
      while (currentDepth < depth) {
        console.error(`\nExecuting research step ${currentDepth + 1}/${depth}...`);
        const stepResult = await client.callTool({
          name: "execute-research-step",
          arguments: { sessionId }
        }) as ToolResponse;
        
        if (!stepResult.content || !stepResult.content[0] || typeof stepResult.content[0].text !== 'string') {
          throw new Error('Invalid response format from execute-research-step');
        }
        
        try {
          // Check if this is an error response
          if (stepResult.isError) {
            console.error(`Error: ${stepResult.content[0].text}`);
            // Increment depth to continue despite errors
            currentDepth++;
            continue;
          }
          
          const stepData = JSON.parse(stepResult.content[0].text) as StepResponse;
          currentDepth = stepData.currentDepth;
          
          console.error(`Completed step ${currentDepth}/${depth}`);
          console.error(`Last topic searched: ${stepData.lastTopic}`);
          
          if (stepData.nextTopic) {
            console.error(`Next topic to search: ${stepData.nextTopic}`);
          } else {
            console.error("No further topics to search.");
          }
        } catch (parseError) {
          console.error(`Error parsing response: ${parseError}`);
          console.error(`Raw response: ${stepResult.content[0].text}`);
          // Increment depth to continue despite errors
          currentDepth++;
        }
      }
      
      // Generate final report
      console.error("\nGenerating final research report...");
      const reportResult = await client.callTool({
        name: "generate-report",
        arguments: { sessionId },
        timeout: 180000 // 3 minutes timeout for report generation
      }) as ToolResponse;
      
      if (!reportResult.content || !reportResult.content[0] || typeof reportResult.content[0].text !== 'string') {
        throw new Error('Invalid response format from generate-report');
      }
      
      // Check if this is an error response
      if (reportResult.isError) {
        console.error(`Error generating report: ${reportResult.content[0].text}`);
      } else {
        const reportText = reportResult.content[0].text;
        
        console.error("\n================================");
        console.error("FINAL RESEARCH REPORT");
        console.error("================================\n");
        console.error(reportText);
      }
    }
  } catch (error) {
    console.error("Error during research process:", error);
  } finally {
    // Clean up
    console.error("\nDisconnecting from server...");
    // Note: The StdioClientTransport doesn't have a disconnect method in the current SDK
    // This would need to be implemented in a real-world application
  }
}

main().catch(console.error); 
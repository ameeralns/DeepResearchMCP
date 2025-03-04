import { ResearchState, SearchResult, ResearchReport } from '../types/index.js';
// import { searchTavily } from './tavily.js';
import { searchWeb } from './firecrawl.js';
import { analyzeResearch, generateReport } from './openai.js';

// Store all research sessions
const researchSessions = new Map<string, ResearchState>();

/**
 * Initialize a new research session
 * 
 * @param sessionId Unique session identifier
 * @param query Research query
 * @param depth Maximum research depth
 * @returns New research state
 */
export function initializeResearch(
  sessionId: string,
  query: string,
  depth: number = 3
): ResearchState {
  const researchState: ResearchState = {
    query,
    depth,
    currentDepth: 0,
    topics: [],
    findings: [],
    nextSearchTopic: query, // Initial search topic is the query itself
    shouldContinue: true
  };

  researchSessions.set(sessionId, researchState);
  return researchState;
}

/**
 * Get research state for a session
 * 
 * @param sessionId Session identifier
 * @returns Research state or null if not found
 */
export function getResearchState(sessionId: string): ResearchState | null {
  return researchSessions.get(sessionId) || null;
}

/**
 * Execute the next step in the research process
 * 
 * @param sessionId Session identifier
 * @returns Updated research state
 */
export async function executeResearchStep(sessionId: string): Promise<ResearchState> {
  const researchState = researchSessions.get(sessionId);
  if (!researchState) {
    throw new Error(`No research session found with ID: ${sessionId}`);
  }

  if (researchState.currentDepth >= researchState.depth) {
    // Max depth reached - research is complete
    return researchState;
  }

  try {
    // Determine search topic for this step
    const currentSearchTopic = researchState.nextSearchTopic || researchState.query;
    
    // Add current topic to the list of searched topics
    researchState.topics.push(currentSearchTopic);

    console.error(`[Research] Searching for: "${currentSearchTopic}"`);

    // Search for information on the current topic
    let searchResult;
    try {
      searchResult = await searchWeb(currentSearchTopic);
    } catch (searchError) {
      console.error(`[Research] Search error: ${searchError instanceof Error ? searchError.message : String(searchError)}`);
      // Create a fallback search result to indicate the error
      searchResult = {
        query: currentSearchTopic,
        results: [{
          title: 'Search Error',
          url: 'https://error.example.com',
          content: `An error occurred while searching: ${searchError instanceof Error ? searchError.message : String(searchError)}. The search will continue with the next topic.`,
          score: 0
        }]
      };
    }
    
    // Format search results into a detailed finding
    const finding = formatSearchResults(searchResult);
    researchState.findings.push(finding);
    
    // Always analyze findings to determine next steps, regardless of current shouldContinue value
    const analysis = await analyzeResearch(
      researchState.query,
      researchState.findings,
      researchState.topics
    );
    
    // Update research state with next topic and continue flag
    researchState.nextSearchTopic = analysis.nextSearchTopic;
    researchState.shouldContinue = analysis.shouldContinue;
    
    // Always increment the depth counter
    researchState.currentDepth++;
    
    // Update the session
    researchSessions.set(sessionId, researchState);
    
    return researchState;
  } catch (error) {
    console.error('Error executing research step:', error);
    
    // Update the research state to continue despite errors
    if (researchState) {
      // Increment depth to make progress even with errors
      researchState.currentDepth++;
      
      // If we don't have a next search topic, set shouldContinue to false to end the process
      if (!researchState.nextSearchTopic) {
        researchState.shouldContinue = false;
      }
      
      // Update the session
      researchSessions.set(sessionId, researchState);
    }
    
    throw new Error(`Failed to execute research step: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Generate a final research report
 * 
 * @param sessionId Session identifier
 * @returns Research report
 */
export async function generateResearchReport(sessionId: string): Promise<ResearchReport> {
  const researchState = researchSessions.get(sessionId);
  if (!researchState) {
    throw new Error(`No research session found with ID: ${sessionId}`);
  }

  const report = await generateReport(researchState.query, researchState.findings);
  
  return {
    query: researchState.query,
    findings: researchState.findings,
    topics: researchState.topics,
    report
  };
}

/**
 * Format search results into a readable finding
 * 
 * @param searchResult Search results
 * @returns Formatted finding text
 */
function formatSearchResults(searchResult: SearchResult): string {
  let formattedResult = `# Search Results for: ${searchResult.query}\n\n`;
  
  searchResult.results.forEach((result, index) => {
    const resultNumber = index + 1;
    formattedResult += `## Source [${resultNumber}]: ${result.title}\n`;
    formattedResult += `URL: ${result.url}\n`;
    formattedResult += `Citation: [${resultNumber}] ${result.url}\n\n`;
    formattedResult += `### Content from Source [${resultNumber}]:\n${result.content}\n\n`;
  });
  
  // Add a clear and standardized source section for easy citation
  formattedResult += `# Source URLs for Citation\n\n`;
  searchResult.results.forEach((result, index) => {
    formattedResult += `[${index + 1}] ${result.url} - ${result.title}\n`;
  });
  
  return formattedResult;
} 
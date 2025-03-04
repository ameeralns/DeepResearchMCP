import OpenAI from 'openai';
import { AnalysisResult } from '../types/index.js';
import dotenv from 'dotenv';

dotenv.config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY is not set in environment variables');
}

const openai = new OpenAI({
  apiKey: OPENAI_API_KEY
});

/**
 * Analyze research findings and determine the next steps
 * 
 * @param query Original research query
 * @param findings Research findings so far
 * @param searchedTopics Topics already searched
 * @returns Analysis result with follow-up steps
 */
export async function analyzeResearch(
  query: string,
  findings: string[],
  searchedTopics: string[]
): Promise<{ nextSearchTopic: string | null; shouldContinue: boolean }> {
  console.error(`[OpenAI Service] Analyzing research with ${findings.length} findings`);
  
  try {
    // Implement token management strategy
    let processedFindings: string;
    
    // If we have more than 2 findings, we need to be careful about token limits
    if (findings.length > 2) {
      console.error(`[OpenAI Service] Managing tokens for ${findings.length} findings`);
      
      // Keep the two most recent findings intact
      const recentFindings = findings.slice(-2);
      // For older findings, extract only essential information to save tokens
      const olderFindings = findings.slice(0, -2).map((finding, index) => {
        // Extract just the search query and source titles/URLs
        const searchQueryMatch = finding.match(/# Search Results for: (.*?)\n/);
        const searchQuery = searchQueryMatch ? searchQueryMatch[1] : `Research step ${index + 1}`;
        
        // Extract source titles and URLs only (no full content)
        const sourceMatches = [...finding.matchAll(/## Source \[(\d+)\]: (.*?)\nURL: (https?:\/\/[^\s]+)/g)];
        const sourceSummaries = sourceMatches.map(match => 
          `Source [${match[1]}]: ${match[2]}\nURL: ${match[3]}`
        ).join('\n\n');
        
        return `# Summary of Search for: ${searchQuery}\n\n${sourceSummaries}\n\n[Full content omitted to save tokens]`;
      });
      
      // Combine summaries of older findings with full recent findings
      processedFindings = [
        ...olderFindings,
        ...recentFindings
      ].join('\n\n---\n\n');
      
      console.error(`[OpenAI Service] Processed ${findings.length} findings: ${olderFindings.length} summarized, ${recentFindings.length} full`);
    } else {
      // If we have 2 or fewer findings, we can include all of them in full
      processedFindings = findings.join('\n\n---\n\n');
      console.error(`[OpenAI Service] Using all ${findings.length} findings in full`);
    }
    
    // Create a list of already searched topics to avoid duplication
    const searchedTopicsText = searchedTopics.length 
      ? `ALREADY SEARCHED TOPICS (DO NOT REPEAT THESE):\n${searchedTopics.map(t => `- ${t}`).join('\n')}`
      : 'No topics have been searched yet.';
      
    // Make API call with optimized content
    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [
        {
          role: 'system',
          content: `You are a research assistant helping to explore a topic thoroughly through web searches. 
          
MAIN RESEARCH TOPIC: "${query}"

${searchedTopicsText}

Your task is to determine if further research is needed and what specific topic to search next.`
        },
        {
          role: 'user',
          content: `I've been researching "${query}" and have the following findings so far:

${processedFindings}

Based on these findings, I need you to:

1. Determine if further research is necessary to fully explore the original query.
2. If further research is needed, provide ONE specific search query that would best supplement the existing findings. Be precise and focused.
3. If no further research is needed, explicitly state that the research is complete.

Format your response EXACTLY as follows:
CONTINUE: YES/NO
NEXT SEARCH QUERY: [your suggested search query only if continuing]`
        }
      ],
      temperature: 0.3,
      max_tokens: 1000
    });

    if (!response.choices[0]?.message?.content) {
      throw new Error('No response content from OpenAI API');
    }

    const content = response.choices[0].message.content;
    const shouldContinue = content.includes('CONTINUE: YES');
    
    // Extract next search query if continuing
    let nextSearchTopic: string | null = null;
    if (shouldContinue) {
      const nextTopicMatch = content.match(/NEXT SEARCH QUERY: (.*?)($|\n)/);
      nextSearchTopic = nextTopicMatch ? nextTopicMatch[1].trim() : null;
    }

    return {
      shouldContinue,
      nextSearchTopic
    };
  } catch (error) {
    console.error('[OpenAI Service] Error analyzing research:', error);
    throw error;
  }
}

/**
 * Generate a comprehensive research report
 *
 * @param query Original research query
 * @param findings All research findings
 * @returns Final research report
 */
export async function generateReport(
  query: string,
  findings: string[]
): Promise<string> {
  try {
    // Extract all sources and their content into a structured format
    interface SourceContent {
      url: string;
      title: string;
      content: string;
      sourceNum: number;
      searchQuery: string;
    }
    
    // Track all sources and their content
    const allSources: SourceContent[] = [];
    const sourceUrlMap: Map<string, number> = new Map(); // URL to source number mapping
    let globalSourceCounter = 0;
    
    // Process each finding to extract structured content
    findings.forEach((finding, findingIndex) => {
      // Extract search query
      const searchQueryMatch = finding.match(/# Search Results for: (.*?)(\n|$)/);
      const searchQuery = searchQueryMatch ? searchQueryMatch[1] : `Finding ${findingIndex + 1}`;
      
      // Process each source in the finding
      let isInContent = false;
      let contentBuffer: string[] = [];
      let currentUrl = '';
      let currentTitle = '';
      let currentSourceNum = 0;
      
      // Split the finding into lines for processing
      finding.split('\n').forEach(line => {
        // Source header pattern: ## Source [1]: Title
        const sourceMatch = line.match(/## Source \[(\d+)\]: (.*?)$/);
        if (sourceMatch) {
          currentSourceNum = parseInt(sourceMatch[1]);
          currentTitle = sourceMatch[2];
          isInContent = false;
          
          // If we were processing a previous source, finalize it
          if (contentBuffer.length > 0 && currentUrl) {
            // Avoid duplicating content from the same URL
            if (!sourceUrlMap.has(currentUrl)) {
              globalSourceCounter++;
              sourceUrlMap.set(currentUrl, globalSourceCounter);
              
              allSources.push({
                url: currentUrl,
                title: currentTitle,
                content: contentBuffer.join('\n'),
                sourceNum: globalSourceCounter,
                searchQuery
              });
            }
            
            contentBuffer = [];
            currentUrl = '';
          }
        }
        // URL pattern: URL: https://...
        else if (line.startsWith('URL: ')) {
          currentUrl = line.substring(5).trim();
        }
        // Content header pattern: ### Content from Source [1]:
        else if (line.match(/### Content from Source \[\d+\]:/)) {
          isInContent = true;
          contentBuffer = [];
        }
        // End of source content (next source starts or end of finding)
        else if (isInContent && (line.startsWith('## Source') || line.startsWith('# Source URLs'))) {
          isInContent = false;
          
          // Finalize the current source
          if (contentBuffer.length > 0 && currentUrl) {
            // Avoid duplicating content from the same URL
            if (!sourceUrlMap.has(currentUrl)) {
              globalSourceCounter++;
              sourceUrlMap.set(currentUrl, globalSourceCounter);
              
              allSources.push({
                url: currentUrl,
                title: currentTitle,
                content: contentBuffer.join('\n'),
                sourceNum: globalSourceCounter,
                searchQuery
              });
            }
            
            contentBuffer = [];
            currentUrl = '';
          }
          
          // No continue or break needed - just let it naturally move to the next line
        } else if (isInContent) {
          contentBuffer.push(line);
        }
      });
    });
    
    console.error(`Extracted ${allSources.length} sources from ${findings.length} findings`);
    
    // More aggressive content optimization
    // 1. Set a much lower character limit for content
    const MAX_CONTENT_LENGTH = 40000; // Reduced from 60000 to 40000 characters
    let totalContentLength = 0;
    
    // 2. Calculate total content length
    allSources.forEach(source => {
      totalContentLength += source.content.length;
    });
    
    // 3. Group sources by search query
    const sourcesByQuery = new Map<string, SourceContent[]>();
    allSources.forEach(source => {
      if (!sourcesByQuery.has(source.searchQuery)) {
        sourcesByQuery.set(source.searchQuery, []);
      }
      sourcesByQuery.get(source.searchQuery)?.push(source);
    });
    
    // 4. If content is too large, trim it intelligently
    let optimizedContent = '';
    
    if (totalContentLength > MAX_CONTENT_LENGTH) {
      console.error(`Content exceeds token limit (${totalContentLength} characters), optimizing...`);
      
      // 5. Instead of proportional allocation, use a more aggressive summarization approach
      // Create a structured bibliography with minimal content
      optimizedContent = '# BIBLIOGRAPHY\n\n';
      
      // First pass: Add only metadata for each source
      sourcesByQuery.forEach((sources, query) => {
        optimizedContent += `## Search Query: ${query}\n\n`;
        
        sources.forEach(source => {
          // Just add metadata and URL for each source, no content
          optimizedContent += `[${source.sourceNum}] "${source.title}"\n`;
          optimizedContent += `URL: ${source.url}\n\n`;
        });
      });
      
      // Second pass: Add abbreviated content for each source until we reach the limit
      let currentLength = optimizedContent.length;
      const remainingLength = MAX_CONTENT_LENGTH - currentLength;
      
      // Calculate how many characters we can allocate per source
      const maxCharsPerSource = Math.floor(remainingLength / allSources.length);
      
      // Add additional section for content excerpts
      optimizedContent += '# CONTENT EXCERPTS\n\n';
      
      // Add abbreviated content for each source
      allSources.forEach(source => {
        // Truncate the content to the allocated size
        const excerpt = source.content.length > maxCharsPerSource 
          ? source.content.substring(0, maxCharsPerSource) + '...'
          : source.content;
        
        optimizedContent += `## [${source.sourceNum}] ${source.title}\n\n`;
        optimizedContent += `${excerpt}\n\n`;
      });
    } else {
      // If content is within limits, use the original approach
      sourcesByQuery.forEach((sources, query) => {
        optimizedContent += `## Search Query: ${query}\n\n`;
        
        sources.forEach(source => {
          optimizedContent += `### [${source.sourceNum}] ${source.title}\n`;
          optimizedContent += `URL: ${source.url}\n\n`;
          optimizedContent += `${source.content.trim()}\n\n`;
        });
      });
    }

    // Now generate the report with the optimized content
    console.error(`Generating report with optimized content (${optimizedContent.length} characters)`);
    
    // More optimized prompt with fewer instructions
    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [
        {
          role: 'system',
          content: `Generate a concise research report on "${query}" using the provided sources. 
Format:
- Executive Summary (2-3 paragraphs)
- Introduction
- Main Findings (organized by themes)
- Conclusion
- Bibliography

Cite sources using [X] format. Focus on key insights rather than exhaustive detail.`
        },
        {
          role: 'user',
          content: `Research report on "${query}" based on the following:

${optimizedContent}`
        }
      ],
      temperature: 0.5, // Lower temperature for more focused output
      max_tokens: 4000
    });

    if (!response.choices[0]?.message?.content) {
      throw new Error("No response content from OpenAI API");
    }

    return response.choices[0].message.content;
  } catch (error) {
    console.error("[OpenAI Service] Error generating report:", error);
    throw error;
  }
} 
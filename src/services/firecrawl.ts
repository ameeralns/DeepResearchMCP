import axios from 'axios';
import { SearchResult } from '../types/index.js';
import dotenv from 'dotenv';

dotenv.config();

const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;

if (!FIRECRAWL_API_KEY) {
  throw new Error('FIRECRAWL_API_KEY is not set in environment variables');
}

/**
 * Search the web using Firecrawl API
 * 
 * @param query Search query
 * @param maxResults Maximum number of results to return
 * @param searchDepth Search depth ('basic' or 'advanced')
 * @returns Search results
 */
export async function searchWeb(
  query: string, 
  maxResults: number = 5, 
  searchDepth: 'basic' | 'advanced' = 'advanced'
): Promise<SearchResult> {
  try {
    console.error(`[Firecrawl] Searching for: "${query}" with depth: ${searchDepth}`);
    
    // Using only supported parameters according to Firecrawl v1 API
    const response = await axios.post(
      'https://api.firecrawl.dev/v1/search',
      {
        query: query,
        limit: maxResults,
        scrapeOptions: {
          formats: ["markdown"], // Get markdown content
          timeout: 25000, // Increase timeout for better scraping
          blockAds: true // Block ads for cleaner content
        },
        country: "us", // Set country for consistent results
        lang: "en"    // Set language to English
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${FIRECRAWL_API_KEY}`
        },
        timeout: 30000 // Increase timeout for the overall request
      }
    );

    // Validate response and handle possible error cases
    if (!response.data.success || !response.data.data || !Array.isArray(response.data.data)) {
      console.error('[Firecrawl] Invalid response structure:', JSON.stringify(response.data).substring(0, 500) + '...');
      throw new Error('Invalid response structure from Firecrawl');
    }

    // Enhanced error handling for empty results
    if (response.data.data.length === 0) {
      console.warn(`[Firecrawl] No results found for query: "${query}"`);
      return {
        query,
        results: []
      };
    }

    return {
      query,
      results: response.data.data.map((result: any, index: number) => {
        // Enhanced content extraction with fallbacks to ensure maximum content quality
        let content = '';
        
        // First try to get markdown content as it's cleaner
        if (result.markdown && typeof result.markdown === 'string' && result.markdown.trim().length > 0) {
          content = result.markdown;
        } 
        // Fallback to description as last resort
        else if (result.description && typeof result.description === 'string') {
          content = result.description;
        } 
        else {
          content = 'No content available';
        }
        
        // Ensure all necessary fields are present
        return {
          title: result.title || `Result ${index + 1} for "${query}"`,
          url: result.url || 'No URL available',
          content: content,
          score: result.score || 1.0 // Use provided score or default
        };
      }).slice(0, maxResults)
    };
  } catch (error) {
    console.error('[Firecrawl] Search error:', error);
    // More detailed error message
    if (axios.isAxiosError(error) && error.response) {
      throw new Error(`Failed to search with Firecrawl: ${error.response.status} ${error.response.statusText} - ${JSON.stringify(error.response.data)}`);
    }
    throw new Error(`Failed to search with Firecrawl: ${error instanceof Error ? error.message : String(error)}`);
  }
} 
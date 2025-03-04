// Research state
export interface ResearchState {
  query: string;
  depth: number;
  currentDepth: number;
  topics: string[];
  findings: string[];
  nextSearchTopic: string | null;
  shouldContinue: boolean;
}

// Web search result
export interface SearchResult {
  query: string;
  results: Array<{
    title: string;
    url: string;
    content: string;
    score: number;
  }>;
}

// Analysis result from LLM
export interface AnalysisResult {
  nextSearchTopic: string | null;
  shouldContinue: boolean;
}

// Final research report
export interface ResearchReport {
  query: string;
  findings: string[];
  topics: string[];
  report: string;
} 
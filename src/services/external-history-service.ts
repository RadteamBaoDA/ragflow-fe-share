interface ChatHistoryPayload {
  session_id: string;
  share_id?: string;
  user_email?: string;
  user_prompt: string;
  llm_response: string;
  citations?: string[]; // Assuming simple string list of citations or file names
}

interface SearchHistoryPayload {
  session_id: string;
  share_id?: string;
  search_input: string;
  user_email?: string;
  ai_summary?: string;
  file_results?: string[];
}

class ExternalHistoryService {
  private worker: Worker | null = null;
  private config: { baseURL?: string; apiKey?: string } = {};

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        this.worker = new Worker(new URL('../workers/external-history.worker.ts', import.meta.url), { type: 'module' });

        // Initialize config from environment variables if available
        // Note: process.env might need to be replaced by import.meta.env in Vite,
        // but this project seems to use process.env (based on external-trace-service.ts)
        this.config = {
          baseURL: process.env.EXTERNAL_TRACE_API_URL || process.env.EXTERNAL_TRACE_URL,
          apiKey: process.env.EXTERNAL_TRACE_API_KEY,
        };
      } catch (error) {
        console.error('Failed to initialize ExternalHistoryService worker:', error);
      }
    }
  }

  public sendChatHistory(payload: ChatHistoryPayload) {
    if (!this.worker) return;
    console.log('[ExternalHistoryService] sendChatHistory - payload:', payload);
    this.worker.postMessage({
      type: 'chat',
      payload,
      config: this.config,
    });
  }

  public sendSearchHistory(payload: SearchHistoryPayload) {
    if (!this.worker) return;
    console.log('[ExternalHistoryService] sendSearchHistory - payload:', payload);
    this.worker.postMessage({
      type: 'search',
      payload,
      config: this.config,
    });
  }
}

export const externalHistoryService = new ExternalHistoryService();

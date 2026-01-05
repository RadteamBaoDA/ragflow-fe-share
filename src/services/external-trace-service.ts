import { Authorization } from '@/constants/authorization';
import { getAuthorization } from '@/utils/authorization-util';

interface TracePayload {
    email: string;
    message: string;
    role: 'user' | 'assistant';
    share_id?: string;
    response?: string;
    metadata?: {
        chatId?: string;
        sessionId?: string;
        source?: string;
        task?: string;
        model?: string;
        modelName?: string;
        tags?: string[];
        timestamp?: string;
        usage?: {
            promptTokens?: number;
            completionTokens?: number;
            totalTokens?: number;
        };
        [key: string]: unknown;
    };
}

interface TraceResponse {
    success: boolean;
    traceId?: string;
    error?: string;
}

interface FeedbackPayload {
    traceId: string;
    messageId?: string;
    value: number;
    score?: number;
    comment?: string;
}

interface FeedbackResponse {
    success: boolean;
    error?: string;
}

interface WorkerResponse {
    id: string;
    success: boolean;
    data?: TraceResponse | FeedbackResponse;
    error?: string;
}

/**
 * ExternalTraceService - Uses Web Worker to send trace data off the main thread.
 * This prevents UI blocking when the API is slow.
 */
class ExternalTraceService {
    private worker: Worker | null = null;
    private config: { baseURL?: string; apiKey?: string } = {};
    private pendingRequests: Map<string, {
        resolve: (value: any) => void;
        reject: (error: any) => void;
    }> = new Map();
    private requestIdCounter = 0;

    constructor() {
        if (typeof window !== 'undefined') {
            try {
                this.worker = new Worker(
                    new URL('../workers/external-trace.worker.ts', import.meta.url),
                    { type: 'module' }
                );

                this.worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
                    const { id, success, data, error } = e.data;
                    const pending = this.pendingRequests.get(id);
                    if (pending) {
                        this.pendingRequests.delete(id);
                        if (success) {
                            pending.resolve(data || { success: true });
                        } else {
                            pending.resolve({ success: false, error });
                        }
                    }
                };

                this.worker.onerror = (error) => {
                    console.error('External Trace Worker error:', error);
                };

                this.config = {
                    baseURL: process.env.EXTERNAL_TRACE_API_URL || process.env.EXTERNAL_TRACE_URL,
                    apiKey: process.env.EXTERNAL_TRACE_API_KEY,
                };
            } catch (error) {
                console.error('Failed to initialize ExternalTraceService worker:', error);
            }
        }
    }

    private generateRequestId(): string {
        return `trace_${++this.requestIdCounter}_${Date.now()}`;
    }

    private sendToWorker<T>(type: 'trace' | 'feedback', payload: any): Promise<T> {
        return new Promise((resolve) => {
            if (!this.worker) {
                console.warn('ExternalTraceService: Worker not available');
                resolve({ success: false, error: 'Worker not available' } as T);
                return;
            }

            const id = this.generateRequestId();
            this.pendingRequests.set(id, { resolve, reject: () => resolve({ success: false } as T) });

            this.worker.postMessage({
                type,
                id,
                payload,
                config: {
                    ...this.config,
                    authToken: getAuthorization(),
                },
            });

            // Auto-cleanup after 35s (slightly longer than worker timeout)
            setTimeout(() => {
                if (this.pendingRequests.has(id)) {
                    this.pendingRequests.delete(id);
                    resolve({ success: false, error: 'Request timeout' } as T);
                }
            }, 35000);
        });
    }

    /**
     * Sends a trace payload (fire-and-forget - non-blocking).
     */
    sendTrace(payload: TracePayload): void {
        this.sendToWorker<TraceResponse>('trace', payload)
            .then((result) => {
                if (result.traceId) {
                    console.log(`[ExternalTraceService] Trace submitted: ${result.traceId}`);
                }
            })
            .catch((error) => {
                console.warn('[ExternalTraceService] Trace failed:', error);
            });
    }

    /**
     * Sends a trace payload and returns a promise (for cases where you need the traceId).
     */
    sendTraceAsync(payload: TracePayload): Promise<TraceResponse> {
        return this.sendToWorker<TraceResponse>('trace', payload);
    }

    /**
     * Sends feedback (fire-and-forget - non-blocking).
     */
    sendFeedback(payload: FeedbackPayload): void {
        this.sendToWorker<FeedbackResponse>('feedback', payload)
            .then((result) => {
                if (result.success) {
                    console.log('[ExternalTraceService] Feedback submitted');
                }
            })
            .catch((error) => {
                console.warn('[ExternalTraceService] Feedback failed:', error);
            });
    }

    /**
     * Sends feedback and returns a promise.
     */
    sendFeedbackAsync(payload: FeedbackPayload): Promise<FeedbackResponse> {
        return this.sendToWorker<FeedbackResponse>('feedback', payload);
    }

    /**
     * Helper: Sends a user message trace (fire-and-forget).
     */
    sendUserMessage(
        email: string,
        message: string,
        chatId: string,
        shareId?: string,
        sessionId?: string,
    ): void {
        this.sendTrace({
            email,
            message,
            role: 'user',
            share_id: shareId,
            metadata: { chatId, source: 'knowledge-base', sessionId },
        });
    }

    /**
     * Helper: Sends a user message trace and returns promise with traceId.
     */
    sendUserMessageAsync(
        email: string,
        message: string,
        chatId: string,
        shareId?: string,
        sessionId?: string,
    ): Promise<TraceResponse> {
        return this.sendTraceAsync({
            email,
            message,
            role: 'user',
            share_id: shareId,
            metadata: { chatId, source: 'knowledge-base', sessionId },
        });
    }

    /**
     * Helper: Sends an assistant response trace (fire-and-forget).
     */
    sendAssistantResponse(
        email: string,
        message: string,
        response: string,
        chatId: string,
        shareId?: string,
        model?: string,
        usage?: {
            promptTokens?: number;
            completionTokens?: number;
            totalTokens?: number;
        },
        sessionId?: string,
    ): void {
        this.sendTrace({
            email,
            message,
            role: 'assistant',
            share_id: shareId,
            response,
            metadata: {
                chatId,
                source: 'knowledge-base',
                model,
                task: 'llm_response',
                usage,
                sessionId,
            },
        });
    }

    /**
     * Helper: Sends an assistant response trace and returns promise.
     */
    sendAssistantResponseAsync(
        email: string,
        message: string,
        response: string,
        chatId: string,
        shareId?: string,
        model?: string,
        usage?: {
            promptTokens?: number;
            completionTokens?: number;
            totalTokens?: number;
        },
        sessionId?: string,
    ): Promise<TraceResponse> {
        return this.sendTraceAsync({
            email,
            message,
            role: 'assistant',
            share_id: shareId,
            response,
            metadata: {
                chatId,
                source: 'knowledge-base',
                model,
                task: 'llm_response',
                usage,
                sessionId,
            },
        });
    }
}

/**
 * The external tracing service instance.
 */
export const externalTraceService = new ExternalTraceService();

// Backward compatibility - deprecated, use externalTraceService instead
export const externalTraceApi = externalTraceService;

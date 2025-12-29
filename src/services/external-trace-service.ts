import axios, { AxiosInstance } from 'axios';
import { Authorization } from '@/constants/authorization';
import { getAuthorization } from '@/utils/authorization-util';

interface TracePayload {
    email: string; // REQUIRED: Valid system user email
    message: string; // REQUIRED: The message content
    role: 'user' | 'assistant'; // "user" or "assistant" (default: "user")
    share_id?: string; // Optional: Share ID
    response?: string; // REQUIRED if role="assistant"
    metadata?: {
        chatId?: string; // REQUIRED for conversation threading
        sessionId?: string; // Alternative to chatId
        source?: string; // Identifier for your application
        task?: string; // Custom task name (default: user_response/llm_response)
        model?: string; // Model ID
        modelName?: string; // Human-readable model name
        tags?: string[]; // Array of tags for categorization
        timestamp?: string; // ISO timestamp
        usage?: {
            // Token usage (for assistant responses)
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
    traceId: string; // REQUIRED: The ID from the Submit response
    messageId?: string; // Alternative to traceId
    value: number; // 1 = Positive, 0 = Negative (or custom scale)
    score?: number; // Alternative to value
    comment?: string; // Optional feedback text
}

interface FeedbackResponse {
    success: boolean;
    error?: string;
}

/**
 * ExternalTraceApi is a class that provides methods for sending trace data to a
n external tracing API.
 */
class ExternalTraceApi {
    /**
     * The Axios instance used to make HTTP requests to the external tracing API
.
     */
    private client: AxiosInstance;

    /**
     * Creates a new instance of ExternalTraceApi.
     */
    constructor() {
        /**
         * The Axios instance used to make HTTP requests to the external tracing
 API.
         */
        this.client = axios.create({
            baseURL:
                process.env.EXTERNAL_TRACE_API_URL || process.env.EXTERNAL_TRACE_URL,
            headers: {
                'Content-Type': 'application/json',
                ...(process.env.EXTERNAL_TRACE_API_KEY && {
                    'X-API-Key': process.env.EXTERNAL_TRACE_API_KEY,
                }),
            },
        });

        // Add request interceptor to inject Authorization header if available
        this.client.interceptors.request.use(
            (config) => {
                const token = getAuthorization();
                if (token) {
                    config.headers[Authorization] = token;
                }
                return config;
            },
            (error) => {
                return Promise.reject(error);
            },
        );
    }

    /**
     * Sends a trace payload to the external tracing API.
     * @param payload The trace data to send.
     * @returns A promise that resolves to a TraceResponse indicating success or
 failure.
     */
    async sendTrace(payload: TracePayload): Promise<TraceResponse> {
        try {
            /**
             * Determine the correct path. If baseURL already includes the path,
 use empty string.
             */
            const baseURL = this.client.defaults.baseURL || '';
            const path = baseURL.includes('/api/external/trace/submit')
                ? ''
                : '/api/external/trace/submit';
            /**
             * Send a POST request to the external tracing API.
             */
            const { data } = await this.client.post<TraceResponse>(path, {
                ...payload
            });
            console.log(`trace submit: ${JSON.stringify(data)}`);
            return data;
        } catch (error) {
            console.warn('Failed to submit trace:', error);
            // Return failure object instead of throwing, to prevent app crash/logout on 401
            return { success: false, error: 'Failed to submit trace' };
        }
    }

    /**
     * Sends a feedback payload to the external tracing API.
     * @param payload The feedback data to send.
     * @returns A promise that resolves to a FeedbackResponse indicating success
 or failure.
     */
    async sendFeedback(payload: FeedbackPayload): Promise<FeedbackResponse> {
        try {
            /**
             * Determine the correct path. If baseURL already includes the path,
 use empty string.
             */
            const baseURL = this.client.defaults.baseURL || '';
            const path = baseURL.includes('/api/external/trace/feedback')
                ? ''
                : '/api/external/trace/feedback';
            /**
             * Send a POST request to the external tracing API.
             */
            console.log(`feedback submit: ${JSON.stringify(payload)}`);
            const { data } = await this.client.post<FeedbackResponse>(path, payload);
            return data;
        } catch (error) {
            console.warn('Failed to submit feedback:', error);
            // Return failure object instead of throwing
            return { success: false, error: 'Failed to submit feedback' };
        }
    }

    /**
     * Sends a user message to the external tracing API.
     * @param email The email of the user.
     * @param message The user's message.
     * @param chatId The ID of the chat.
     * @param sessionId The ID of the session.
     * @returns A promise that resolves to a TraceResponse indicating success or
 failure.
     */
    async sendUserMessage(
        email: string,
        message: string,
        chatId: string,
        shareId?: string,
        sessionId?: string,
    ): Promise<TraceResponse> {
        /**
         * Send a user message to the external tracing API.
         */
        return this.sendTrace({
            email,
            message,
            role: 'user',
            share_id: shareId,
            metadata: { chatId, source: 'knowledge-base', sessionId },
        });
    }

    /**
     * Sends an assistant response to the external tracing API.
     * @param email The email of the user.
     * @param message The assistant's message.
     * @param response The assistant's response.
     * @param chatId The ID of the chat.
     * @param model The model used for the assistant's response.
     * @param usage The usage data for the assistant's response.
     * @param sessionId The ID of the session.
     * @returns A promise that resolves to a TraceResponse indicating success or
 failure.
     */
    async sendAssistantResponse(
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
        /**
         * Send an assistant response to the external tracing API.
         */
        return this.sendTrace({
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
 * The external tracing API instance.
 */
export const externalTraceApi = new ExternalTraceApi();

// Web Worker for external trace API calls
// Runs API calls off the main thread to prevent UI blocking

interface TracePayload {
    email: string;
    message: string;
    role: 'user' | 'assistant';
    share_id?: string;
    response?: string;
    metadata?: Record<string, unknown>;
}

interface FeedbackPayload {
    traceId: string;
    messageId?: string;
    value: number;
    score?: number;
    comment?: string;
}

interface WorkerMessage {
    type: 'trace' | 'feedback';
    id: string;
    payload: TracePayload | FeedbackPayload;
    config: {
        baseURL?: string;
        apiKey?: string;
        authToken?: string;
    };
}

const TIMEOUT_MS = 30000; // 30 seconds

async function fetchWithTimeout(
    url: string,
    options: RequestInit,
    timeoutMs: number
): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
        });
        return response;
    } finally {
        clearTimeout(timeoutId);
    }
}

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
    const { type, id, payload, config } = e.data;

    if (!type || !payload) {
        console.error('External Trace Worker: Missing type or payload');
        self.postMessage({ id, success: false, error: 'Missing type or payload' });
        return;
    }

    const { baseURL, apiKey, authToken } = config || {};

    let endpoint = '';
    if (type === 'trace') {
        endpoint = '/api/external/trace/submit';
    } else if (type === 'feedback') {
        endpoint = '/api/external/trace/feedback';
    } else {
        console.error('External Trace Worker: Unknown type', type);
        self.postMessage({ id, success: false, error: 'Unknown type' });
        return;
    }

    const url = baseURL ? `${baseURL.replace(/\/$/, '')}${endpoint}` : endpoint;

    const headers: HeadersInit = {
        'Content-Type': 'application/json',
    };

    if (apiKey) {
        headers['X-API-Key'] = apiKey;
    }

    if (authToken) {
        headers['Authorization'] = authToken;
    }

    try {
        const response = await fetchWithTimeout(
            url,
            {
                method: 'POST',
                headers,
                body: JSON.stringify(payload),
            },
            TIMEOUT_MS
        );

        if (!response.ok) {
            console.warn(
                `External Trace Worker: Failed to send ${type}. Status: ${response.status}`
            );
            const text = await response.text();
            console.warn('Response:', text);
            self.postMessage({ id, success: false, error: `HTTP ${response.status}` });
        } else {
            const data = await response.json();
            self.postMessage({ id, success: true, data });
        }
    } catch (error: any) {
        if (error.name === 'AbortError') {
            console.warn(`External Trace Worker: ${type} request timed out after ${TIMEOUT_MS}ms`);
            self.postMessage({ id, success: false, error: 'Request timeout' });
        } else {
            console.error(`External Trace Worker: Network error sending ${type}`, error);
            self.postMessage({ id, success: false, error: error.message || 'Network error' });
        }
    }
};

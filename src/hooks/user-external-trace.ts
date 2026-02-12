import { useCallback, useState } from 'react';
import { externalTraceService } from '@/services/external-trace-service';

interface UseExternalTraceOptions {
    email: string;
    chatId: string;
    shareId?: string;
}

/**
 * Hook for external trace API calls.
 * Uses Web Worker under the hood - all calls are non-blocking (fire-and-forget).
 */
export function useExternalTrace({ email, chatId, shareId }: UseExternalTraceOptions) {
    const [isTracing, setIsTracing] = useState(false);
    const [lastTraceId, setLastTraceId] = useState<string | null>(null);

    /**
     * Trace a user message (fire-and-forget, non-blocking).
     */
    const traceUserMessage = useCallback(
        (message: string = "") => {
            // Fire-and-forget: start trace but don't block
            setIsTracing(true);

            externalTraceService.sendUserMessageAsync(
                email,
                message,
                chatId,
                shareId,
                lastTraceId || undefined,
            )
                .then((result) => {
                    if (result.traceId) {
                        setLastTraceId(result.traceId);
                    }
                })
                .catch((error) => {
                    console.warn('[useExternalTrace] traceUserMessage failed:', error);
                })
                .finally(() => {
                    setIsTracing(false);
                });
        },
        [email, chatId, shareId, lastTraceId],
    );

    /**
     * Trace an assistant response (fire-and-forget, non-blocking).
     */
    const traceAssistantResponse = useCallback(
        (
            message: string = "",
            response: string = "",
            model?: string,
            usage?: { promptTokens?: number; completionTokens?: number },
        ) => {
            // Fire-and-forget: start trace but don't block
            setIsTracing(true);

            externalTraceService.sendAssistantResponseAsync(
                email,
                message,
                response,
                chatId,
                shareId,
                model,
                usage,
                lastTraceId || undefined,
            )
                .then((result) => {
                    if (result.traceId) {
                        setLastTraceId(result.traceId);
                    }
                })
                .catch((error) => {
                    console.warn('[useExternalTrace] traceAssistantResponse failed:', error);
                })
                .finally(() => {
                    setIsTracing(false);
                });
        },
        [email, chatId, shareId, lastTraceId],
    );

    /**
     * Submit feedback/score (fire-and-forget, non-blocking).
     */
    const traceScore = useCallback(
        (score: number, comment?: string, _name: string = "user-feedback") => {
            if (!lastTraceId) {
                console.warn('[useExternalTrace] traceScore: No lastTraceId available');
                return;
            }

            // Fire-and-forget: submit feedback but don't block
            setIsTracing(true);

            externalTraceService.sendFeedbackAsync({
                traceId: lastTraceId,
                value: score,
                comment,
            })
                .catch((error) => {
                    console.warn('[useExternalTrace] traceScore failed:', error);
                })
                .finally(() => {
                    setIsTracing(false);
                });
        },
        [lastTraceId],
    );

    return {
        traceUserMessage,
        traceAssistantResponse,
        traceScore,
        isTracing,
        lastTraceId,
        setLastTraceId,
    };
}

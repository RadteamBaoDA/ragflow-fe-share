import { useCallback, useState } from 'react';
import { externalTraceApi } from '@/services/external-trace-service';

interface UseExternalTraceOptions {
    email: string;
    chatId: string;
    shareId?: string;
}

export function useExternalTrace({ email, chatId, shareId }: UseExternalTraceOptions) {
    const [isTracing, setIsTracing] = useState(false);
    const [lastTraceId, setLastTraceId] = useState<string | null>(null);

    const traceUserMessage = useCallback(
        async (message: string = "") => {
            console.log('[ExternalTrace] traceUserMessage - chatId:', chatId, 'shareId:', shareId, 'sessionId:', lastTraceId);
            setIsTracing(true);
            try {
                const result = await externalTraceApi.sendUserMessage(
                    email,
                    message,
                    chatId,
                    shareId,
                    lastTraceId || undefined,
                );
                if (result.traceId) setLastTraceId(result.traceId);
                return result;
            } finally {
                setIsTracing(false);
            }
        },
        [email, chatId, shareId, lastTraceId],
    );

    const traceAssistantResponse = useCallback(
        async (
            message: string = "",
            response: string = "",
            model?: string,
            usage?: { promptTokens?: number; completionTokens?: number },
        ) => {
            setIsTracing(true);
            try {
                const result = await externalTraceApi.sendAssistantResponse(
                    email,
                    message,
                    response,
                    chatId,
                    shareId,
                    model,
                    usage,
                    lastTraceId || undefined,
                );
                if (result.traceId) setLastTraceId(result.traceId);
                return result;
            } finally {
                setIsTracing(false);
            }
        },
        [email, chatId, shareId, lastTraceId],
    );

    const traceScore = useCallback(
        async (score: number, comment?: string, name: string = "user-feedback") => {
            if (!lastTraceId) return;
            setIsTracing(true);
            try {
                const result = await externalTraceApi.sendFeedback({
                    traceId: lastTraceId,
                    value: score,
                    comment,
                });
                return result;
            } finally {
                setIsTracing(false);
            }
        },
        [email, lastTraceId],
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

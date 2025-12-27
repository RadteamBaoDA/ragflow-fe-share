import { EmbedContainer } from '@/components/embed-container';
import { NextMessageInput } from '@/components/message-input/next';
import MessageItem from '@/components/message-item';
import PdfDrawer from '@/components/pdf-drawer';
import { useClickDrawer } from '@/components/pdf-drawer/hooks';
import { useSyncThemeFromParams } from '@/components/theme-provider';
import { MessageType, SharedFrom } from '@/constants/chat';
import { useFetchNextConversationSSE } from '@/hooks/chat-hooks';
import { useFetchFlowSSE } from '@/hooks/flow-hooks';
import { useFetchExternalChatInfo } from '@/hooks/use-chat-request';
import { useExternalTrace } from '@/hooks/user-external-trace';
import i18n from '@/locales/config';
import { useSendButtonDisabled } from '@/pages/chat/hooks';
import { buildMessageUuidWithRole } from '@/utils/chat';
import { Input, Modal } from 'antd';
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { v4 as uuidv4 } from 'uuid';
import { externalHistoryService } from '@/services/external-history-service';
import {
  useGetSharedChatSearchParams,
  useSendSharedMessage,
} from '../hooks/use-send-shared-message';
import { buildMessageItemReference } from '../utils';

/**
 * ChatContainer component for displaying and interacting with shared chat conversations.
 * It handles fetching chat data, managing messages, and user input.
 */
const ChatContainer = () => {
  const { t } = useTranslation();
  const {
    sharedId: conversationId,
    from,
    locale,
    theme,
    visibleAvatar,
    email,
  } = useGetSharedChatSearchParams();

  /**
   * Sync theme from URL parameter
   */
  useSyncThemeFromParams(theme);

  /**
   * useClickDrawer hook for handling document click events
   */
  const { visible, hideModal, documentId, selectedChunk, clickDocumentButton } =
    useClickDrawer();

  /**
   * useSendSharedMessage hook for handling message sending
   */
  const {
    handlePressEnter,
    handleInputChange,
    value,
    sendLoading,
    derivedMessages,
    hasError,
    stopOutputMessage,
    scrollRef,
    messageContainerRef,
    resetSession,
  } = useSendSharedMessage();

  /**
   * useSendButtonDisabled hook for handling send button disabled state
   */
  const sendDisabled = useSendButtonDisabled(value);

  /**
   * useFetchExternalChatInfo hook for fetching chat info
   */
  const { data: chatInfo } = useFetchExternalChatInfo();

  /**
   * useExternalTrace hook for tracing user and assistant messages
   */
  const [lastQuestion, setLastQuestion] = useState<string>('');

  /*  *
   * Get user ID (email) from URL params
   */
  const [internalChatId, setInternalChatId] = useState<string>(() => {
    const newId = uuidv4();
    console.log('[ChatContainer] Initializing internalChatId:', newId);
    return newId;
  });

  /**
   * useExternalTrace hook for tracing user and assistant messages
   */
  const {
    traceUserMessage,
    traceAssistantResponse,
    traceScore,
    setLastTraceId,
  } = useExternalTrace({
    email,
    chatId: internalChatId,
  });

  // Feedback Modal State
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [feedbackComment, setFeedbackComment] = useState('');

  const handleLike = useCallback(() => {
    traceScore(1);
  }, [traceScore]);

  const handleDislike = useCallback(() => {
    setFeedbackVisible(true);
  }, []);

  const handleFeedbackSubmit = useCallback(() => {
    traceScore(0, feedbackComment);
    setFeedbackVisible(false);
    setFeedbackComment('');
  }, [traceScore, feedbackComment]);

  const handleFeedbackCancel = useCallback(() => {
    setFeedbackVisible(false);
    setFeedbackComment('');
  }, []);

  /**
   * Handle press enter for sending message
   */
  const handlePressEnterWrapped = (documentIds: string[]) => {
    const currentQuestion = value;
    setLastQuestion(currentQuestion);
    handlePressEnter(documentIds);
    traceUserMessage(currentQuestion);
  };

  // Track the last traced message ID to avoid duplicate traces
  const lastTracedMessageId = useRef<string | null>(null);
  // Track if a trace is pending (setTimeout in progress)
  const pendingTraceRef = useRef<boolean>(false);
  // Ref to access latest derivedMessages inside setTimeout
  const derivedMessagesRef = useRef(derivedMessages);
  derivedMessagesRef.current = derivedMessages;

  /**
   * Handle completed assistant messages - trace when:
   * 1. Not currently loading (stream finished)
   * 2. Have a pending question
   * 3. Have a new assistant message we haven't traced yet
   * 
   * Uses derivedMessagesRef to fetch LATEST content inside setTimeout
   */
  useEffect(() => {
    // Debug: Log all relevant state on every effect run
    console.log('[ChatContainer] Trace effect triggered:', {
      sendLoading,
      lastQuestion: lastQuestion ? lastQuestion.substring(0, 30) + '...' : null,
      messagesCount: derivedMessages?.length ?? 0,
      lastMsgRole: derivedMessages?.[derivedMessages.length - 1]?.role,
      lastMsgContentLength: derivedMessages?.[derivedMessages.length - 1]?.content?.length,
      lastTracedId: lastTracedMessageId.current,
      pendingTrace: pendingTraceRef.current,
      hasError,
    });

    // Skip if still loading
    if (sendLoading) {
      console.log('[ChatContainer] ⏳ Skip: Still loading');
      return;
    }

    // Skip if a trace is already pending
    if (pendingTraceRef.current) {
      console.log('[ChatContainer] ⏳ Skip: Trace already pending');
      return;
    }

    // Skip if no messages or no pending question
    if (!derivedMessages || derivedMessages.length === 0) {
      console.log('[ChatContainer] ⏳ Skip: No messages');
      return;
    }

    if (!lastQuestion) {
      console.log('[ChatContainer] ⏳ Skip: No lastQuestion');
      return;
    }

    const lastMsg = derivedMessages[derivedMessages.length - 1];

    // Only process assistant messages
    if (lastMsg.role !== MessageType.Assistant) {
      console.log('[ChatContainer] ⏳ Skip: Last message is not assistant, role:', lastMsg.role);
      return;
    }

    // Generate a unique ID based on message ID and messages count (not content which changes)
    const messageId = lastMsg.id || `msg_${derivedMessages.length}`;

    // Skip if already traced this message
    if (lastTracedMessageId.current === messageId) {
      console.log('[ChatContainer] ⏳ Skip: Already traced this message:', messageId);
      return;
    }

    // Skip if has error or no content
    if (hasError) {
      console.log('[ChatContainer] ⏳ Skip: Has error');
      return;
    }

    if (typeof lastMsg.content !== 'string') {
      console.log('[ChatContainer] ⏳ Skip: Content is not string, type:', typeof lastMsg.content);
      return;
    }

    console.log('[ChatContainer] ✅ All checks passed, scheduling trace for:', messageId);

    // Mark this message as traced and pending BEFORE making API calls
    lastTracedMessageId.current = messageId;
    pendingTraceRef.current = true;

    // Capture question now (it won't change)
    const capturedQuestion = lastQuestion;
    const capturedMessageIndex = derivedMessages.length - 1;

    // Add delay to ensure stream data is fully settled before sending
    // Then fetch LATEST content from derivedMessagesRef inside the callback
    const delayMs = 1000; // Increased delay to allow content to fully settle
    setTimeout(() => {
      // Mark pending as complete
      pendingTraceRef.current = false;

      // Get LATEST content from ref (not captured value)
      const latestMessages = derivedMessagesRef.current;
      const latestMsg = latestMessages?.[capturedMessageIndex];

      if (!latestMsg) {
        console.warn('[ChatContainer] Message not found at index:', capturedMessageIndex);
        return;
      }

      const latestContent = latestMsg.content;
      const latestReference = latestMsg.reference;

      console.log('[ChatContainer] Tracing completed assistant response after delay:', {
        messageId,
        capturedIndex: capturedMessageIndex,
        contentLength: latestContent?.length,
        content: latestContent?.substring(0, 100) + '...',
        hasReference: !!latestReference,
        docAggs: latestReference?.doc_aggs,
      });

      // Trace to external trace API
      traceAssistantResponse(capturedQuestion, latestContent);

      // Validate required fields for history API
      const sessionId = internalChatId;
      const userPrompt = capturedQuestion;
      const llmResponse = latestContent;

      if (!sessionId || !userPrompt || !llmResponse) {
        console.warn('[ChatContainer] Missing required fields for history API:', {
          hasSessionId: !!sessionId,
          hasUserPrompt: !!userPrompt,
          hasLlmResponse: !!llmResponse,
        });
        return;
      }

      // Send to External History API with full citation data
      const citations = latestReference?.doc_aggs?.map((x) => x.doc_name) ?? [];
      console.log('[ChatContainer] Sending to history API:', {
        session_id: sessionId,
        user_prompt: userPrompt.substring(0, 50) + '...',
        llm_response: llmResponse.substring(0, 50) + '...',
        llm_response_length: llmResponse.length,
        citations,
      });

      externalHistoryService.sendChatHistory({
        session_id: sessionId,
        user_prompt: userPrompt,
        llm_response: llmResponse,
        citations: citations,
        user_email: email,
      });
    }, delayMs);

    // Note: Not using cleanup to cancel timeout because lastTracedMessageId ref
    // already prevents duplicate traces. The timeout should complete even if
    // the effect re-runs due to dependency changes.
  }, [
    sendLoading,
    derivedMessages,
    lastQuestion,
    traceAssistantResponse,
    hasError,
    email,
    internalChatId,
  ]);

  /**
   * Handle reset for chat
   */
  const handleReset = async () => {
    await resetSession();
    setLastTraceId(uuidv4());
    setInternalChatId(uuidv4());
  };

  /**
   * Get avatar data
   */
  const useFetchAvatar = useMemo(() => {
    return from === SharedFrom.Agent
      ? useFetchFlowSSE
      : useFetchNextConversationSSE;
  }, [from]);

  /**
   * Set locale and visible avatar
   */
  React.useEffect(() => {
    if (locale && i18n.language !== locale) {
      i18n.changeLanguage(locale);
    }
  }, [locale, visibleAvatar]);

  /**
   * Fetch avatar data
   */
  const { data: avatarData } = useFetchAvatar();

  if (!conversationId) {
    return <div>{t('chat.emptyConversation')}</div>;
  }

  return (
    <>
      <EmbedContainer title={chatInfo.title} avatar={chatInfo.avatar}>
        <div className="flex flex-1 flex-col p-2.5  h-[90vh] m-3">
          <div
            className={
              'flex flex-1 flex-col overflow-auto scrollbar-auto m-auto w-5/6'
            }
            ref={messageContainerRef}
          >
            <div>
              {derivedMessages?.map((message, i) => {
                return (
                  <MessageItem
                    visibleAvatar={visibleAvatar}
                    key={buildMessageUuidWithRole(message)}
                    avatarDialog={avatarData?.avatar}
                    item={message}
                    nickname={t('chat.you')}
                    reference={buildMessageItemReference(
                      {
                        message: derivedMessages,
                        reference: [],
                      },
                      message,
                    )}
                    loading={
                      message.role === MessageType.Assistant &&
                      sendLoading &&
                      derivedMessages?.length - 1 === i
                    }
                    index={i}
                    clickDocumentButton={clickDocumentButton}
                    showLikeButton={true}
                    showLoudspeaker={false}
                    onLike={handleLike}
                    onDislike={handleDislike}
                    disableInternalFeedback={true}
                  ></MessageItem>
                );
              })}
            </div>
            <div ref={scrollRef} />
          </div>
          <div className="flex w-full justify-center mb-8">
            <div className="w-5/6">
              <NextMessageInput
                isShared
                value={value}
                disabled={hasError}
                sendDisabled={sendDisabled}
                conversationId={conversationId}
                onInputChange={handleInputChange}
                onPressEnter={handlePressEnterWrapped}
                sendLoading={sendLoading}
                uploadMethod="external_upload_and_parse"
                showUploadIcon={false}
                stopOutputMessage={stopOutputMessage}
              ></NextMessageInput>
            </div>
          </div>
        </div>
      </EmbedContainer>

      <Modal
        title={t('feedback.title', 'Provide Feedback')}
        open={feedbackVisible}
        onOk={handleFeedbackSubmit}
        onCancel={handleFeedbackCancel}
      >
        <Input.TextArea
          rows={4}
          value={feedbackComment}
          onChange={(e) => setFeedbackComment(e.target.value)}
          placeholder={t(
            'feedback.placeholder',
            'Please verify your feedback...',
          )}
        />
      </Modal>

      {visible && (
        <PdfDrawer
          visible={visible}
          hideModal={hideModal}
          documentId={documentId}
          chunk={selectedChunk}
        ></PdfDrawer>
      )}
    </>
  );
};

export default forwardRef(ChatContainer);

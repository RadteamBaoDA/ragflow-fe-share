import { EmbedContainer } from '@/components/embed-container';
import { NextMessageInputOnPressEnterParameter } from '@/components/message-input/next';
import { NextMessageInput } from '@/components/message-input/next';
import MessageItem from '@/components/message-item';
import PdfSheet from '@/components/pdf-drawer';
import { useClickDrawer } from '@/components/pdf-drawer/hooks';
import { useSyncThemeFromParams } from '@/components/theme-provider';
import { MessageType, SharedFrom } from '@/constants/chat';
import { useExternalTrace } from '@/hooks/user-external-trace';
import { useFetchFlowSSE } from '@/hooks/use-agent-request';
import {
  useFetchExternalChatInfo,
  useFetchNextConversationSSE,
} from '@/hooks/use-chat-request';
import i18n from '@/locales/config';
import { externalHistoryService } from '@/services/external-history-service';
import { Input, Modal } from 'antd';
import { buildMessageUuidWithRole } from '@/utils/chat';
import React, { forwardRef, useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { v4 as uuidv4 } from 'uuid';
import { useSendButtonDisabled } from '../hooks/use-button-disabled';
import {
  useGetSharedChatSearchParams,
  useSendSharedMessage,
} from '../hooks/use-send-shared-message';
import { buildMessageItemReference } from '../utils';

const ChatContainer = () => {
  const {
    sharedId: conversationId,
    from,
    locale,
    theme,
    visibleAvatar,
    email,
  } = useGetSharedChatSearchParams();
  const { t } = useTranslation();
  useSyncThemeFromParams(theme);
  const { visible, hideModal, documentId, selectedChunk, clickDocumentButton } =
    useClickDrawer();

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
    errorMessage,
    clearError,
    removeAllMessagesExceptFirst,
  } = useSendSharedMessage();
  const sendDisabled = useSendButtonDisabled(value);
  const { data: chatInfo } = useFetchExternalChatInfo();
  const [lastQuestion, setLastQuestion] = useState<string>('');
  const [internalChatId] = useState<string>(() => uuidv4());
  const { traceUserMessage, traceAssistantResponse, traceScore } =
    useExternalTrace({
      email,
      chatId: internalChatId,
      shareId: conversationId || undefined,
    });
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
  }, [feedbackComment, traceScore]);

  const handleFeedbackCancel = useCallback(() => {
    setFeedbackVisible(false);
    setFeedbackComment('');
  }, []);

  const handlePressEnterWrapped = useCallback(
    (params: NextMessageInputOnPressEnterParameter) => {
      const currentQuestion = value.trim();
      if (currentQuestion) {
        setLastQuestion(currentQuestion);
        traceUserMessage(currentQuestion);
      }
      clearError?.();
      handlePressEnter(params);
    },
    [clearError, handlePressEnter, traceUserMessage, value],
  );

  const lastTracedMessageId = useRef<string | null>(null);
  const pendingTraceRef = useRef<boolean>(false);
  const derivedMessagesRef = useRef(derivedMessages);
  derivedMessagesRef.current = derivedMessages;

  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'INSERT_PROMPT') {
        const textarea = document.querySelector('textarea');
        if (textarea) {
          const nativeTextareaValueSetter = Object.getOwnPropertyDescriptor(
            window.HTMLTextAreaElement.prototype,
            'value',
          )?.set;
          if (nativeTextareaValueSetter) {
            nativeTextareaValueSetter.call(textarea, event.data.payload);
          } else {
            textarea.value = event.data.payload;
          }
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
          textarea.focus();
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  React.useEffect(() => {
    if (sendLoading || pendingTraceRef.current) return;
    if (!derivedMessages?.length || !lastQuestion || hasError) return;

    const lastMsg = derivedMessages[derivedMessages.length - 1];
    if (lastMsg.role !== MessageType.Assistant) return;
    if (typeof lastMsg.content !== 'string') return;

    const messageId = lastMsg.id || `msg_${derivedMessages.length}`;
    if (lastTracedMessageId.current === messageId) return;

    lastTracedMessageId.current = messageId;
    pendingTraceRef.current = true;

    const capturedQuestion = lastQuestion;
    const capturedMessageIndex = derivedMessages.length - 1;

    setTimeout(() => {
      pendingTraceRef.current = false;
      const latestMsg = derivedMessagesRef.current?.[capturedMessageIndex];
      if (!latestMsg || typeof latestMsg.content !== 'string') return;

      traceAssistantResponse(capturedQuestion, latestMsg.content);

      const uniqueDocs = new Map<
        string,
        { document_name: string; document_id: string }
      >();

      latestMsg.reference?.doc_aggs?.forEach((doc: any) => {
        if (doc?.doc_id && doc?.doc_name) {
          uniqueDocs.set(doc.doc_id, {
            document_name: doc.doc_name,
            document_id: doc.doc_id,
          });
        }
      });

      latestMsg.reference?.chunks?.forEach((doc: any) => {
        if (doc?.document_id && doc?.document_name) {
          uniqueDocs.set(doc.document_id, {
            document_name: doc.document_name,
            document_id: doc.document_id,
          });
        }
      });

      const docs = Array.from(uniqueDocs.values());

      externalHistoryService.sendChatHistory({
        session_id: internalChatId,
        share_id: conversationId || undefined,
        user_email: email || undefined,
        user_prompt: capturedQuestion,
        llm_response: latestMsg.content,
        citations: docs,
        file_results: docs,
      });
    }, 1000);
  }, [
    conversationId,
    derivedMessages,
    email,
    hasError,
    internalChatId,
    lastQuestion,
    sendLoading,
    traceAssistantResponse,
  ]);

  const useFetchAvatar = useMemo(() => {
    return from === SharedFrom.Agent
      ? useFetchFlowSSE
      : useFetchNextConversationSSE;
  }, [from]);
  React.useEffect(() => {
    if (locale && i18n.language !== locale) {
      i18n.changeLanguage(locale);
    }
  }, [locale, visibleAvatar]);

  const { data: avatarData } = useFetchAvatar();

  if (!conversationId) {
    return <div>{t('chat.emptyConversation')}</div>;
  }

  return (
    <>
      <EmbedContainer
        title={chatInfo.title}
        avatar={chatInfo.avatar}
        handleReset={removeAllMessagesExceptFirst}
      >
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
                    nickname="You"
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
                    showPrompt={false}
                  ></MessageItem>
                );
              })}
            </div>
            {errorMessage && !sendLoading && (
              <div className="flex flex-col items-start p-4 mb-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                <p className="text-red-600 dark:text-red-400 text-sm">
                  {errorMessage === 'TIMEOUT'
                    ? t('chat.errorTimeout')
                    : errorMessage === 'NETWORK'
                      ? t('chat.errorNetwork')
                      : errorMessage === 'SERVER'
                        ? t('chat.errorServer')
                        : t('chat.errorGeneric', { message: errorMessage })}
                </p>
              </div>
            )}
            <div ref={scrollRef} />
          </div>
          <div className="flex w-full justify-center mb-8">
            <div className="w-5/6">
              <NextMessageInput
                isShared
                value={value}
                disabled={hasError}
                sendDisabled={sendDisabled}
                resize="vertical"
                conversationId={conversationId}
                onInputChange={handleInputChange}
                onPressEnter={handlePressEnterWrapped}
                sendLoading={sendLoading}
                uploadMethod="external_upload_and_parse"
                showUploadIcon={false}
                stopOutputMessage={stopOutputMessage}
                showReasoning
                showInternet={chatInfo?.has_tavily_key}
              ></NextMessageInput>
            </div>
          </div>
        </div>
      </EmbedContainer>
      {visible && (
        <PdfSheet
          visible={visible}
          hideModal={hideModal}
          documentId={documentId}
          chunk={selectedChunk}
        ></PdfSheet>
      )}
      <Modal
        title={t('feedback.title') || 'Provide Feedback'}
        open={feedbackVisible}
        onOk={handleFeedbackSubmit}
        onCancel={handleFeedbackCancel}
      >
        <Input.TextArea
          rows={4}
          value={feedbackComment}
          onChange={(e) => setFeedbackComment(e.target.value)}
          placeholder={
            t('feedback.placeholder') || 'Please verify your feedback...'
          }
        />
      </Modal>
    </>
  );
};

export default forwardRef(ChatContainer);

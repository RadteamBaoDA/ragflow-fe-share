import PdfSheet from '@/components/pdf-drawer';
import { useClickDrawer } from '@/components/pdf-drawer/hooks';
import { MessageType, SharedFrom } from '@/constants/chat';
import { useFetchExternalAgentInputs } from '@/hooks/use-agent-request';
import { useFetchExternalChatInfo } from '@/hooks/use-chat-request';
import i18n from '@/locales/config';
import { useSendNextSharedMessage } from '@/pages/agent/hooks/use-send-shared-message';
import { MessageCircle, Minimize2, Send, X } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  useGetSharedChatSearchParams,
  useSendSharedMessage,
} from '../pages/next-chats/hooks/use-send-shared-message';
import FloatingChatWidgetMarkdown from './floating-chat-widget-markdown';
import { externalHistoryService } from '@/services/external-history-service';
import { useExternalTrace } from '@/hooks/user-external-trace';
import { v4 as uuidv4 } from 'uuid';
import { useTranslation } from 'react-i18next';
import { useSyncThemeFromParams } from './theme-provider';

const FloatingChatWidget = () => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [lastQuestion, setLastQuestion] = useState<string>('');
  const [lastResponseId, setLastResponseId] = useState<string | null>(null);
  const [displayMessages, setDisplayMessages] = useState<any[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const windowModeScrollRef = useRef<HTMLDivElement>(null);
  const fullModeScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      const element = e.currentTarget as HTMLElement;
      const isAtTop = element.scrollTop === 0;
      const isAtBottom =
        element.scrollTop + element.clientHeight >=
        element.scrollHeight - 1;

      // Allow scroll to pass through to parent when at boundaries
      if ((isAtTop && e.deltaY < 0) || (isAtBottom && e.deltaY > 0)) {
        e.preventDefault();
        e.stopPropagation();
        // Let the parent handle the scroll
        window.parent.postMessage(
          {
            type: 'SCROLL_PASSTHROUGH',
            deltaY: e.deltaY,
          },
          '*',
        );
      }
    };

    const attach = (ref: React.RefObject<HTMLDivElement>) => {
      if (ref.current) {
        ref.current.addEventListener('wheel', handleWheel, { passive: false });
        // Use a stable cleanup function
        const el = ref.current;
        return () => el.removeEventListener('wheel', handleWheel);
      }
    };

    const cleanupWindow = attach(windowModeScrollRef);
    const cleanupFull = attach(fullModeScrollRef);

    return () => {
      cleanupWindow?.();
      cleanupFull?.();
    };
  }, [isOpen, isMinimized]); // Re-attach when layout/visibility changes


  const {
    sharedId: conversationId,
    locale,
    from,
    email,
    theme
  } = useGetSharedChatSearchParams();

  // Generate a session ID for tracing this specific interaction
  const [sessionId] = useState<string>(() => uuidv4());

  const {
    traceUserMessage,
    traceAssistantResponse,
  } = useExternalTrace({
    email: email || '', // Use email from URL params, fallback to empty for anonymous
    chatId: sessionId,
    shareId: conversationId || undefined,
  });

  const isFromAgent = from === SharedFrom.Agent;

  // Check if we're in button-only mode or window-only mode
  const urlParams = new URLSearchParams(window.location.search);
  const mode = urlParams.get('mode') || 'full'; // 'button', 'window', or 'full'
  const enableStreaming = urlParams.get('streaming') === 'true'; // Only enable if explicitly set to true

  const {
    handlePressEnter,
    handleInputChange,
    value: hookValue,
    sendLoading,
    derivedMessages,
    hasError,
  } = (isFromAgent ? useSendNextSharedMessage : useSendSharedMessage)(() => { });

  // Sync our local input with the hook's value when needed
  useEffect(() => {
    if (hookValue && hookValue !== inputValue) {
      setInputValue(hookValue);
    }
  }, [hookValue, inputValue]);

  const { data } = (
    isFromAgent ? useFetchExternalAgentInputs : useFetchExternalChatInfo
  )();

  const title = data.title;

  const { visible, hideModal, documentId, selectedChunk, clickDocumentButton } =
    useClickDrawer();

  useSyncThemeFromParams(theme);
  // PDF drawer state tracking
  useEffect(() => {
    // Tell parent to resize iframe based on drawer visibility
    window.parent.postMessage(
      {
        type: 'RESIZE_IFRAME',
        expanded: visible,
      },
      '*',
    );
  }, [visible]);

  // Play sound when opening
  const playNotificationSound = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        audioContext.currentTime + 0.3,
      );

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
      // Silent fail if audio not supported
    }
  }, []);

  // Play sound for AI responses (Intercom-style)
  const playResponseSound = useCallback(() => {
    try {
      const audioContext = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 600;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        audioContext.currentTime + 0.2,
      );

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.2);
    } catch (error) {
      // Silent fail if audio not supported
    }
  }, []);

  // Set loaded state and locale
  useEffect(() => {
    // Set component as loaded after a brief moment to prevent flash
    const timer = setTimeout(() => {
      setIsLoaded(true);
      // Tell parent window that we're ready to be shown
      window.parent.postMessage(
        {
          type: 'WIDGET_READY',
        },
        '*',
      );
    }, 50);

    if (locale && i18n.language !== locale) {
      i18n.changeLanguage(locale);
    }

    return () => clearTimeout(timer);
  }, [locale]);

  // Handle message display based on streaming preference
  useEffect(() => {
    if (!derivedMessages) {
      setDisplayMessages([]);
      return;
    }

    if (enableStreaming) {
      // Show messages as they stream
      setDisplayMessages(derivedMessages);
    } else {
      // Only show complete messages (non-streaming mode)
      const completeMessages = derivedMessages.filter((msg, index) => {
        // Always show user messages immediately
        if (msg.role === MessageType.User) return true;

        // For AI messages, only show when response is complete (not loading)
        if (msg.role === MessageType.Assistant) {
          return !sendLoading || index < derivedMessages.length - 1;
        }

        return true;
      });
      setDisplayMessages(completeMessages);
    }
  }, [derivedMessages, enableStreaming, sendLoading]);

  // Auto-scroll to bottom when display messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [displayMessages]);

  // Render different content based on mode
  // Master mode - handles everything and creates second iframe dynamically
  useEffect(() => {
    if (mode !== 'master') return;
    // Create the chat window iframe dynamically when needed
    const createChatWindow = () => {
      // Check if iframe already exists in parent document
      window.parent.postMessage(
        {
          type: 'CREATE_CHAT_WINDOW',
          src: window.location.href.replace('mode=master', 'mode=window'),
        },
        '*',
      );
    };

    createChatWindow();

    // Listen for our own toggle events to show/hide the dynamic iframe
    const handleToggle = (e: MessageEvent) => {
      if (e.source === window) return; // Ignore our own messages

      const chatWindow = document.getElementById(
        'dynamic-chat-window',
      ) as HTMLIFrameElement;
      if (chatWindow && e.data.type === 'TOGGLE_CHAT') {
        chatWindow.style.display = e.data.isOpen ? 'block' : 'none';
      }
    };

    window.addEventListener('message', handleToggle);
    return () => window.removeEventListener('message', handleToggle);
  }, [mode]);

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


    // In master/button mode, we delegate tracing to the window/full mode instance to avoid duplicates
    if (mode === 'master' || mode === 'button') {

      return;
    }

    // Skip if still loading
    if (sendLoading) {

      return;
    }

    // Skip if a trace is already pending
    if (pendingTraceRef.current) {

      return;
    }

    // Skip if no messages or no pending question
    if (!derivedMessages || derivedMessages.length === 0) {

      return;
    }



    if (!lastQuestion) {

      return;
    }

    // Explicitly skip if we only have 1 message (or 0).
    // A valid trace interaction requires at least [User, Assistant] (length 2)
    // or [Greeting, User, Assistant] (length 3).
    // If length is 1, it's just the initial greeting, and we should NOT trace it
    // even if 'lastQuestion' has just been updated by the user (race condition).
    if (derivedMessages.length <= 1) {

      return;
    }

    const lastMsg = derivedMessages[derivedMessages.length - 1];

    // Only process assistant messages
    if (lastMsg.role !== MessageType.Assistant) {

      return;
    }

    // Generate a unique dedupe ID based on message INDEX.
    // We avoid using lastMsg.id because it can change from undefined/temp to a real UUID
    // after the stream finishes (and we get a response from backend), which would cause
    // a double-trace (once for temp ID, once for real ID).
    // The index in derivedMessages is stable for the append-only chat.
    const messageIndex = derivedMessages.length - 1;
    const dedupeId = `msg_index_${messageIndex}`;

    // Skip if already traced this message index
    if (lastTracedMessageId.current === dedupeId) {

      return;
    }


    // Skip if has error or no content
    if (hasError) {

      return;
    }

    if (typeof lastMsg.content !== 'string') {

      return;
    }



    // Mark this message as traced and pending BEFORE making API calls
    lastTracedMessageId.current = dedupeId;
    pendingTraceRef.current = true;

    // Capture question now (it won't change)
    const capturedQuestion = lastQuestion;
    const capturedMessageIndex = derivedMessages.length - 1;

    // Add delay to ensure data is fully settled
    const delayMs = 1000;
    setTimeout(() => {
      // Mark pending as complete
      pendingTraceRef.current = false;

      // Get LATEST content from ref
      const latestMessages = derivedMessagesRef.current;
      const latestMsg = latestMessages?.[capturedMessageIndex];

      if (!latestMsg) {
        console.warn('[FloatingChatWidget] Message not found at index:', capturedMessageIndex);
        return;
      }

      const latestContent = latestMsg.content;
      const latestReference = latestMsg.reference;



      // Play sound only for new complete responses (avoid duplicates via lastResponseId)
      if (dedupeId !== lastResponseId) {
        setLastResponseId(dedupeId);
        playResponseSound();
      }

      // Trace to external trace API
      if (capturedQuestion && capturedQuestion.trim() !== '') {
        traceAssistantResponse(capturedQuestion, latestContent);
      } else {

        return;
      }

      // Construct payload for history API
      const payload = {
        session_id: sessionId,
        share_id: conversationId || undefined,
        user_email: email,
        user_prompt: capturedQuestion,
        llm_response: latestContent,
        citations: latestReference?.chunks?.map((c: any) => c.document_name) || [],
      };



      externalHistoryService.sendChatHistory(payload);
    }, delayMs);
  }, [
    sendLoading,
    derivedMessages,
    lastQuestion,
    traceAssistantResponse,
    hasError,
    email,
    sessionId,
    conversationId,
    lastResponseId,
    playResponseSound,
  ]);

  const toggleChat = useCallback(() => {
    if (mode === 'button') {
      // In button mode, communicate with parent window to show/hide chat window
      window.parent.postMessage(
        {
          type: 'TOGGLE_CHAT',
          isOpen: !isOpen,
        },
        '*',
      );
      setIsOpen(!isOpen);
      if (!isOpen) {
        playNotificationSound();
      }
    } else {
      // In full mode, handle locally
      if (!isOpen) {
        setIsOpen(true);
        setIsMinimized(false);
        playNotificationSound();
      } else {
        setIsOpen(false);
        setIsMinimized(false);
      }
    }
  }, [isOpen, mode, playNotificationSound]);

  const minimizeChat = useCallback(() => {
    setIsMinimized(true);
  }, []);

  const handleSendMessage = useCallback(() => {
    if (!inputValue.trim() || sendLoading) return;

    // Update the hook's internal state first
    const syntheticEvent = {
      target: { value: inputValue },
      currentTarget: { value: inputValue },
      preventDefault: () => { },
    } as any;

    handleInputChange(syntheticEvent);

    // Capture the question
    setLastQuestion(inputValue);

    // Trace user message
    traceUserMessage(inputValue);

    // Wait for state to update, then send
    setTimeout(() => {
      handlePressEnter([]);
      // Clear our local input after sending
      setInputValue('');
    }, 50);
  }, [inputValue, sendLoading, handleInputChange, handlePressEnter]);

  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    },
    [handleSendMessage],
  );

  if (!conversationId) {
    return (
      <div className="fixed bottom-5 right-5 z-50">
        <div className="bg-red-500 text-white p-4 rounded-lg shadow-lg">
          {t('chatWidget.errorNoId')}
        </div>
      </div>
    );
  }

  // Remove the blocking return - we'll handle visibility with CSS instead

  const messageCount = displayMessages?.length || 0;

  // Show just the button in master mode
  if (mode === 'master') {
    return (
      <div
        className={`fixed bottom-6 right-6 z-50 transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
      >
        <button
          type="button"
          onClick={() => {
            const newIsOpen = !isOpen;
            setIsOpen(newIsOpen);
            if (newIsOpen) playNotificationSound();

            // Tell the parent to show/hide the dynamic iframe
            window.parent.postMessage(
              {
                type: 'TOGGLE_CHAT',
                isOpen: newIsOpen,
              },
              '*',
            );
          }}
          className={`w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-all duration-300 flex items-center justify-center group ${isOpen ? 'scale-95' : 'scale-100 hover:scale-105'
            }`}
        >
          <div
            className={`transition-transform duration-300 ${isOpen ? 'rotate-45' : 'rotate-0'}`}
          >
            {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
          </div>
        </button>

        {/* Unread Badge */}
        {!isOpen && messageCount > 0 && (
          <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
            {messageCount > 9 ? '9+' : messageCount}
          </div>
        )}
      </div>
    );
  }

  if (mode === 'button') {
    // Only render the floating button
    return (
      <div
        className={`fixed bottom-6 right-6 z-50 transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
      >
        <button
          type="button"
          onClick={toggleChat}
          className={`w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-all duration-300 flex items-center justify-center group ${isOpen ? 'scale-95' : 'scale-100 hover:scale-105'
            }`}
        >
          <div
            className={`transition-transform duration-300 ${isOpen ? 'rotate-45' : 'rotate-0'}`}
          >
            {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
          </div>
        </button>

        {/* Unread Badge */}
        {!isOpen && messageCount > 0 && (
          <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
            {messageCount > 9 ? '9+' : messageCount}
          </div>
        )}
      </div>
    );
  }

  if (mode === 'window') {
    // Only render the chat window (always open)
    return (
      <>
        <div
          className={`fixed top-0 left-0 z-50 bg-blue-600 rounded-2xl transition-all duration-300 ease-out h-[500px] w-[380px] overflow-hidden ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-2xl">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                <MessageCircle size={18} />
              </div>
              <div>
                <h3 className="font-semibold text-sm">
                  {title || t('chatWidget.title')}
                </h3>
                <p className="text-xs text-blue-100">
                  {t('chatWidget.replyText')}
                </p>
              </div>
            </div>
          </div>

          {/* Messages and Input */}
          <div
            className="flex flex-col h-[436px] bg-white"
            style={{ borderRadius: '0 0 16px 16px' }}
          >
            <div
              ref={windowModeScrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-4"
            >
              {displayMessages?.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === MessageType.User ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[280px] px-4 py-2 rounded-2xl ${message.role === MessageType.User
                      ? 'bg-blue-600 text-white rounded-br-md'
                      : 'bg-gray-100 text-gray-800 rounded-bl-md'
                      }`}
                  >
                    {message.role === MessageType.User ? (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">
                        {message.content}
                      </p>
                    ) : (
                      <FloatingChatWidgetMarkdown
                        loading={false}
                        content={message.content}
                        reference={
                          message.reference || {
                            doc_aggs: [],
                            chunks: [],
                            total: 0,
                          }
                        }
                        clickDocumentButton={clickDocumentButton}
                      />
                    )}
                  </div>
                </div>
              ))}

              {/* Clean Typing Indicator */}
              {sendLoading && !enableStreaming && (
                <div className="flex justify-start pl-4">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                    <div
                      className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                      style={{ animationDelay: '0.1s' }}
                    ></div>
                    <div
                      className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
                      style={{ animationDelay: '0.2s' }}
                    ></div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="border-t border-gray-200 p-4">
              <div className="flex items-end space-x-3">
                <div className="flex-1">
                  <textarea
                    value={inputValue}
                    onChange={(e) => {
                      const newValue = e.target.value;
                      setInputValue(newValue);
                      handleInputChange(e);
                    }}

                    onKeyPress={handleKeyPress}
                    placeholder={t('chatWidget.placeholder')}
                    rows={1}
                    className="w-full resize-none border border-gray-300 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                    style={{ minHeight: '44px', maxHeight: '120px' }}
                    disabled={hasError || sendLoading}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSendMessage}
                  disabled={!inputValue.trim() || sendLoading}
                  className="p-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          </div>
        </div>
        {visible && (
          <PdfSheet
            visible={visible}
            hideModal={hideModal}
            documentId={documentId}
            chunk={selectedChunk}
            width={'100vw'}
            height={'100vh'}
          />
        )}
      </>
    );
  } // Full mode - render everything together (original behavior)
  return (
    <div
      className={`transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
    >
      {/* Chat Widget Container */}
      {isOpen && (
        <div
          className={`fixed bottom-24 right-6 z-50 bg-blue-600 rounded-2xl transition-all duration-300 ease-out ${isMinimized ? 'h-16' : 'h-[500px]'
            } w-[380px] overflow-hidden`}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-2xl">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                <MessageCircle size={18} />
              </div>
              <div>
                <h3 className="font-semibold text-sm">
                  {title || t('chatWidget.title')}
                </h3>
                <p className="text-xs text-blue-100">
                  {t('chatWidget.replyText')}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-1">
              <button
                type="button"
                onClick={minimizeChat}
                className="p-1.5 hover:bg-white hover:bg-opacity-20 rounded-full transition-colors"
              >
                <Minimize2 size={16} />
              </button>
              <button
                type="button"
                onClick={toggleChat}
                className="p-1.5 hover:bg-white hover:bg-opacity-20 rounded-full transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Messages Container */}
          {!isMinimized && (
            <div
              className="flex flex-col h-[436px] bg-white"
              style={{ borderRadius: '0 0 16px 16px' }}
            >
              <div
                ref={fullModeScrollRef}
                className="flex-1 overflow-y-auto p-4 space-y-4"
              >
                {displayMessages?.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${message.role === MessageType.User ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[280px] px-4 py-2 rounded-2xl ${message.role === MessageType.User
                        ? 'bg-blue-600 text-white rounded-br-md'
                        : 'bg-gray-100 text-gray-800 rounded-bl-md'
                        }`}
                    >
                      {message.role === MessageType.User ? (
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                          {message.content}
                        </p>
                      ) : (
                        <FloatingChatWidgetMarkdown
                          loading={false}
                          content={message.content}
                          reference={
                            message.reference || {
                              doc_aggs: [],
                              chunks: [],
                              total: 0,
                            }
                          }
                          clickDocumentButton={clickDocumentButton}
                        />
                      )}
                    </div>
                  </div>
                ))}

                {/* Typing Indicator */}
                {sendLoading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
                      <div className="flex space-x-1">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                        <div
                          className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                          style={{ animationDelay: '0.1s' }}
                        ></div>
                        <div
                          className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                          style={{ animationDelay: '0.2s' }}
                        ></div>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className="border-t border-gray-200 p-4">
                <div className="flex items-end space-x-3">
                  <div className="flex-1">
                    <textarea
                      value={inputValue}
                      onChange={(e) => {
                        const newValue = e.target.value;
                        setInputValue(newValue);
                        // Also update the hook's state
                        handleInputChange(e);
                      }}
                      onKeyPress={handleKeyPress}
                      placeholder={t('chatWidget.placeholder')}
                      rows={1}
                      className="w-full resize-none border border-gray-300 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-black"
                      style={{ minHeight: '44px', maxHeight: '120px' }}
                      disabled={hasError || sendLoading}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSendMessage}
                    disabled={!inputValue.trim() || sendLoading}
                    className="p-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Send size={18} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Floating Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          type="button"
          onClick={toggleChat}
          className={`w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-all duration-300 flex items-center justify-center group ${isOpen ? 'scale-95' : 'scale-100 hover:scale-105'
            }`}
        >
          <div
            className={`transition-transform duration-300 ${isOpen ? 'rotate-45' : 'rotate-0'}`}
          >
            {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
          </div>
        </button>

        {/* Unread Badge */}
        {!isOpen && messageCount > 0 && (
          <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center animate-pulse">
            {messageCount > 9 ? '9+' : messageCount}
          </div>
        )}
      </div>
      <PdfSheet
        visible={visible}
        hideModal={hideModal}
        documentId={documentId}
        chunk={selectedChunk}
      />
    </div>
  );
};

export default FloatingChatWidget;

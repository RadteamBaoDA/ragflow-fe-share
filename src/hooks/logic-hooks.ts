import { Authorization } from '@/constants/authorization';
import { MessageType } from '@/constants/chat';
import { LanguageTranslationMap } from '@/constants/common';
import { ResponseType } from '@/interfaces/database/base';
import { IAnswer, Message } from '@/interfaces/database/chat';
import { IKnowledgeFile } from '@/interfaces/database/knowledge';
import { IClientConversation, IMessage } from '@/pages/chat/interface';
import api from '@/utils/api';
import { getAuthorization } from '@/utils/authorization-util';
import { buildMessageUuid } from '@/utils/chat';
import { PaginationProps, message } from 'antd';
import { FormInstance } from 'antd/lib';
import axios from 'axios';
import { EventSourceParserStream } from 'eventsource-parser/stream';
import { has, isEmpty, omit } from 'lodash';
import {
  ChangeEventHandler,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { v4 as uuid } from 'uuid';
import { useTranslate } from './common-hooks';
import { useSetPaginationParams } from './route-hook';
import { useFetchTenantInfo, useSaveSetting } from './user-setting-hooks';

export function usePrevious<T>(value: T) {
  const ref = useRef<T>();
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref.current;
}

export const useSetSelectedRecord = <T = IKnowledgeFile>() => {
  const [currentRecord, setCurrentRecord] = useState<T>({} as T);

  const setRecord = (record: T) => {
    setCurrentRecord(record);
  };

  return { currentRecord, setRecord };
};

export const useChangeLanguage = () => {
  const { i18n } = useTranslation();
  const { saveSetting } = useSaveSetting();

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(
      LanguageTranslationMap[lng as keyof typeof LanguageTranslationMap],
    );
    saveSetting({ language: lng });
  };

  return changeLanguage;
};

export const useGetPaginationWithRouter = () => {
  const { t } = useTranslate('common');
  const {
    setPaginationParams,
    page,
    size: pageSize,
  } = useSetPaginationParams();

  const onPageChange: PaginationProps['onChange'] = useCallback(
    (pageNumber: number, pageSize: number) => {
      setPaginationParams(pageNumber, pageSize);
    },
    [setPaginationParams],
  );

  const setCurrentPagination = useCallback(
    (pagination: { page: number; pageSize?: number }) => {
      if (pagination.pageSize !== pageSize) {
        pagination.page = 1; // Reset to first page if pageSize changes
      }
      setPaginationParams(pagination.page, pagination.pageSize);
    },
    [setPaginationParams, pageSize],
  );

  const pagination: PaginationProps = useMemo(() => {
    return {
      showQuickJumper: true,
      total: 0,
      showSizeChanger: true,
      current: page,
      pageSize: pageSize,
      pageSizeOptions: [1, 2, 10, 20, 50, 100],
      onChange: onPageChange,
      showTotal: (total) => `${t('total')} ${total}`,
    };
  }, [t, onPageChange, page, pageSize]);

  return {
    pagination,
    setPagination: setCurrentPagination,
  };
};

export const useHandleSearchChange = () => {
  const [searchString, setSearchString] = useState('');
  const { setPagination } = useGetPaginationWithRouter();
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = e.target.value;
      setSearchString(value);
      setPagination({ page: 1 });
    },
    [setPagination],
  );

  return { handleInputChange, searchString };
};

export const useGetPagination = () => {
  const [pagination, setPagination] = useState({ page: 1, pageSize: 10 });
  const { t } = useTranslate('common');

  const onPageChange: PaginationProps['onChange'] = useCallback(
    (pageNumber: number, pageSize: number) => {
      setPagination({ page: pageNumber, pageSize });
    },
    [],
  );

  const currentPagination: PaginationProps = useMemo(() => {
    return {
      showQuickJumper: true,
      total: 0,
      showSizeChanger: true,
      current: pagination.page,
      pageSize: pagination.pageSize,
      pageSizeOptions: [1, 2, 10, 20, 50, 100],
      onChange: onPageChange,
      showTotal: (total) => `${t('total')} ${total}`,
    };
  }, [t, onPageChange, pagination]);

  return {
    pagination: currentPagination,
  };
};

export interface AppConf {
  appName: string;
}

export const useFetchAppConf = () => {
  const [appConf, setAppConf] = useState<AppConf>({} as AppConf);
  const fetchAppConf = useCallback(async () => {
    const ret = await axios.get('/conf.json');

    setAppConf(ret.data);
  }, []);

  useEffect(() => {
    fetchAppConf();
  }, [fetchAppConf]);

  return appConf;
};

function useSetDoneRecord() {
  const [doneRecord, setDoneRecord] = useState<Record<string, boolean>>({});

  const clearDoneRecord = useCallback(() => {
    setDoneRecord({});
  }, []);

  const setDoneRecordById = useCallback((id: string, val: boolean) => {
    setDoneRecord((prev) => ({ ...prev, [id]: val }));
  }, []);

  const allDone = useMemo(() => {
    return Object.values(doneRecord).every((val) => val);
  }, [doneRecord]);

  useEffect(() => {
    if (!isEmpty(doneRecord) && allDone) {
      clearDoneRecord();
    }
  }, [allDone, clearDoneRecord, doneRecord]);

  return {
    doneRecord,
    setDoneRecord,
    setDoneRecordById,
    clearDoneRecord,
    allDone,
  };
}

export const useSendMessageWithSse = (
  url: string = api.completeConversation,
) => {
  const [answer, setAnswer] = useState<IAnswer>({} as IAnswer);
  const [done, setDone] = useState(true);
  const { doneRecord, clearDoneRecord, setDoneRecordById, allDone } =
    useSetDoneRecord();
  const timer = useRef<any>();
  const sseRef = useRef<AbortController>();
  // Throttling refs for smooth UI during streaming
  const pendingAnswerRef = useRef<IAnswer | null>(null);
  const throttleTimeoutRef = useRef<number | null>(null);
  const lastUpdateRef = useRef<number>(0);

  const initializeSseRef = useCallback(() => {
    sseRef.current = new AbortController();
  }, []);

  // Flush pending answer to state
  const flushPendingAnswer = useCallback(() => {
    if (pendingAnswerRef.current) {
      setAnswer(pendingAnswerRef.current);
      pendingAnswerRef.current = null;
    }
    throttleTimeoutRef.current = null;
    lastUpdateRef.current = Date.now();
  }, []);

  // Throttled answer update using setTimeout (100ms) for smooth UI
  const throttledSetAnswer = useCallback(
    (newAnswer: IAnswer) => {
      pendingAnswerRef.current = newAnswer;

      const now = Date.now();
      const timeSinceLastUpdate = now - lastUpdateRef.current;
      const THROTTLE_DELAY = 100;

      if (throttleTimeoutRef.current === null) {
        if (timeSinceLastUpdate >= THROTTLE_DELAY) {
          flushPendingAnswer();
        } else {
          throttleTimeoutRef.current = window.setTimeout(
            flushPendingAnswer,
            THROTTLE_DELAY - timeSinceLastUpdate,
          );
        }
      }
    },
    [flushPendingAnswer],
  );

  const resetAnswer = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
    }
    timer.current = setTimeout(() => {
      setAnswer({} as IAnswer);
      clearTimeout(timer.current);
    }, 1000);
  }, []);

  const setDoneValue = useCallback(
    (body: any, value: boolean) => {
      if (has(body, 'chatBoxId')) {
        setDoneRecordById(body.chatBoxId, value);
      } else {
        setDone(value);
      }
    },
    [setDoneRecordById],
  );
  // Timeout constants
  const RESPONSE_TIMEOUT_MS = 180000; // 3 minutes for initial response
  const STREAM_TIMEOUT_MS = 720000; // 12 minutes for stream inactivity

  const send = useCallback(
    async (
      body: any,
      controller?: AbortController,
    ): Promise<{ response: Response; data: ResponseType } | undefined> => {
      initializeSseRef();

      // Create a timeout controller for the initial fetch
      const timeoutController = new AbortController();
      const effectiveController = controller || sseRef.current;

      // Link the timeout controller to the effective controller
      const abortHandler = () => timeoutController.abort();
      effectiveController?.signal?.addEventListener('abort', abortHandler);

      // Set up initial response timeout
      const responseTimeoutId = setTimeout(() => {
        console.warn('[SSE] Response timeout - aborting request');
        timeoutController.abort();
      }, RESPONSE_TIMEOUT_MS);

      try {
        setDoneValue(body, false);
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            [Authorization]: getAuthorization(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(omit(body, 'chatBoxId')),
          signal: timeoutController.signal,
        });

        // Clear initial response timeout since we got a response
        clearTimeout(responseTimeoutId);

        const res = response.clone().json();

        const reader = response?.body
          ?.pipeThrough(new TextDecoderStream())
          .pipeThrough(new EventSourceParserStream())
          .getReader();

        // Set up stream inactivity timeout
        let streamTimeoutId: ReturnType<typeof setTimeout> | null = null;

        const resetStreamTimeout = () => {
          if (streamTimeoutId) {
            clearTimeout(streamTimeoutId);
          }
          streamTimeoutId = setTimeout(() => {
            console.warn('[SSE] Stream timeout - no data received, aborting');
            timeoutController.abort();
          }, STREAM_TIMEOUT_MS);
        };

        const clearStreamTimeout = () => {
          if (streamTimeoutId) {
            clearTimeout(streamTimeoutId);
            streamTimeoutId = null;
          }
        };

        // Start the stream timeout
        resetStreamTimeout();

        while (true) {
          try {
            const x = await reader?.read();
            if (x) {
              const { done, value } = x;
              if (done) {
                clearStreamTimeout();
                // Flush any pending answer immediately on stream end
                if (pendingAnswerRef.current) {
                  setAnswer(pendingAnswerRef.current);
                  pendingAnswerRef.current = null;
                }
                if (throttleTimeoutRef.current !== null) {
                  clearTimeout(throttleTimeoutRef.current);
                  throttleTimeoutRef.current = null;
                }
                resetAnswer();
                break;
              }

              // Reset stream timeout on each received event
              resetStreamTimeout();

              try {
                const val = JSON.parse(value?.data || '');
                const d = val?.data;
                if (typeof d !== 'boolean') {
                  throttledSetAnswer({
                    ...d,
                    conversationId: body?.conversation_id,
                    chatBoxId: body.chatBoxId,
                  });
                }
              } catch (e) {
                // Swallow parse errors silently
              }
            }
          } catch (e) {
            clearStreamTimeout();
            if (e instanceof DOMException && e.name === 'AbortError') {
              console.log('Request was aborted by user, logic, or timeout.');
            } else {
              // Log other errors and break out of the loop
              console.warn('[SSE] Stream read error:', e);
            }
            // Always break on errors to prevent infinite loop
            break;
          }
        }

        // Cleanup
        effectiveController?.signal?.removeEventListener('abort', abortHandler);
        setDoneValue(body, true);
        resetAnswer();
        return { data: await res, response };
      } catch (e) {
        clearTimeout(responseTimeoutId);
        effectiveController?.signal?.removeEventListener('abort', abortHandler);
        setDoneValue(body, true);
        resetAnswer();

        if (e instanceof DOMException && e.name === 'AbortError') {
          console.log('Request was aborted - possibly due to timeout');
        }
        // Swallow fetch errors silently
      }
    },
    [initializeSseRef, setDoneValue, url, resetAnswer, throttledSetAnswer],
  );

  const stopOutputMessage = useCallback(() => {
    sseRef.current?.abort();
    // Flush any pending answer before stopping
    if (pendingAnswerRef.current) {
      flushPendingAnswer();
    }
    // Cancel any pending throttle on stop
    if (throttleTimeoutRef.current !== null) {
      clearTimeout(throttleTimeoutRef.current);
      throttleTimeoutRef.current = null;
    }
  }, [flushPendingAnswer]);

  // Cleanup throttle on unmount
  useEffect(() => {
    return () => {
      if (throttleTimeoutRef.current !== null) {
        clearTimeout(throttleTimeoutRef.current);
      }
    };
  }, []);

  return {
    send,
    answer,
    done,
    doneRecord,
    allDone,
    setDone,
    resetAnswer,
    stopOutputMessage,
    clearDoneRecord,
  };
};

export const useSpeechWithSse = (url: string = api.tts) => {
  const read = useCallback(
    async (body: any) => {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          [Authorization]: getAuthorization(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
      try {
        const res = await response.clone().json();
        if (res?.code !== 0) {
          message.error(res?.message);
        }
      } catch (error) {
        // Swallow errors silently
      }
      return response;
    },
    [url],
  );

  return { read };
};

//#region chat hooks

export const useScrollToBottom = (
  messages?: unknown,
  containerRef?: React.RefObject<HTMLDivElement>,
) => {
  const ref = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const isAtBottomRef = useRef(true);
  // Track if user was at bottom before latest content update for streaming
  const wasAtBottomBeforeUpdate = useRef(true);

  useEffect(() => {
    isAtBottomRef.current = isAtBottom;
  }, [isAtBottom]);

  const checkIfUserAtBottom = useCallback(() => {
    if (!containerRef?.current) return true;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    // Increased tolerance to 100px to handle rapid streaming updates better
    return Math.abs(scrollTop + clientHeight - scrollHeight) < 100;
  }, [containerRef]);

  useEffect(() => {
    if (!containerRef?.current) return;
    const container = containerRef.current;

    const handleScroll = () => {
      setIsAtBottom(checkIfUserAtBottom());
    };

    container.addEventListener('scroll', handleScroll);
    handleScroll();
    return () => container.removeEventListener('scroll', handleScroll);
  }, [containerRef, checkIfUserAtBottom]);

  // Imperative scroll function
  const scrollToBottom = useCallback(() => {
    if (containerRef?.current) {
      const container = containerRef.current;
      container.scrollTo({
        top: container.scrollHeight - container.clientHeight,
        behavior: 'smooth',
      });
    }
  }, [containerRef]);

  useEffect(() => {
    if (!messages) return;
    if (!containerRef?.current) return;
    // Save the current at-bottom state before the scroll update
    wasAtBottomBeforeUpdate.current = isAtBottomRef.current || checkIfUserAtBottom();

    requestAnimationFrame(() => {
      // Scroll immediately without delay for streaming responsiveness
      if (wasAtBottomBeforeUpdate.current) {
        scrollToBottom();
      }
    });
  }, [messages, containerRef, scrollToBottom, checkIfUserAtBottom]);

  return { scrollRef: ref, isAtBottom, scrollToBottom };
};

export const useHandleMessageInputChange = () => {
  const [value, setValue] = useState('');

  const handleInputChange: ChangeEventHandler<HTMLTextAreaElement> = (e) => {
    const value = e.target.value;
    const nextValue = value.replaceAll('\\n', '\n').replaceAll('\\t', '\t');
    setValue(nextValue);
  };

  return {
    handleInputChange,
    value,
    setValue,
  };
};

export const useSelectDerivedMessages = () => {
  const [derivedMessages, setDerivedMessages] = useState<IMessage[]>([]);

  const messageContainerRef = useRef<HTMLDivElement>(null);

  const { scrollRef, scrollToBottom } = useScrollToBottom(
    derivedMessages,
    messageContainerRef,
  );

  const addNewestQuestion = useCallback(
    (message: Message, answer: string = '') => {
      setDerivedMessages((pre) => {
        return [
          ...pre,
          {
            ...message,
            id: buildMessageUuid(message), // The message id is generated on the front end,
            // and the message id returned by the back end is the same as the question id,
            //  so that the pair of messages can be deleted together when deleting the message
          },
          {
            role: MessageType.Assistant,
            content: answer,
            id: buildMessageUuid({ ...message, role: MessageType.Assistant }),
          },
        ];
      });
    },
    [],
  );

  const addNewestOneQuestion = useCallback((message: Message) => {
    setDerivedMessages((pre) => {
      return [
        ...pre,
        {
          ...message,
          id: buildMessageUuid(message), // The message id is generated on the front end,
          // and the message id returned by the back end is the same as the question id,
          //  so that the pair of messages can be deleted together when deleting the message
        },
      ];
    });
  }, []);

  // Add the streaming message to the last item in the message list
  const addNewestAnswer = useCallback((answer: IAnswer) => {
    setDerivedMessages((pre) => {
      return [
        ...(pre?.slice(0, -1) ?? []),
        {
          role: MessageType.Assistant,
          content: answer.answer,
          reference: answer.reference,
          id: buildMessageUuid({
            id: answer.id,
            role: MessageType.Assistant,
          }),
          prompt: answer.prompt,
          audio_binary: answer.audio_binary,
          ...omit(answer, 'reference'),
        },
      ];
    });
  }, []);

  // Add the streaming message to the last item in the message list
  const addNewestOneAnswer = useCallback((answer: IAnswer) => {
    setDerivedMessages((pre) => {
      const idx = pre.findIndex((x) => x.id === answer.id);

      if (idx !== -1) {
        return pre.map((x) => {
          if (x.id === answer.id) {
            return { ...x, ...answer, content: answer.answer };
          }
          return x;
        });
      }

      return [
        ...(pre ?? []),
        {
          role: MessageType.Assistant,
          content: answer.answer,
          reference: answer.reference,
          id: buildMessageUuid({
            id: answer.id,
            role: MessageType.Assistant,
          }),
          prompt: answer.prompt,
          audio_binary: answer.audio_binary,
          ...omit(answer, 'reference'),
        },
      ];
    });
  }, []);

  const removeLatestMessage = useCallback(() => {
    setDerivedMessages((pre) => {
      const nextMessages = pre?.slice(0, -2) ?? [];
      return nextMessages;
    });
  }, []);

  const removeMessageById = useCallback(
    (messageId: string) => {
      setDerivedMessages((pre) => {
        const nextMessages = pre?.filter((x) => x.id !== messageId) ?? [];
        return nextMessages;
      });
    },
    [setDerivedMessages],
  );

  const removeMessagesAfterCurrentMessage = useCallback(
    (messageId: string) => {
      setDerivedMessages((pre) => {
        const index = pre.findIndex((x) => x.id === messageId);
        if (index !== -1) {
          let nextMessages = pre.slice(0, index + 2) ?? [];
          const latestMessage = nextMessages.at(-1);
          nextMessages = latestMessage
            ? [
              ...nextMessages.slice(0, -1),
              {
                ...latestMessage,
                content: '',
                reference: undefined,
                prompt: undefined,
              },
            ]
            : nextMessages;
          return nextMessages;
        }
        return pre;
      });
    },
    [setDerivedMessages],
  );

  const removeAllMessages = useCallback(() => {
    setDerivedMessages([]);
  }, [setDerivedMessages]);

  const removeAllMessagesExceptFirst = useCallback(() => {
    setDerivedMessages((list) => {
      if (list.length <= 1) {
        return list;
      }
      return list.slice(0, 1);
    });
  }, [setDerivedMessages]);

  return {
    scrollRef,
    messageContainerRef,
    derivedMessages,
    setDerivedMessages,
    addNewestQuestion,
    addNewestAnswer,
    removeLatestMessage,
    removeMessageById,
    addNewestOneQuestion,
    addNewestOneAnswer,
    removeMessagesAfterCurrentMessage,
    removeAllMessages,
    scrollToBottom,
    removeAllMessagesExceptFirst,
  };
};

export interface IRemoveMessageById {
  removeMessageById(messageId: string): void;
}

export const useRemoveMessagesAfterCurrentMessage = (
  setCurrentConversation: (
    callback: (state: IClientConversation) => IClientConversation,
  ) => void,
) => {
  const removeMessagesAfterCurrentMessage = useCallback(
    (messageId: string) => {
      setCurrentConversation((pre) => {
        const index = pre.message?.findIndex((x) => x.id === messageId);
        if (index !== -1) {
          let nextMessages = pre.message?.slice(0, index + 2) ?? [];
          const latestMessage = nextMessages.at(-1);
          nextMessages = latestMessage
            ? [
              ...nextMessages.slice(0, -1),
              {
                ...latestMessage,
                content: '',
                reference: undefined,
                prompt: undefined,
              },
            ]
            : nextMessages;
          return {
            ...pre,
            message: nextMessages,
          };
        }
        return pre;
      });
    },
    [setCurrentConversation],
  );

  return { removeMessagesAfterCurrentMessage };
};

export interface IRegenerateMessage {
  regenerateMessage?: (message: Message) => void;
}

export const useRegenerateMessage = ({
  removeMessagesAfterCurrentMessage,
  sendMessage,
  messages,
}: {
  removeMessagesAfterCurrentMessage(messageId: string): void;
  sendMessage({
    message,
  }: {
    message: Message;
    messages?: Message[];
  }): void | Promise<any>;
  messages: Message[];
}) => {
  const regenerateMessage = useCallback(
    async (message: Message) => {
      if (message.id) {
        removeMessagesAfterCurrentMessage(message.id);
        const index = messages.findIndex((x) => x.id === message.id);
        let nextMessages;
        if (index !== -1) {
          nextMessages = messages.slice(0, index);
        }
        sendMessage({
          message: { ...message, id: uuid() },
          messages: nextMessages,
        });
      }
    },
    [removeMessagesAfterCurrentMessage, sendMessage, messages],
  );

  return { regenerateMessage };
};

// #endregion

/**
 *
 * @param defaultId
 * used to switch between different items, similar to radio
 * @returns
 */
export const useSelectItem = (defaultId?: string) => {
  const [selectedId, setSelectedId] = useState('');

  const handleItemClick = useCallback(
    (id: string) => () => {
      setSelectedId(id);
    },
    [],
  );

  useEffect(() => {
    if (defaultId) {
      setSelectedId(defaultId);
    }
  }, [defaultId]);

  return { selectedId, handleItemClick };
};

export const useFetchModelId = () => {
  const { data: tenantInfo } = useFetchTenantInfo(true);

  return tenantInfo?.llm_id ?? '';
};

const ChunkTokenNumMap = {
  naive: 128,
  knowledge_graph: 8192,
};

export const useHandleChunkMethodSelectChange = (form: FormInstance) => {
  // const form = Form.useFormInstance();
  const handleChange = useCallback(
    (value: string) => {
      if (value in ChunkTokenNumMap) {
        form.setFieldValue(
          ['parser_config', 'chunk_token_num'],
          ChunkTokenNumMap[value as keyof typeof ChunkTokenNumMap],
        );
      }
    },
    [form],
  );

  return handleChange;
};

// reset form fields when modal is form, closed
export const useResetFormOnCloseModal = ({
  form,
  visible,
}: {
  form: FormInstance;
  visible?: boolean;
}) => {
  const prevOpenRef = useRef<boolean>();
  useEffect(() => {
    prevOpenRef.current = visible;
  }, [visible]);
  const prevOpen = prevOpenRef.current;

  useEffect(() => {
    if (!visible && prevOpen) {
      form.resetFields();
    }
  }, [form, prevOpen, visible]);
};

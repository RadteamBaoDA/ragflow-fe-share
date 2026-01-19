import { FileIcon } from '@/components/icon-font';
import { ImageWithPopover } from '@/components/image';
import { Input } from '@/components/originui/input';
import { Spin } from '@/components/ui/spin';
import { Button } from '@/components/ui/button';
import {
  DislikeOutlined,
  LikeOutlined,
} from '@ant-design/icons';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { RAGFlowPagination } from '@/components/ui/ragflow-pagination';
import { useSetModalState } from '@/hooks/common-hooks';
import { IReference } from '@/interfaces/database/chat';
import { IFeedbackRequestBody } from '@/interfaces/request/chat';
import { cn } from '@/lib/utils';
import DOMPurify from 'dompurify';
import { isEmpty } from 'lodash';
import { BrainCircuit, Search, X } from 'lucide-react';
import { Dispatch, SetStateAction, useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ISearchAppDetailProps } from '../next-searches/hooks';
import PdfDrawer from './document-preview-modal';
import { ISearchReturnProps } from './hooks';
import './index.less';
import MarkdownContent from './markdown-content';
import MindMapDrawer from './mindmap-drawer';
import RetrievalDocuments from './retrieval-documents';
import { SkeletonCard } from '@/components/skeleton-card';
import { externalHistoryService } from '@/services/external-history-service';
import { useGetSharedSearchParams } from './hooks';
import { v4 as uuidv4 } from 'uuid';
import HighLightMarkdown from '@/components/highlight-markdown';
import FeedbackModal from '@/components/message-item/feedback-modal';

// ... (previous imports)
import { memo } from 'react';

const ChunkItem = memo(
  ({
    chunk,
    clickDocumentButton,
  }: {
    chunk: any;
    clickDocumentButton: (docId: string, chunk: any) => void;
  }) => {
    const sanitizedHtml = useMemo(
      () =>
        DOMPurify.sanitize(
          `${chunk.highlight ?? chunk.content_with_weight ?? ''}...`,
        ),
      [chunk.highlight, chunk.content_with_weight],
    );

    return (
      <div>
        <div className="w-full flex flex-col">
          <div className="w-full highlightContent">
            <ImageWithPopover
              id={chunk.image_id || chunk.img_id}
            ></ImageWithPopover>
            <Popover>
              <PopoverTrigger asChild>
                <div
                  dangerouslySetInnerHTML={{
                    __html: sanitizedHtml,
                  }}
                  className="text-sm text-text-primary mb-1"
                ></div>
              </PopoverTrigger>
              <PopoverContent className="text-text-primary !w-full max-w-lg ">
                <div className="max-h-96 overflow-auto scrollbar-thin">
                  <HighLightMarkdown>
                    {chunk.content_with_weight}
                  </HighLightMarkdown>
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <div
            className="flex gap-2 items-center text-xs text-text-secondary border p-1 rounded-lg w-fit mt-3"
            onClick={() => clickDocumentButton(chunk.doc_id, chunk as any)}
          >
            <FileIcon name={chunk.docnm_kwd}></FileIcon>
            {chunk.docnm_kwd}
          </div>
        </div>
      </div>
    );
  },
);

export default function SearchingView({
  setIsSearching,
  searchData,
  handleClickRelatedQuestion,
  handleTestChunk,
  setSelectedDocumentIds,
  answer,
  sendingLoading,
  relatedQuestions,
  isFirstRender,
  selectedDocumentIds,
  isSearchStrEmpty,
  searchStr,
  stopOutputMessage,
  visible,
  hideModal,
  documentId,
  selectedChunk,
  clickDocumentButton,
  mindMapVisible,
  hideMindMapModal,
  showMindMapModal,
  mindMapLoading,
  mindMap,
  chunks,
  total,
  handleSearch,
  pagination,
  onChange,
  loading,
  errorMessage,
  traceScore,
  sessionId,
}: ISearchReturnProps & {
  setIsSearching?: Dispatch<SetStateAction<boolean>>;
  searchData: ISearchAppDetailProps;
  errorMessage?: string | null;
  traceScore: (score: number, comment?: string) => void;
  sessionId: string;
}) {
  const { t } = useTranslation();
  // useEffect(() => {
  //   const changeLanguage = async () => {
  //     await i18n.changeLanguage('zh');
  //   };
  //   changeLanguage();
  // }, [i18n]);
  const [searchtext, setSearchtext] = useState<string>('');
  const [retrievalLoading, setRetrievalLoading] = useState(false);
  const [feedbackType, setFeedbackType] = useState<'like' | 'dislike'>();
  const {
    visible: feedbackVisible,
    hideModal: hideFeedbackModal,
    showModal: showFeedbackModal,
  } = useSetModalState();
  const { email, sharedId } = useGetSharedSearchParams();

  // Track previous sendingLoading state to detect completion
  const [prevLoading, setPrevLoading] = useState(false);
  const [hasLoggedHistory, setHasLoggedHistory] = useState(false);

  // Generate a unique session ID for this search session
  // SessionID is now passed from props

  // Handlers for Like/Dislike
  const handleLike = useCallback(() => {
    traceScore(1);
    setFeedbackType('like');
  }, [traceScore]);

  const handleDislike = useCallback(() => {
    showFeedbackModal();
  }, [showFeedbackModal]);

  const handleFeedbackOk = useCallback(
    async (params: IFeedbackRequestBody) => {
      traceScore(0, params.feedback);
      setFeedbackType('dislike');
      hideFeedbackModal();
    },
    [traceScore, hideFeedbackModal],
  );

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [chunks]);

  useEffect(() => {
    setSearchtext(searchStr);
  }, [searchStr, setSearchtext]);

  // Ref to track if we've seen sendingLoading become true (stream started)
  const hasStartedSending = useRef(false);
  // Ref to access latest answer inside setTimeout
  const answerRef = useRef(answer);
  answerRef.current = answer;
  // Ref to access latest chunks inside setTimeout
  const chunksRef = useRef(chunks);
  chunksRef.current = chunks;

  // Detect when search/summary is finished
  useEffect(() => {
    // Track when sending starts
    if (sendingLoading) {
      hasStartedSending.current = true;
    }

    // Only trigger history when:
    // 1. We've seen sendingLoading true at some point (stream was started)
    // 2. sendingLoading is now false (stream finished)
    // 3. loading is false (retrieval finished)
    // 4. We haven't logged yet
    const streamFinished =
      hasStartedSending.current && !sendingLoading && !loading;

    if (streamFinished && !hasLoggedHistory) {
      // Check if we have results
      if ((chunks && chunks.length > 0) || (answer && answer.answer)) {
        // Mark as logged immediately to prevent duplicate calls
        setHasLoggedHistory(true);
        hasStartedSending.current = false;

        // Capture search input now (it won't change)
        const capturedSearchStr = searchStr;
        const capturedSearchtext = searchtext;

        // Add delay to ensure AI summary data is fully settled
        // Then fetch LATEST answer from ref inside the callback
        const delayMs = 1000; // Increased delay to get final answer
        setTimeout(() => {
          // Get LATEST answer and chunks from refs
          const latestAnswer = answerRef.current?.answer || '';
          const latestChunks = chunksRef.current || [];
          const latestReference = answerRef.current?.reference;

          // Get unique file names from latest chunks for file_results
          // chunks in search-view seem to have docnm_kwd and doc_id
          const uniqueFileResults = new Map<string, { document_name: string; document_id: string }>();
          latestChunks?.forEach((c) => {
            if (c.doc_id && c.docnm_kwd) {
              uniqueFileResults.set(c.doc_id, {
                document_name: c.docnm_kwd,
                document_id: c.doc_id
              });
            }
          });
          const fileResults = Array.from(uniqueFileResults.values());

          // Get citations from answer reference
          const uniqueCitations = new Map<string, { document_name: string; document_id: string }>();
          latestReference?.chunks?.forEach((c) => {
            if (c.document_id && c.document_name) {
              uniqueCitations.set(c.document_id, {
                document_name: c.document_name,
                document_id: c.document_id
              });
            }
          });
          const citations = Array.from(uniqueCitations.values());

          const searchInput = capturedSearchStr || capturedSearchtext;

          console.log('[SearchView] Sending history after stream complete:', {
            session_id: sessionId,
            search_input: searchInput?.substring(0, 50) + '...',
            ai_summary: latestAnswer?.substring(0, 100) + '...',
            ai_summary_length: latestAnswer?.length,
            file_results: fileResults,
            citations: citations,
          });

          // Only send if we have the required fields
          if (searchInput) {
            externalHistoryService.sendSearchHistory({
              session_id: sessionId,
              share_id: sharedId || undefined,
              search_input: searchInput,
              user_email: email || undefined,
              ai_summary: latestAnswer,
              file_results: fileResults,
              citations: citations,
            });
          }
        }, delayMs);
      }
    }

    // Reset hasLoggedHistory when a new search starts
    if (loading) {
      setHasLoggedHistory(false);
      hasStartedSending.current = false;
    }
  }, [
    loading,
    sendingLoading,
    chunks,
    answer,
    searchStr,
    searchtext,
    email,
    sessionId,
    hasLoggedHistory,
  ]);

  // Show loading only when searching retrieval documents, not waiting for summary
  const showLoading = loading && (!chunks || chunks.length === 0);
  return (
    <section
      className={cn(
        'relative w-full flex transition-all justify-start items-center',
      )}
    >
      {/* search header */}
      <div
        className={cn(
          'relative z-10 px-8 pt-8 flex  text-transparent justify-start items-start w-full',
        )}
      >
        <h1
          className={cn(
            'text-4xl font-bold bg-gradient-to-l from-[#40EBE3] to-[#4A51FF] bg-clip-text cursor-pointer',
          )}
          onClick={() => {
            setIsSearching?.(false);
          }}
        >
          {t('search.ads')}
        </h1>
        <div
          className={cn(
            'rounded-lg text-primary text-xl flex flex-col justify-center flex-1 ml-8',
          )}
        >
          <div className={cn('flex flex-col justify-start items-start w-full')}>
            <div className="relative w-full text-primary">
              <Input
                placeholder={t('search.searchGreeting')}
                className={cn(
                  'w-full rounded-full py-6 pl-4 !pr-[8rem] text-primary text-lg bg-bg-base',
                )}
                value={searchtext}
                onChange={(e) => {
                  setSearchtext(e.target.value);
                }}
                disabled={sendingLoading}
                onKeyUp={(e) => {
                  if (e.key === 'Enter') {
                    handleSearch(searchtext);
                  }
                }}
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 transform flex items-center gap-1">
                <X
                  className="text-text-secondary cursor-pointer opacity-80"
                  size={14}
                  onClick={() => {
                    setSearchtext('');
                    handleClickRelatedQuestion('');
                  }}
                />
                <span className="text-text-secondary opacity-20 ml-4">|</span>
                <button
                  type="button"
                  className="rounded-full bg-text-primary p-1 text-bg-base shadow w-12 h-8 ml-4"
                  onClick={() => {
                    if (sendingLoading) {
                      stopOutputMessage();
                    } else {
                      handleSearch(searchtext);
                    }
                  }}
                >
                  {sendingLoading ? (
                    // <Square size={22} className="m-auto" />
                    <div className="w-2 h-2 bg-bg-base m-auto"></div>
                  ) : (
                    <Search size={22} className="m-auto" />
                  )}
                </button>
              </div>
            </div>
          </div>
          {/* search body */}
          <div
            ref={scrollContainerRef}
            className="w-full mt-5 overflow-auto scrollbar-none "
            style={{ height: 'calc(100vh - 250px)' }}
          >
            {searchData.search_config.summary &&
              !isSearchStrEmpty &&
              chunks?.length > 0 && (
                <>
                  <div className="flex justify-start items-start text-text-primary text-2xl">
                    {t('search.AISummary')}
                  </div>
                  {/* AI Summary container with fixed height */}
                  <div className="border rounded-lg p-4 mt-3 h-52 overflow-auto scrollbar-none w-[90%]">
                    {/* Error message display */}
                    {errorMessage && !sendingLoading ? (
                      <div className="flex flex-col items-start p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 h-full">
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
                    ) : !answer.answer && sendingLoading ? (
                      <SkeletonCard className="" />
                    ) : (
                      answer.answer && (
                        <MarkdownContent
                          loading={sendingLoading}
                          content={answer.answer}
                          reference={answer.reference ?? ({} as IReference)}
                          clickDocumentButton={clickDocumentButton}
                        ></MarkdownContent>
                      )
                    )}
                  </div>
                  {/* Like/Dislike Buttons */}
                  <div className="flex gap-2 mt-2 justify-end w-[90%]">

                    <Button
                      variant={feedbackType === 'like' ? 'default' : 'ghost'}
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={handleLike}
                      disabled={sendingLoading || !answer.answer}
                    >
                      <LikeOutlined />
                    </Button>
                    <Button
                      variant={feedbackType === 'dislike' ? 'default' : 'ghost'}
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={handleDislike}
                      disabled={sendingLoading || !answer.answer}
                    >
                      <DislikeOutlined />
                    </Button>
                  </div>
                  {/* Divider - always show when chunks exist */}
                  <div className="w-full border-b border-border-default/80 my-6"></div>
                </>
              )}
            {/* retrieval documents - show immediately when chunks available, no
 t waiting for stream */}
            {!isSearchStrEmpty && !showLoading && chunks?.length > 0 && (
              <>
                <div className="mt-3 w-52">
                  <RetrievalDocuments
                    selectedDocumentIds={selectedDocumentIds}
                    setSelectedDocumentIds={setSelectedDocumentIds}
                    onTesting={handleTestChunk}
                    setLoading={(loading: boolean) => {
                      setRetrievalLoading(loading);
                    }}
                  ></RetrievalDocuments>
                </div>
                {/* <div className="w-full border-b border-border-default/80 my-
 6"></div> */}
              </>
            )}
            {!isSearchStrEmpty &&
              !showLoading &&
              (!chunks || chunks.length === 0) &&
              total === 0 && (
                <div className="flex h-full flex-col items-center justify-center mt-20 gap-4">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="64"
                    height="64"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-text-tertiary"
                  >
                    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
                    <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
                  </svg>
                  <div className="text-lg font-medium text-text-secondary">
                    {t('common.noResultFound')}
                  </div>
                  <div className="text-sm text-text-tertiary">
                    {t('common.noTestResultsForRuned')}
                  </div>
                </div>
              )}
            <div className="mt-3 ">
              {chunks?.length > 0 && (
                <>
                  {chunks.map((chunk, index) => {
                    return (
                      <div key={index}>
                        <ChunkItem
                          chunk={chunk}
                          clickDocumentButton={clickDocumentButton}
                        />
                        {index < chunks.length - 1 && (
                          <div className="w-full border-b border-border-default/80 mt-6"></div>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
              {relatedQuestions?.length > 0 &&
                searchData.search_config.related_search && (
                  <>
                    <div className="w-full border-b border-border-default/80 mt-6"></div>

                    <div className="mt-6 w-full overflow-hidden opacity-100 max-h-96">
                      <p className="text-text-primary mb-2 text-xl">
                        {t('search.relatedSearch')}
                      </p>
                      <div className="mt-2 flex flex-wrap justify-start gap-2">
                        {relatedQuestions?.map((x, idx) => (
                          <Button
                            key={idx}
                            variant="transparent"
                            className="bg-bg-card text-text-secondary"
                            onClick={handleClickRelatedQuestion(
                              x,
                              searchData.search_config.summary,
                            )}
                          >
                            {x}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
            </div>
          </div>

          {total > 0 && (
            <div className="mt-8 px-8 pb-8 text-base">
              <RAGFlowPagination
                current={pagination.current}
                pageSize={pagination.pageSize}
                total={total}
                onChange={onChange}
              ></RAGFlowPagination>
            </div>
          )}
        </div>
        {mindMapVisible && (
          <div className="flex-1 h-[88dvh] z-30 ml-32 mt-5">
            <MindMapDrawer
              visible={mindMapVisible}
              hideModal={hideMindMapModal}
              data={mindMap}
              loading={mindMapLoading}
            ></MindMapDrawer>
          </div>
        )}
      </div>
      {!mindMapVisible &&
        !isFirstRender &&
        !isSearchStrEmpty &&
        !isEmpty(searchData.search_config.kb_ids) &&
        searchData.search_config.query_mindmap && (
          <Popover>
            <PopoverTrigger asChild>
              <div
                className="rounded-lg h-16 w-16 p-0 absolute top-28 right-3 z-30 border cursor-pointer flex justify-center items-center bg-bg-card"
                onClick={showMindMapModal}
              >
                {/* <SvgIcon name="paper-clip" width={24} height={30}></SvgIcon>
                 */}
                <BrainCircuit size={36} />
              </div>
            </PopoverTrigger>
            <PopoverContent className="w-fit">{t('chunk.mind')}</PopoverContent>
          </Popover>
        )}
      {feedbackVisible && (
        <FeedbackModal
          visible={feedbackVisible}
          hideModal={hideFeedbackModal}
          onOk={handleFeedbackOk}
        ></FeedbackModal>
      )}
      {visible && (
        <PdfDrawer
          visible={visible}
          hideModal={hideModal}
          documentId={documentId}
          chunk={selectedChunk}
        ></PdfDrawer>
      )}
      {showLoading && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center">
          <Spin
            size="large"
            className="w-20 h-20 !bg-transparent after:!bg-transparent [&>div]:!bg-transparent"
          />
          <div className="mt-4 text-text-primary font-medium text-lg">
            {t('search.searchingPleaseWait')}
          </div>
        </div>
      )}
    </section>
  );
}

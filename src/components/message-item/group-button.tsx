import { PromptIcon } from '@/assets/icon/next-icon';
import CopyToClipboard from '@/components/copy-to-clipboard';
import { useSetModalState } from '@/hooks/common-hooks';
import { IRemoveMessageById } from '@/hooks/logic-hooks';
import { IFeedbackRequestBody } from '@/interfaces/request/chat';
import {
  DeleteOutlined,
  DislikeOutlined,
  LikeOutlined,
  PauseCircleOutlined,
  SoundOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import FeedbackDialog from '../feedback-dialog';
import { PromptDialog } from '../prompt-dialog';
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '../ui/tooltip';
import { useRemoveMessage, useSendFeedback, useSpeech } from './hooks';

interface IProps {
  messageId: string;
  content: string;
  prompt?: string;
  showLikeButton: boolean;
  audioBinary?: string;
  showLoudspeaker?: boolean;
  onLike?: () => void;
  onDislike?: (feedback: string) => void;
  disableInternalFeedback?: boolean;
  isLoading?: boolean;
  showPrompt?: boolean;
}

export const AssistantGroupButton = ({
  messageId,
  content,
  prompt,
  audioBinary,
  showLikeButton,
  showLoudspeaker = true,
  onLike,
  onDislike,
  disableInternalFeedback = false,
  isLoading = false,
  showPrompt = true,
}: IProps) => {
  const { visible, hideModal, showModal, onFeedbackOk, loading } =
    useSendFeedback(messageId);
  const {
    visible: promptVisible,
    hideModal: hidePromptModal,
    showModal: showPromptModal,
  } = useSetModalState();
  const { t } = useTranslation();
  const { handleRead, ref, isPlaying } = useSpeech(content, audioBinary);

  const handleLike = useCallback(() => {
    if (!disableInternalFeedback) {
      onFeedbackOk({ thumbup: true });
    }
    onLike?.();
  }, [disableInternalFeedback, onFeedbackOk, onLike]);

  const handleFeedbackOk = useCallback(
    async (params: IFeedbackRequestBody) => {
      if (!disableInternalFeedback) {
        await onFeedbackOk(params);
      }
      if (params.thumbup === false) {
        onDislike?.(params.feedback || '');
      }
    },
    [disableInternalFeedback, onDislike, onFeedbackOk],
  );

  const handleDislike = useCallback(() => {
    if (disableInternalFeedback) {
      onDislike?.('');
    } else {
      showModal();
    }
  }, [disableInternalFeedback, onDislike, showModal]);

  return (
    <>
      <ToggleGroup type={'single'} size="sm" variant="outline" className="space-x-1">
        <ToggleGroupItem value="a">
          <CopyToClipboard text={content}></CopyToClipboard>
        </ToggleGroupItem>
        {showLoudspeaker && (
          <ToggleGroupItem value="b" onClick={handleRead}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>{isPlaying ? <PauseCircleOutlined /> : <SoundOutlined />}</span>
              </TooltipTrigger>
              <TooltipContent>{t('chat.read')}</TooltipContent>
            </Tooltip>
            <audio src="" ref={ref}></audio>
          </ToggleGroupItem>
        )}
        {showLikeButton && (
          <>
            <ToggleGroupItem value="c" onClick={handleLike} disabled={isLoading}>
              <LikeOutlined />
            </ToggleGroupItem>
            <ToggleGroupItem value="d" onClick={handleDislike} disabled={isLoading}>
              <DislikeOutlined />
            </ToggleGroupItem>
          </>
        )}
        {prompt && showPrompt && (
          <ToggleGroupItem value="e" onClick={showPromptModal}>
            <PromptIcon style={{ fontSize: '16px' }} />
          </ToggleGroupItem>
        )}
      </ToggleGroup>
      {visible && (
        <FeedbackDialog
          visible={visible}
          hideModal={hideModal}
          onOk={handleFeedbackOk}
          loading={loading}
        ></FeedbackDialog>
      )}
      {promptVisible && (
        <PromptDialog
          visible={promptVisible}
          hideModal={hidePromptModal}
          prompt={prompt}
        ></PromptDialog>
      )}
    </>
  );
};

interface UserGroupButtonProps extends Partial<IRemoveMessageById> {
  messageId: string;
  content: string;
  regenerateMessage?: () => void;
  sendLoading: boolean;
}

export const UserGroupButton = ({
  content,
  messageId,
  sendLoading,
  removeMessageById,
  regenerateMessage,
}: UserGroupButtonProps) => {
  const { onRemoveMessage, loading } = useRemoveMessage(
    messageId,
    removeMessageById,
  );
  const { t } = useTranslation();

  return (
    <ToggleGroup type={'single'} size="sm" variant="outline" className="space-x-1">
      <ToggleGroupItem value="a">
        <CopyToClipboard text={content}></CopyToClipboard>
      </ToggleGroupItem>
      {regenerateMessage && (
        <ToggleGroupItem
          value="b"
          onClick={regenerateMessage}
          disabled={sendLoading}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <span><SyncOutlined spin={sendLoading} /></span>
            </TooltipTrigger>
            <TooltipContent>{t('chat.regenerate')}</TooltipContent>
          </Tooltip>
        </ToggleGroupItem>
      )}
      {removeMessageById && (
        <ToggleGroupItem value="c" onClick={onRemoveMessage} disabled={loading}>
          <Tooltip>
            <TooltipTrigger asChild>
              <span><DeleteOutlined spin={loading} /></span>
            </TooltipTrigger>
            <TooltipContent>{t('common.delete')}</TooltipContent>
          </Tooltip>
        </ToggleGroupItem>
      )}
    </ToggleGroup>
  );
};

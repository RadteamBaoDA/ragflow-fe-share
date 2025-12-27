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
import { Radio, Tooltip } from 'antd';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import FeedbackModal from './feedback-modal';
import { useRemoveMessage, useSendFeedback, useSpeech } from './hooks';
import PromptModal from './prompt-modal';

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
  }, [onFeedbackOk, onLike, disableInternalFeedback]);

  const handleFeedbackOk = useCallback(
    async (params: IFeedbackRequestBody) => {
      if (!disableInternalFeedback) {
        await onFeedbackOk(params);
      }
      if (params.thumbup === false) {
        onDislike?.(params.feedback || '');
      }
    },
    [onFeedbackOk, onDislike, disableInternalFeedback],
  );

  const handleDislike = useCallback(() => {
    if (disableInternalFeedback) {
      // Skip internal modal, directly call parent handler
      onDislike?.('');
    } else {
      // Show internal feedback modal
      showModal();
    }
  }, [disableInternalFeedback, onDislike, showModal]);

  return (
    <>
      <Radio.Group size="small">
        <Radio.Button value="a">
          <CopyToClipboard text={content}></CopyToClipboard>
        </Radio.Button>
        {showLoudspeaker && (
          <Radio.Button value="b" onClick={handleRead}>
            <Tooltip title={t('chat.read')}>
              {isPlaying ? <PauseCircleOutlined /> : <SoundOutlined />}
            </Tooltip>
            <audio src="" ref={ref}></audio>
          </Radio.Button>
        )}
        {showLikeButton && (
          <>
            <Radio.Button value="c" onClick={handleLike} disabled={isLoading}>
              <LikeOutlined />
            </Radio.Button>
            <Radio.Button value="d" onClick={handleDislike} disabled={isLoading}>
              <DislikeOutlined />
            </Radio.Button>
          </>
        )}
        {prompt && (
          <Radio.Button value="e" onClick={showPromptModal}>
            <PromptIcon style={{ fontSize: '16px' }} />
          </Radio.Button>
        )}
      </Radio.Group>
      {visible && (
        <FeedbackModal
          visible={visible}
          hideModal={hideModal}
          onOk={handleFeedbackOk}
          loading={loading}
        ></FeedbackModal>
      )}
      {promptVisible && (
        <PromptModal
          visible={promptVisible}
          hideModal={hidePromptModal}
          prompt={prompt}
        ></PromptModal>
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
    <Radio.Group size="small">
      <Radio.Button value="a">
        <CopyToClipboard text={content}></CopyToClipboard>
      </Radio.Button>
      {regenerateMessage && (
        <Radio.Button
          value="b"
          onClick={regenerateMessage}
          disabled={sendLoading}
        >
          <Tooltip title={t('chat.regenerate')}>
            <SyncOutlined spin={sendLoading} />
          </Tooltip>
        </Radio.Button>
      )}
      {removeMessageById && (
        <Radio.Button value="c" onClick={onRemoveMessage} disabled={loading}>
          <Tooltip title={t('common.delete')}>
            <DeleteOutlined spin={loading} />
          </Tooltip>
        </Radio.Button>
      )}
    </Radio.Group>
  );
};

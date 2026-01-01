import { IModalProps } from '@/interfaces/common';
import { IReferenceChunk } from '@/interfaces/database/chat';
import { IChunk } from '@/interfaces/database/knowledge';
import { Drawer } from 'antd';
import DocumentPreviewer from '../pdf-previewer';

interface IProps extends IModalProps<any> {
  documentId: string;
  chunk: IChunk | IReferenceChunk;
  width?: string | number;
  height?: string | number;
}

import { useTranslation } from 'react-i18next';

export const PdfDrawer = ({
  visible = false,
  hideModal,
  documentId,
  chunk,
  width = '90vw',
  height,
}: IProps) => {
  const { t } = useTranslation();
  return (
    <Drawer
      title={t('chat.documentPreviewer')}
      onClose={hideModal}
      open={visible}
      width={width}
      height={height}
    >
      <DocumentPreviewer
        documentId={documentId}
        chunk={chunk}
        visible={visible}
      ></DocumentPreviewer>
    </Drawer>
  );
};

export default PdfDrawer;

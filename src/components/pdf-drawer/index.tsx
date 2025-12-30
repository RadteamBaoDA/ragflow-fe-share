import { IModalProps } from '@/interfaces/common';
import { IReferenceChunk } from '@/interfaces/database/chat';
import { IChunk } from '@/interfaces/database/knowledge';
import { cn } from '@/lib/utils';
import DocumentPreviewer from '../pdf-previewer';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../ui/sheet';
import { useTranslation } from 'react-i18next';


interface IProps extends IModalProps<any> {
  documentId: string;
  chunk: IChunk | IReferenceChunk;
  width?: string | number;
  height?: string | number;
}

export const PdfSheet = ({
  visible = false,
  hideModal,
  documentId,
  chunk,
  width = '90vw',
  height,
}: IProps) => {
  const { t } = useTranslation();
  return (
    <Sheet open onOpenChange={hideModal}>
      <SheetContent
        className={cn(`max-w-full`)}
        style={{
          width: width,
          height: height ? height : undefined,
        }}
      >
        <SheetHeader>
          <SheetTitle>{t('chat.documentPreviewer')}</SheetTitle>
        </SheetHeader>
        <DocumentPreviewer
          documentId={documentId}
          chunk={chunk}
          visible={visible}
        ></DocumentPreviewer>
      </SheetContent>
    </Sheet>
  );
};

export default PdfSheet;

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
  const documentName = (chunk as any).document_name || (chunk as any).doc_name;
  return (
    <Sheet open onOpenChange={hideModal}>
      <SheetContent
        className={cn(`max-w-full h-full flex flex-col`)}
        style={{
          width: width,
          height: height ? height : '100vh',
        }}
      >
        <SheetHeader className="flex-shrink-0">
          <SheetTitle>
            {t('chat.documentPreviewer')}
            {`(${documentName})`}
          </SheetTitle>
        </SheetHeader>
        <div className="flex-1 min-h-0 overflow-auto">
          <div className="min-w-fit h-[calc(100vh-164px)]">
            <DocumentPreviewer
              documentId={documentId}
              chunk={chunk}
              visible={visible}
            ></DocumentPreviewer>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default PdfSheet;

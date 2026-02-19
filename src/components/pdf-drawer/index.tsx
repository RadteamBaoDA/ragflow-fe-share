import { useMemo, useState } from 'react';
import {
  useGetChunkHighlights,
  useGetDocumentUrl,
} from '@/hooks/use-document-request';
import { IModalProps } from '@/interfaces/common';
import { IReferenceChunk } from '@/interfaces/database/chat';
import { IChunk } from '@/interfaces/database/knowledge';
import { cn } from '@/lib/utils';
import PdfPreview from '../document-preview/pdf-preview';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../ui/sheet';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, Minus, Plus } from 'lucide-react';
import styles from '../document-preview/index.module.less';

// Zoom presets configuration (same as DocumentPreviewer)
const ZOOM_PRESETS = [
  { value: 'auto', label: 'Automatic Zoom' },
  { value: 'page-actual', label: 'Actual Size' },
  { value: 'page-fit', label: 'Page Fit' },
  { value: 'page-width', label: 'Page Width' },
  { value: '0.5', label: '50%' },
  { value: '0.75', label: '75%' },
  { value: '1', label: '100%' },
  { value: '1.25', label: '125%' },
  { value: '1.5', label: '150%' },
  { value: '2', label: '200%' },
  { value: '3', label: '300%' },
  { value: '4', label: '400%' },
  { value: '7', label: '700%' },
];

const MIN_SCALE = 0.5;
const MAX_SCALE = 7;
const ZOOM_STEP = 0.25;

interface IProps extends IModalProps<any> {
  documentId: string;
  chunk: IChunk | IReferenceChunk;
  width?: string | number;
  height?: string | number;
}

export const PdfSheet = ({
  hideModal,
  documentId,
  chunk,
  width = '90vw',
  height,
}: IProps) => {
  const { t } = useTranslation();
  const documentName = (chunk as any).document_name || (chunk as any).doc_name;
  const getDocumentUrl = useGetDocumentUrl(documentId);
  const url = getDocumentUrl(documentId);
  const { highlights, setWidthAndHeight } = useGetChunkHighlights(chunk);

  const [scale, setScale] = useState(1);
  const [highlightsVisible, setHighlightsVisible] = useState(true);

  const clampScale = (value: number) =>
    Math.min(Math.max(value, MIN_SCALE), MAX_SCALE);

  const isPresetScale = (scaleValue: number) =>
    ZOOM_PRESETS.some(
      (p) => parseFloat(p.value) === scaleValue && !isNaN(parseFloat(p.value)),
    );

  const dropdownOptions = useMemo(() => {
    const options = [...ZOOM_PRESETS];
    if (!isPresetScale(scale)) {
      const customLabel = `${Math.round(scale * 100)}%`;
      const customValue = scale.toString();
      const insertIndex = options.findIndex((opt) => {
        const optValue = parseFloat(opt.value);
        return !isNaN(optValue) && optValue > scale;
      });
      if (insertIndex === -1) {
        options.push({ value: customValue, label: customLabel });
      } else {
        options.splice(insertIndex, 0, {
          value: customValue,
          label: customLabel,
        });
      }
    }
    return options;
  }, [scale]);

  const getCurrentDropdownValue = () => {
    const matchingPreset = ZOOM_PRESETS.find(
      (p) => parseFloat(p.value) === scale,
    );
    if (matchingPreset) return matchingPreset.value;
    return scale.toString();
  };

  const handleZoomIn = () => setScale(clampScale(scale + ZOOM_STEP));
  const handleZoomOut = () => setScale(clampScale(scale - ZOOM_STEP));

  const handleSelectScale = (value: string) => {
    switch (value) {
      case 'auto':
      case 'page-actual':
      case 'page-fit':
      case 'page-width':
        setScale(1);
        break;
      default: {
        const numericScale = parseFloat(value);
        if (!isNaN(numericScale)) setScale(clampScale(numericScale));
        break;
      }
    }
  };

  const toggleHighlights = () => setHighlightsVisible((prev) => !prev);

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

        {/* Zoom Toolbar */}
        <div className={styles.pdfToolbar}>
          <div className={styles.zoomControls}>
            <button
              className={styles.toolbarButton}
              onClick={handleZoomOut}
              disabled={scale <= MIN_SCALE}
              title="Zoom Out"
            >
              <Minus />
            </button>
            <button
              className={styles.toolbarButton}
              onClick={handleZoomIn}
              disabled={scale >= MAX_SCALE}
              title="Zoom In"
            >
              <Plus />
            </button>
            <select
              className={styles.zoomSelect}
              value={getCurrentDropdownValue()}
              onChange={(e) => handleSelectScale(e.target.value)}
              title="Zoom Level"
            >
              {dropdownOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className={styles.highlightToggle}>
            <span className={styles.toolbarDivider} />
            <button
              className={styles.toolbarButton}
              onClick={toggleHighlights}
              title={highlightsVisible ? 'Hide Highlights' : 'Show Highlights'}
            >
              {highlightsVisible ? <Eye /> : <EyeOff />}
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-auto">
          {url && documentId && (
            <PdfPreview
              className={'p-0 min-w-fit !h-[calc(100vh-164px)] w-full'}
              highlights={highlights}
              setWidthAndHeight={setWidthAndHeight}
              url={url}
              scale={scale}
              highlightsVisible={highlightsVisible}
            ></PdfPreview>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default PdfSheet;

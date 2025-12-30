import { IReferenceChunk } from '@/interfaces/database/chat';
import { IChunk } from '@/interfaces/database/knowledge';
import FileError from '@/pages/document-viewer/file-error';
import { Skeleton } from 'antd';
import { Eye, EyeOff, Minus, Plus } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, memo } from 'react';
import {
  AreaHighlight,
  Highlight,
  IHighlight,
  PdfHighlighter,
  PdfLoader,
  Popup,
} from 'react-pdf-highlighter';
import { useCatchDocumentError } from './hooks';
import { useTranslation } from 'react-i18next';

import {
  useGetChunkHighlights,
  useGetDocumentUrl,
} from '@/hooks/use-document-request';
import styles from './index.less';

interface IProps {
  chunk: IChunk | IReferenceChunk;
  documentId: string;
  visible: boolean;
}

// Zoom presets configuration with translation keys
const ZOOM_PRESETS = [
  { value: 'auto', labelKey: 'common.automaticZoom' },
  { value: 'page-actual', labelKey: 'common.actualSize' },
  { value: 'page-fit', labelKey: 'common.pageFit' },
  { value: 'page-width', labelKey: 'common.pageWidth' },
  { value: '0.5', labelKey: '50%' },
  { value: '0.75', labelKey: '75%' },
  { value: '1', labelKey: '100%' },
  { value: '1.25', labelKey: '125%' },
  { value: '1.5', labelKey: '150%' },
  { value: '2', labelKey: '200%' },
  { value: '3', labelKey: '300%' },
  { value: '4', labelKey: '400%' },
  { value: '7', labelKey: '700%' },
];


const MIN_SCALE = 0.5; // 50%
const MAX_SCALE = 7; // 700%
const ZOOM_STEP = 0.25;

const HighlightPopup = ({
  comment,
}: {
  comment: { text: string; emoji: string };
}) =>
  comment.text ? (
    <div className="Highlight__popup">
      {comment.emoji} {comment.text}
    </div>
  ) : null;

// Inner component that handles PdfHighlighter rendering
// Uses useEffect to avoid calling setWidthAndHeight during render
const PdfHighlighterWrapper = memo(({
  pdfDocument,
  scale,
  highlights,
  setWidthAndHeight,
  resetHash,
  setLoaded,
  scrollRef
}: {
  pdfDocument: any;
  scale: number;
  highlights: IHighlight[];
  setWidthAndHeight: (width: number, height: number, scale: number) => void;
  resetHash: () => void;
  setLoaded: (loaded: boolean) => void;
  scrollRef: React.MutableRefObject<(highlight: IHighlight) => void>;
}) => {
  // Track if we've already set dimensions for this scale to avoid loops
  const lastScaleRef = useRef<number | null>(null);

  useEffect(() => {
    // Only update dimensions if scale changed
    if (lastScaleRef.current !== scale) {
      lastScaleRef.current = scale;
      pdfDocument.getPage(1).then((page: any) => {
        const viewport = page.getViewport({ scale });
        setWidthAndHeight(viewport.width, viewport.height, scale);
      });
    }
  }, [pdfDocument, scale, setWidthAndHeight]);

  return (
    <PdfHighlighter
      pdfDocument={pdfDocument}
      enableAreaSelection={(event) => event.altKey}
      onScrollChange={resetHash}
      scrollRef={(scrollTo) => {
        scrollRef.current = scrollTo;
        setLoaded(true);
      }}
      onSelectionFinished={() => null}
      pdfScaleValue={scale.toString()}
      highlightTransform={(
        highlight,
        index,
        setTip,
        hideTip,
        viewportToScaled,
        screenshot,
        isScrolledTo,
      ) => {
        const isTextHighlight = !Boolean(
          highlight.content && highlight.content.image,
        );

        const component = isTextHighlight ? (
          <Highlight
            isScrolledTo={isScrolledTo}
            position={highlight.position}
            comment={highlight.comment}
          />
        ) : (
          <AreaHighlight
            isScrolledTo={isScrolledTo}
            highlight={highlight}
            onChange={() => { }}
          />
        );

        return (
          <Popup
            popupContent={<HighlightPopup {...highlight} />}
            onMouseOver={(popupContent) =>
              setTip(highlight, () => popupContent)
            }
            onMouseOut={hideTip}
            key={index}
          >
            {component}
          </Popup>
        );
      }}
      highlights={highlights}
    />
  );
});

// Inner component to prevent re-render loops when setWidthAndHeight is called
const InnerPdfPreview = memo(({
  url,
  scale,
  highlights,
  highlightsVisible,
  setWidthAndHeight,
  error,
  resetHash,
  loaded,
  setLoaded,
  containerRef
}: {
  url: string;
  scale: number;
  highlights: IHighlight[];
  highlightsVisible: boolean;
  setWidthAndHeight: (width: number, height: number, scale: number) => void;
  error: string;
  resetHash: () => void;
  loaded: boolean;
  setLoaded: (loaded: boolean) => void;
  containerRef: React.RefObject<HTMLDivElement>;
}) => {
  const scrollRef = useRef<(highlight: IHighlight) => void>(() => { });

  useEffect(() => {
    if (highlights.length > 0 && loaded) {
      setLoaded(false);
      scrollRef.current(highlights[0]);
    }
  }, [highlights, loaded, setLoaded]);

  // Effect to update PDF scale when scale prop changes
  useEffect(() => {
    // The react-pdf-highlighter library listens to resize events to update scale
    // Dispatch a resize event to trigger the library's debouncedScaleValue
    // which will read the new pdfScaleValue prop and apply it
    const timeoutId = setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 50);
    return () => clearTimeout(timeoutId);
  }, [scale]);

  return (
    <div ref={containerRef} className={`${styles.pdfContentArea} ${!highlightsVisible ? styles.highlightsHidden : ''}`}>
      <PdfLoader
        url={url}
        beforeLoad={<Skeleton active />}
        workerSrc="/pdfjs-dist/pdf.worker.min.js"
        errorMessage={<FileError>{error}</FileError>}
      >
        {(pdfDocument) => (
          <PdfHighlighterWrapper
            pdfDocument={pdfDocument}
            scale={scale}
            highlights={highlights}
            setWidthAndHeight={setWidthAndHeight}
            resetHash={resetHash}
            setLoaded={setLoaded}
            scrollRef={scrollRef}
          />
        )}
      </PdfLoader>
    </div>
  );
});

const DocumentPreviewer = ({ chunk, documentId, visible }: IProps) => {
  const getDocumentUrl = useGetDocumentUrl(documentId);
  const { highlights: state, setWidthAndHeight } = useGetChunkHighlights(chunk);
  const containerRef = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded] = useState(false);
  const url = getDocumentUrl();
  const error = useCatchDocumentError(url);

  const [scale, setScale] = useState(1);
  const [highlightsVisible, setHighlightsVisible] = useState(true);

  const resetHash = () => { };

  useEffect(() => {
    setLoaded(visible);
  }, [visible]);

  // Clamp scale to min/max bounds
  const clampScale = (value: number) => Math.min(Math.max(value, MIN_SCALE), MAX_SCALE);

  // Check if current scale matches a preset
  const isPresetScale = (scaleValue: number) => {
    return ZOOM_PRESETS.some(p => parseFloat(p.value) === scaleValue && !isNaN(parseFloat(p.value)));
  };

  // Generate dropdown options including current custom scale if needed
  const dropdownOptions = useMemo(() => {
    const options = [...ZOOM_PRESETS];

    // If current scale is not a preset, add it as a custom option
    if (!isPresetScale(scale)) {
      const customLabel = `${Math.round(scale * 100)}%`;
      const customValue = scale.toString();

      // Find the right position to insert based on scale value
      let insertIndex = options.findIndex(opt => {
        const optValue = parseFloat(opt.value);
        return !isNaN(optValue) && optValue > scale;
      });

      if (insertIndex === -1) {
        // Add at the end if larger than all presets
        options.push({ value: customValue, labelKey: customLabel });
      } else {
        options.splice(insertIndex, 0, {
          value: customValue, labelKey: customLabel
        });
      }
    }

    return options;
  }, [scale]);

  // Get current value for the dropdown
  const getCurrentDropdownValue = () => {
    // Check if scale matches a preset
    const matchingPreset = ZOOM_PRESETS.find(p => parseFloat(p.value) === scale)
      ;
    if (matchingPreset) {
      return matchingPreset.value;
    }
    // Return the custom scale value
    return scale.toString();
  };

  const handleZoomIn = () => {
    const newScale = clampScale(scale + ZOOM_STEP);
    setScale(newScale);
  };

  const handleZoomOut = () => {
    const newScale = clampScale(scale - ZOOM_STEP);
    setScale(newScale);
  };

  const handleSelectScale = (value: string) => {
    switch (value) {
      case 'auto':
        // Automatic zoom - fit to container width
        setScale(1);
        break;
      case 'page-actual':
        // Actual Size - 100%
        setScale(1);
        break;
      case 'page-fit':
        // Page Fit - will be handled by container
        setScale(1);
        break;
      case 'page-width':
        // Page Width - will be handled by container
        setScale(1);
        break;
      default:
        // Numeric value
        const numericScale = parseFloat(value);
        if (!isNaN(numericScale)) {
          setScale(clampScale(numericScale));
        }
        break;
    }
  };

  const toggleHighlights = () => {
    setHighlightsVisible(prev => !prev);
  };

  const { t } = useTranslation();

  // Render toolbar
  const renderPdfToolbar = () => (
    <div className={styles.pdfToolbar}>
      <div className={styles.zoomControls}>
        {/* Zoom Out Button */}
        <button
          className={styles.toolbarButton}
          onClick={handleZoomOut}
          disabled={scale <= MIN_SCALE}
          title={t('common.zoomOut')}
        >
          <Minus />
        </button>

        {/* Zoom In Button */}
        <button
          className={styles.toolbarButton}
          onClick={handleZoomIn}
          disabled={scale >= MAX_SCALE}
          title={t('common.zoomIn')}
        >
          <Plus />
        </button>

        {/* Zoom Dropdown */}
        <select
          className={styles.zoomSelect}
          value={getCurrentDropdownValue()}
          onChange={(e) => handleSelectScale(e.target.value)}
          title={t('common.zoomLevel')}
        >
          {dropdownOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.labelKey.startsWith('common.') ? t(option.labelKey) : option.labelKey}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.highlightToggle}>
        <span className={styles.toolbarDivider} />
        {/* Highlight Toggle Button */}
        <button
          className={styles.toolbarButton}
          onClick={toggleHighlights}
          title={highlightsVisible ? t('common.hideHighlights') : t('common.showHighlights')}
        >
          {highlightsVisible ? <Eye /> : <EyeOff />}
        </button>
      </div>
    </div>
  );

  return (
    <div className={styles.documentContainer} style={{ height: '100%', width: '100%' }}>
      {renderPdfToolbar()}
      <InnerPdfPreview
        url={url}
        scale={scale}
        highlights={state}
        highlightsVisible={highlightsVisible}
        setWidthAndHeight={setWidthAndHeight}
        error={error}
        resetHash={resetHash}
        loaded={loaded}
        setLoaded={setLoaded}
        containerRef={containerRef}
      />
    </div>
  );
};

export default DocumentPreviewer;

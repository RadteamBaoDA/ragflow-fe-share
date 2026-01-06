import { memo, useMemo, useState } from 'react';

import CSVFileViewer from './csv-preview';
import { DocPreviewer } from './doc-preview';
import { ExcelCsvPreviewer } from './excel-preview';
import { ImagePreviewer } from './image-preview';
import { Md } from './md';
import PdfPreviewer, { IProps } from './pdf-preview';
import { PptPreviewer } from './ppt-preview';
import { TxtPreviewer } from './txt-preview';
import { VideoPreviewer } from './video-preview';
import styles from './index.less';
import { Eye, EyeOff, Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

type PreviewProps = {
  fileType: string;
  className?: string;
  url: string;
};


// Zoom presets configuration
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

const MIN_SCALE = 0.5; // 50%
const MAX_SCALE = 7; // 700%
const ZOOM_STEP = 0.25;

const Preview = ({
  fileType,
  className,
  highlights,
  setWidthAndHeight,
  url,
}: PreviewProps & Partial<IProps>) => {
  const [scale, setScale] = useState(1);
  const [highlightsVisible, setHighlightsVisible] = useState(true);

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
        options.push({ value: customValue, label: customLabel });
      } else {
        options.splice(insertIndex, 0, { value: customValue, label: customLabel });
      }
    }

    return options;
  }, [scale]);

  // Get current value for the dropdown
  const getCurrentDropdownValue = () => {
    // Check if scale matches a preset
    const matchingPreset = ZOOM_PRESETS.find(p => parseFloat(p.value) === scale);
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

  // Render toolbar for PDF files
  const renderPdfToolbar = () => (
    <div className={styles.pdfToolbar}>
      <div className={styles.zoomControls}>
        {/* Zoom Out Button */}
        <button
          className={styles.toolbarButton}
          onClick={handleZoomOut}
          disabled={scale <= MIN_SCALE}
          title="Zoom Out"
        >
          <Minus />
        </button>

        {/* Zoom In Button */}
        <button
          className={styles.toolbarButton}
          onClick={handleZoomIn}
          disabled={scale >= MAX_SCALE}
          title="Zoom In"
        >
          <Plus />
        </button>

        {/* Zoom Dropdown */}
        <select
          className={styles.zoomSelect}
          value={getCurrentDropdownValue()}
          onChange={(e) => handleSelectScale(e.target.value)}
          title="Zoom Level"
        >
          {dropdownOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
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
          title={highlightsVisible ? 'Hide Highlights' : 'Show Highlights'}
        >
          {highlightsVisible ? <Eye /> : <EyeOff />}
        </button>
      </div>
    </div>
  );

  return (
    <div className={cn('relative w-full h-full flex flex-col', className)}>
      {/* PDF Toolbar */}
      {fileType === 'pdf' && highlights && setWidthAndHeight && renderPdfToolbar()}

      <div className="flex-1 min-h-0 overflow-auto">
        {fileType === 'pdf' && highlights && setWidthAndHeight && (
          <div className="min-w-fit h-[calc(100vh-164px)]">
            <PdfPreviewer
              highlights={highlights}
              setWidthAndHeight={setWidthAndHeight}
              url={url}
              scale={scale}
              highlightsVisible={highlightsVisible}
            ></PdfPreviewer>
          </div>
        )}
        <div
          style={{
            transform: `scale(${scale})`,
            transformOrigin: 'top center',
            transition: 'transform 0.2s ease',
            width: '100%',
            display: fileType === 'pdf' ? 'none' : 'block',
          }}
        >
          {['doc', 'docx'].indexOf(fileType) > -1 && (
            <section className={'w-full h-full flex justify-center'}>
              <DocPreviewer className={className} url={url} />
            </section>
          )}
          {['txt', 'md'].indexOf(fileType) > -1 && (
            <section className={'w-full h-full flex justify-center'}>
              <TxtPreviewer className={className} url={url} />
            </section>
          )}
          {['jpg', 'png', 'gif', 'jpeg', 'svg', 'bmp', 'ico', 'tif'].indexOf(
            fileType,
          ) > -1 && (
              <section className={'w-full h-full flex justify-center'}>
                <ImagePreviewer className={className} url={url} />
              </section>
            )}
          {[
            'mp4',
            'avi',
            'mov',
            'mkv',
            'wmv',
            'flv',
            'mpeg',
            'mpg',
            'asf',
            'rm',
            'rmvb',
          ].indexOf(fileType) > -1 && (
              <section className={'w-full h-full flex justify-center'}>
                <VideoPreviewer className={className} url={url} />
              </section>
            )}
          {['pptx'].indexOf(fileType) > -1 && (
            <section className={'w-full h-full flex justify-center'}>
              <PptPreviewer className={className} url={url} />
            </section>
          )}
          {['xlsx'].indexOf(fileType) > -1 && (
            <section className={'w-full h-full flex justify-center'}>
              <ExcelCsvPreviewer className={className} url={url} />
            </section>
          )}
          {['csv'].indexOf(fileType) > -1 && (
            <section className={'w-full h-full flex justify-center'}>
              <CSVFileViewer className={className} url={url} />
            </section>
          )}
        </div>
      </div>
    </div>
  );
};
export default memo(Preview);

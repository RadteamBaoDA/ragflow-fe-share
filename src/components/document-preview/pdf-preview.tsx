import { memo, useEffect, useRef, useState } from 'react';
import {
  AreaHighlight,
  Highlight,
  IHighlight,
  PdfHighlighter,
  PdfLoader,
  Popup,
} from 'react-pdf-highlighter';

import { useCatchDocumentError } from '@/components/pdf-previewer/hooks';
import { Spin } from '@/components/ui/spin';
// import FileError from '@/pages/document-viewer/file-error';
import { Authorization } from '@/constants/authorization';
import FileError from '@/pages/document-viewer/file-error';
import { getAuthorization } from '@/utils/authorization-util';
import styles from './index.module.less';
type PdfLoaderProps = React.ComponentProps<typeof PdfLoader> & {
  httpHeaders?: Record<string, string>;
};

const Loader = PdfLoader as React.ComponentType<PdfLoaderProps>;
export interface IProps {
  highlights?: IHighlight[];
  setWidthAndHeight?: (width: number, height: number) => void;
  url: string;
  className?: string;
  scale?: number;
  highlightsVisible?: boolean;
}
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

// TODO: merge with DocumentPreviewer
const PdfPreview = ({
  highlights: state,
  setWidthAndHeight,
  url,
  scale = 1,
  className,
  highlightsVisible = true,
}: IProps) => {
  // const url = useGetDocumentUrl();

  const ref = useRef<(highlight: IHighlight) => void>(() => { });
  const error = useCatchDocumentError(url);

  const [docWidth, setDocWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const resetHash = () => { };

  useEffect(() => {
    if (state?.length && state?.length > 0) {
      ref?.current(state[0]);
    }
  }, [state]);

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

  // Convert numeric scale to string format for pdfScaleValue
  const getPdfScaleValue = (): string => {
    return scale.toString();
  };

  const httpHeaders = {
    [Authorization]: getAuthorization(),
  };

  return (
    <div
      ref={containerRef}
      className={`${styles.documentContainer} ${!highlightsVisible ? styles.highlightsHidden : ''} rounded-[10px] min-w-fit`}
    >
      <Loader
        url={url}
        httpHeaders={httpHeaders}
        beforeLoad={
          <div className="absolute inset-0 flex items-center justify-center">
            <Spin />
          </div>
        }
        workerSrc="/pdfjs-dist/pdf.worker.min.js"
        errorMessage={<FileError>{error}</FileError>}
      >
        {(pdfDocument) => {
          pdfDocument.getPage(1).then((page) => {
            const viewport = page.getViewport({ scale: 1 });
            const width = viewport.width;
            const height = viewport.height;
            setWidthAndHeight?.(width, height);
            setDocWidth(width);
          });

          return (
            <PdfHighlighter
              pdfDocument={pdfDocument}
              enableAreaSelection={(event) => event.altKey}
              onScrollChange={resetHash}
              scrollRef={(scrollTo) => {
                ref.current = scrollTo;
              }}
              onSelectionFinished={() => null}
              pdfScaleValue={getPdfScaleValue()}
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
              highlights={state || []}
            />
          );
        }}
      </Loader>
    </div>
  );
};

export default memo(PdfPreview);

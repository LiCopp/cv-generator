import { useEffect, useRef, useState } from 'react';
import { maxPreviewZoom, minPreviewZoom } from '../components/PreviewZoomControls';

/** Keep manual zoom until the user explicitly fits the A4 preview again. */
export function usePreviewZoom() {
  const [zoom, setZoom] = useState(75);
  const [fitZoom, setFitZoom] = useState(75);
  const viewportRef = useRef<HTMLDivElement>(null);
  const fitPreviewRef = useRef(true);
  function changePreviewZoom(value: number) {
    fitPreviewRef.current = false;
    setZoom(value);
  }

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(([entry]) => {
      const fit = Math.min(
        maxPreviewZoom,
        Math.max(minPreviewZoom, Math.floor((entry.contentRect.width / ((210 * 96) / 25.4)) * 100)),
      );
      setFitZoom(fit);
      if (fitPreviewRef.current) setZoom(fit);
    });
    observer.observe(viewport);
    return () => observer.disconnect();
  }, []);

  function fitPreview() {
    fitPreviewRef.current = true;
    setZoom(fitZoom);
  }
  return { zoom, viewportRef, changePreviewZoom, fitPreview };
}

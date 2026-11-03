import { type Project } from '@cv/core';
import { useLayoutEffect, useRef } from 'react';
import { photoObjectPosition } from './photo';

/** Keep decorative offsets bounded without changing the header's flow height or image crop. */
export function Header({
  project,
  continuation = false,
}: {
  project: Project;
  continuation?: boolean;
}) {
  const textRef = useRef<HTMLDivElement>(null);
  const photoRef = useRef<HTMLImageElement>(null);
  useLayoutEffect(() => {
    let cancelled = false;
    const positionDecorations = () => {
      const text = textRef.current;
      if (cancelled || !text) return;
      // Measure the unshifted text before clamping. Otherwise repeated renders
      // would accumulate offsets or resize the background to follow the name.
      text.style.setProperty('--cv-header-text-position', '0mm');
      const headerBounds = text.closest('.cv-header')!.getBoundingClientRect();
      const visibleBounds = text.closest('.cv-header-viewport')!.getBoundingClientRect();
      const textBounds = text.getBoundingClientRect();
      const pixelsPerMm = headerBounds.width / 210;
      const { headerTextOffsetMm, headerEdge, headerEdgeDepthMm } = project.layout.appearance;
      const minimumTextOffset = (visibleBounds.top - textBounds.top) / pixelsPerMm;
      const maximumTextOffset =
        (headerBounds.bottom - textBounds.bottom) / pixelsPerMm -
        (headerEdge === 'straight' ? 0 : headerEdgeDepthMm);
      const textOffset = Math.min(
        maximumTextOffset,
        Math.max(minimumTextOffset, headerTextOffsetMm),
      );
      text.style.setProperty('--cv-header-text-position', `${textOffset}mm`);
      const photo = photoRef.current;
      if (photo) {
        photo.style.setProperty('--cv-photo-effective-offset', '0mm');
        const photoBounds = photo.getBoundingClientRect();
        const { photoOffsetMm, photoOverlapMm } = project.layout.appearance;
        const minimumPhotoOffset = (visibleBounds.top - photoBounds.top) / pixelsPerMm;
        // Only intentional overlap may use the area below the decorative edge.
        const maximumPhotoOffset =
          photoOverlapMm > 0
            ? (visibleBounds.bottom - photoBounds.bottom) / pixelsPerMm
            : (headerBounds.bottom - photoBounds.bottom) / pixelsPerMm -
              (headerEdge === 'straight' ? 0 : headerEdgeDepthMm);
        const photoOffset = Math.min(
          maximumPhotoOffset,
          Math.max(minimumPhotoOffset, photoOffsetMm),
        );
        photo.style.setProperty('--cv-photo-effective-offset', `${photoOffset}mm`);
      }
    };
    positionDecorations();
    void document.fonts.ready.then(positionDecorations);
    return () => {
      cancelled = true;
    };
  }, [project, continuation]);
  const { contact } = project.cv;
  if (continuation)
    return project.layout.appearance.showRunningHeader ? (
      <header className="cv-running-header">
        <span>
          {contact.firstName} {contact.lastName}
        </span>
        <span>Lebenslauf</span>
      </header>
    ) : null;
  const photo = contact.photoAssetId ? project.assets[contact.photoAssetId] : null;
  const appearance = project.layout.appearance;
  const image = appearance.headerImageAssetId
    ? project.assets[appearance.headerImageAssetId]
    : null;
  const hasPhoto = photo && appearance.showPhoto;
  const overlaps = hasPhoto && appearance.photoOverlapMm > 0;
  const positionPhoto = (image: HTMLImageElement) => {
    image.style.objectPosition = photoObjectPosition(
      appearance,
      image.naturalWidth,
      image.naturalHeight,
    );
  };
  const portrait = hasPhoto ? (
    <img
      className={`cv-photo cv-photo-${appearance.photoShape}`}
      src={photo.data}
      alt={`Porträt von ${contact.firstName} ${contact.lastName}`}
      ref={(image) => {
        photoRef.current = image;
        if (image) positionPhoto(image);
      }}
      onLoad={(event) => positionPhoto(event.currentTarget)}
    />
  ) : null;
  return (
    <div className="cv-header-viewport">
      <div
        className={`cv-header-shell cv-photo-side-${appearance.photoSide}${hasPhoto ? ' cv-has-photo' : ''}${overlaps ? ' cv-photo-overlap' : ''}`}
      >
        <header
          className={`cv-header ${image ? 'cv-header-with-image' : `cv-header-${appearance.headerStyle}`}`}
        >
          <div
            className={`cv-header-background${appearance.headerEdge !== 'straight' ? ' cv-header-edge' : ''}`}
            data-shape={appearance.headerEdge}
            data-mirrored={appearance.headerEdgeMirrored}
            aria-hidden="true"
          >
            {image ? (
              <div className="cv-header-image-layer">
                <img className="cv-header-image" src={image.data} alt="" />
                <div className="cv-header-image-shade" />
              </div>
            ) : (
              !hasPhoto && (
                <div className="cv-header-art">
                  <i />
                  <i />
                  <i />
                  <i />
                </div>
              )
            )}
          </div>
          <div className="cv-header-text" ref={textRef}>
            <p className="cv-eyebrow">LEBENSLAUF</p>
            <h1>
              {contact.firstName || 'Vorname'}
              {appearance.headerNameLayout === 'inline' ? ' ' : <br />}
              {contact.lastName || 'Nachname'}
            </h1>
            <p className="cv-headline">{contact.headline}</p>
          </div>
          {!overlaps && portrait}
        </header>
        {overlaps && portrait}
      </div>
    </div>
  );
}

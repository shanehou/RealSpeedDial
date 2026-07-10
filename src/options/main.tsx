import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Options from './Options';
import { ThumbnailPicker } from './ThumbnailPicker';

const captureId = new URLSearchParams(window.location.search).get('thumbnailPicker');

createRoot(document.getElementById('root')!).render(
  <StrictMode>{captureId ? <ThumbnailPicker captureId={captureId} /> : <Options />}</StrictMode>,
);

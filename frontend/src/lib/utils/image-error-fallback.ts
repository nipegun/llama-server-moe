import { fTranslate } from '../i18n';

/**
 * Simplified HTML fallback for external images that fail to load.
 * Displays a centered message with a link to open the image in a new tab.
 */
export function getImageErrorFallbackHtml(src: string): string {
  return `<div class="image-error-content">
    <span>${fTranslate('image.unavailable')}</span>
    <a href="${src}" target="_blank" rel="noopener noreferrer">${fTranslate('image.openLink')}</a>
  </div>`;
}

<script lang="ts">
  import { fTranslate } from '../../../../../../i18n';

  import { ICON_CLASS_DEFAULT } from '$lib/constants/css-classes';
  import type { ChatAttachmentDisplayItem } from '$lib/types';
  import { FileText, Eye, Info } from '@lucide/svelte';
  import { Button } from '$lib/components/ui/button';
  import * as Alert from '$lib/components/ui/alert';
  import { SyntaxHighlightedCode } from '$lib/components/app';
  import { getLanguageFromFilename } from '$lib/utils';
  import { convertPDFToImage } from '$lib/utils/browser-only';
  import { PdfViewMode } from '$lib/enums';

  interface Props {
    currentItem: ChatAttachmentDisplayItem | null;
    displayName: string;
    displayTextContent: string | undefined;
    hasVisionModality: boolean;
    activeModelId?: string;
  }

  let { currentItem, displayName, displayTextContent, hasVisionModality, activeModelId }: Props =
    $props();

  let pdfViewMode = $state<PdfViewMode>(PdfViewMode.PAGES);
  let pdfImages = $state<string[]>([]);
  let pdfImagesLoading = $state(false);
  let pdfImagesError = $state<string | null>(null);

  let language = $derived(getLanguageFromFilename(displayName));

  async function loadPdfImages() {
    if (pdfImages.length > 0 || pdfImagesLoading || !currentItem) return;

    pdfImagesLoading = true;
    pdfImagesError = null;

    try {
      let file: File | null = null;

      if (currentItem.uploadedFile?.file) {
        file = currentItem.uploadedFile.file;
      } else if (currentItem.attachment) {
        // Check if we have pre-processed images
        if (
          'images' in currentItem.attachment &&
          currentItem.attachment.images &&
          Array.isArray(currentItem.attachment.images) &&
          currentItem.attachment.images.length > 0
        ) {
          pdfImages = currentItem.attachment.images;
          return;
        }

        // Convert base64 back to File for processing
        if ('base64Data' in currentItem.attachment && currentItem.attachment.base64Data) {
          const base64Data = currentItem.attachment.base64Data;
          const byteCharacters = atob(base64Data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          file = new File([byteArray], displayName, { type: 'application/pdf' });
        }
      }

      if (file) {
        pdfImages = await convertPDFToImage(file);
      } else {
        throw new Error(fTranslate('text_4291e9544b36'));
      }
    } catch (error) {
      pdfImagesError = error instanceof Error ? error.message : fTranslate('text_e6728ce51717');
    } finally {
      pdfImagesLoading = false;
    }
  }

  $effect(() => {
    if (pdfViewMode === PdfViewMode.PAGES) {
      loadPdfImages();
    }
  });
</script>

<div class="mb-4 flex items-center justify-end gap-2">
  <Button
    variant={pdfViewMode === PdfViewMode.TEXT ? 'default' : 'outline'}
    size="sm"
    onclick={() => (pdfViewMode = PdfViewMode.TEXT)}
    disabled={pdfImagesLoading}
  >
    <FileText class="mr-1 {ICON_CLASS_DEFAULT}" />
    {fTranslate('text_71988c4d8e08')}
  </Button>

  <Button
    variant={pdfViewMode === PdfViewMode.PAGES ? 'default' : 'outline'}
    size="sm"
    onclick={() => (pdfViewMode = PdfViewMode.PAGES)}
    disabled={pdfImagesLoading}
  >
    {#if pdfImagesLoading}
      <div
        class="mr-1 {ICON_CLASS_DEFAULT} animate-spin rounded-full border-2 border-current border-t-transparent"
      ></div>
    {:else}
      <Eye class="mr-1 {ICON_CLASS_DEFAULT}" />
    {/if}
    {fTranslate('text_9046da16aea9')}
  </Button>
</div>

{#if !hasVisionModality && activeModelId && currentItem}
  <Alert.Root class="mb-4 max-w-4xl">
    <Info class={ICON_CLASS_DEFAULT} />
    <Alert.Title>{fTranslate('text_3673f9c181ba')}</Alert.Title>
    <Alert.Description>
      <span class="inline-flex">
        {fTranslate('text_7d2b2a1b79ad')}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <span
          class="mx-1 cursor-pointer underline"
          onclick={() => (pdfViewMode = PdfViewMode.TEXT)}
        >
          {fTranslate('text_982d9e3eb996')}
        </span>
        {fTranslate('text_030cfd60beee')}
      </span>
    </Alert.Description>
  </Alert.Root>
{/if}

{#if pdfImagesLoading}
  <div class="flex flex-1 items-center justify-center p-8">
    <div class="text-center">
      <div
        class="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-white border-t-transparent"
      ></div>
      <p class="text-white/70">{fTranslate('text_cef551a7cb0f')}</p>
    </div>
  </div>
{:else if pdfImagesError}
  <div class="flex flex-1 items-center justify-center p-8">
    <div class="text-center">
      <FileText class="mx-auto mb-4 h-16 w-16 text-white/50" />
      <p class="mb-4 text-white/70">{fTranslate('text_e6728ce51717')}</p>
      <p class="text-sm text-white/50">{pdfImagesError}</p>
    </div>
  </div>
{:else if pdfImages.length > 0}
  {#each pdfImages as image, index (image)}
    <p class="mb-2 text-sm text-white/50">{fTranslate('text_0a30a815d67d')} {index + 1}</p>
    <img
      src={image}
      alt={fTranslate('text_6ff607e169d0', { p0: index + 1 })}
      class="mx-auto max-w-[85vw] rounded-lg shadow-lg"
    />
    <div class="h-4"></div>
  {/each}
{:else}
  <div class="flex flex-1 items-center justify-center p-8">
    <div class="text-center">
      <FileText class="mx-auto mb-4 h-16 w-16 text-white/50" />
      <p class="text-white/70">{fTranslate('text_35ccf4acfc40')}</p>
    </div>
  </div>
{/if}

{#if pdfViewMode === PdfViewMode.TEXT && displayTextContent}
  <div class="px-4 pb-4">
    <SyntaxHighlightedCode
      class="max-w-4xl"
      code={displayTextContent}
      {language}
      maxHeight="none"
    />
  </div>
{/if}

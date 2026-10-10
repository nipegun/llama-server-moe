<script lang="ts">
  import { fTranslate } from '../../../../i18n';

  import { Trash2 } from '@lucide/svelte';
  import { ErrorDialogType } from '$lib/enums';
  import {
    DialogChatError,
    DialogConfirmation,
    DialogEmptyFileAlert,
    DialogFileUploadError
  } from '$lib/components/app';

  let {
    showDeleteDialog,
    handleDeleteConfirm,
    showEmptyFileDialog,
    emptyFileNames,
    activeErrorDialog,
    handleErrorDialogOpenChange,
    fileUpload
  } = $props();
</script>

<DialogFileUploadError
  bind:open={fileUpload.showFileErrorDialog}
  fileErrorData={fileUpload.fileErrorData}
/>

<DialogConfirmation
  bind:open={showDeleteDialog}
  title={fTranslate('text_9ccd1fb969eb')}
  description={fTranslate('text_7b20577dc1ec')}
  confirmText={fTranslate('text_e2d0a54968ea')}
  cancelText={fTranslate('text_19766ed6ccb2')}
  variant="destructive"
  icon={Trash2}
  onConfirm={handleDeleteConfirm}
  onCancel={() => (showDeleteDialog = false)}
/>

<DialogEmptyFileAlert
  bind:open={showEmptyFileDialog}
  emptyFiles={emptyFileNames}
  onOpenChange={(open) => {
    if (!open) {
      emptyFileNames = [];
    }
  }}
/>

<DialogChatError
  message={activeErrorDialog?.message ?? ''}
  contextInfo={activeErrorDialog?.contextInfo}
  onOpenChange={handleErrorDialogOpenChange}
  open={Boolean(activeErrorDialog)}
  type={activeErrorDialog?.type ?? ErrorDialogType.SERVER}
/>

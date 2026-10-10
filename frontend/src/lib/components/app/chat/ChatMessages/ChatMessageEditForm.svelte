<script lang="ts">
  import { fTranslate } from '../../../../i18n';

  import { X, AlertTriangle } from '@lucide/svelte';
  import { Button } from '$lib/components/ui/button';
  import { Switch } from '$lib/components/ui/switch';
  import { ChatForm, DialogConfirmation } from '$lib/components/app';
  import { getMessageEditContext } from '$lib/contexts';
  import { KeyboardKey, MessageRole } from '$lib/enums';
  import { chatStore } from '$lib/stores/chat.svelte';
  import { processFilesToChatUploaded } from '$lib/utils/browser-only';

  const editCtx = getMessageEditContext();

  let saveWithoutRegenerate = $state(false);
  let showDiscardDialog = $state(false);
  let branchAfterEdit = $state(false);

  let isUserMessage = $derived(editCtx.messageRole === MessageRole.USER);
  let isAssistantMessage = $derived(editCtx.messageRole === MessageRole.ASSISTANT);

  let hasUnsavedChanges = $derived.by(() => {
    if (editCtx.editedContent !== editCtx.originalContent) return true;
    if (editCtx.editedUploadedFiles.length > 0) return true;

    const extrasChanged =
      editCtx.editedExtras.length !== editCtx.originalExtras.length ||
      editCtx.editedExtras.some((extra, i) => extra !== editCtx.originalExtras[i]);

    if (extrasChanged) return true;

    return false;
  });

  let hasAttachments = $derived(
    (editCtx.editedExtras && editCtx.editedExtras.length > 0) ||
      (editCtx.editedUploadedFiles && editCtx.editedUploadedFiles.length > 0)
  );

  let canSubmit = $derived(editCtx.editedContent.trim().length > 0 || hasAttachments);

  function handleGlobalKeydown(event: KeyboardEvent) {
    if (event.key === KeyboardKey.ESCAPE) {
      event.preventDefault();
      attemptCancel();
    }
  }

  function attemptCancel() {
    if (hasUnsavedChanges) {
      showDiscardDialog = true;
    } else {
      editCtx.cancel();
    }
  }

  function handleSubmit() {
    if (!canSubmit) return;

    if (isUserMessage && saveWithoutRegenerate && editCtx.showSaveOnlyOption) {
      editCtx.saveOnly();
    } else {
      if (isAssistantMessage && editCtx.setShouldBranchAfterEdit) {
        editCtx.setShouldBranchAfterEdit(branchAfterEdit);
      }

      editCtx.save();
    }

    saveWithoutRegenerate = false;
    branchAfterEdit = false;
  }

  function handleAttachmentRemove(index: number) {
    const newExtras = [...editCtx.editedExtras];
    newExtras.splice(index, 1);
    editCtx.setExtras(newExtras);
  }

  function handleUploadedFileRemove(fileId: string) {
    const newFiles = editCtx.editedUploadedFiles.filter((f) => f.id !== fileId);
    editCtx.setUploadedFiles(newFiles);
  }

  async function handleFilesAdd(files: File[]) {
    const processed = await processFilesToChatUploaded(files);
    editCtx.setUploadedFiles([...editCtx.editedUploadedFiles, ...processed]);
  }

  $effect(() => {
    chatStore.setEditModeActive(handleFilesAdd);

    return () => {
      chatStore.clearEditMode();
    };
  });
</script>

<svelte:window onkeydown={handleGlobalKeydown} />

<div class="relative w-full max-w-[80%]">
  <ChatForm
    value={editCtx.editedContent}
    attachments={editCtx.editedExtras}
    bind:uploadedFiles={editCtx.editedUploadedFiles}
    placeholder={fTranslate('text_0bc9ade7fa33')}
    showMcpPromptButton
    showAddButton={editCtx.messageRole === MessageRole.USER}
    showModelSelector={editCtx.messageRole === MessageRole.USER}
    onValueChange={editCtx.setContent}
    onAttachmentRemove={handleAttachmentRemove}
    onUploadedFileRemove={handleUploadedFileRemove}
    onFilesAdd={handleFilesAdd}
    onSubmit={handleSubmit}
  />
</div>

<div class="mt-2 flex w-full max-w-[80%] items-center justify-between">
  {#if isUserMessage && editCtx.showSaveOnlyOption}
    <div class="flex items-center gap-2">
      <Switch id="save-only-switch" bind:checked={saveWithoutRegenerate} class="scale-75" />

      <label for="save-only-switch" class="cursor-pointer text-xs text-muted-foreground">
        {fTranslate('text_d6ba6ecbbf7a')}
      </label>
    </div>
  {:else if isAssistantMessage}
    <div class="flex items-center gap-2">
      <Switch id="branch-after-edit" bind:checked={branchAfterEdit} class="scale-75" />

      <label for="branch-after-edit" class="cursor-pointer text-xs text-muted-foreground">
        {fTranslate('text_cc2c478ba8cd')}
      </label>
    </div>
  {:else}
    <div></div>
  {/if}

  <Button class="h-7 px-3 text-xs" onclick={attemptCancel} size="sm" variant="ghost">
    <X class="mr-1 h-3 w-3" />
    {fTranslate('text_19766ed6ccb2')}
  </Button>
</div>

<DialogConfirmation
  bind:open={showDiscardDialog}
  title={fTranslate('text_85bcf41666a5')}
  description={fTranslate('text_e8515d324597')}
  confirmText={fTranslate('text_eb1a70e39274')}
  cancelText={fTranslate('text_e76fd2add010')}
  variant="destructive"
  icon={AlertTriangle}
  onConfirm={editCtx.cancel}
  onCancel={() => (showDiscardDialog = false)}
/>

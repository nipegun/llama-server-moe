<script lang="ts">
  import { fTranslate } from '../../../../../../i18n';

  import { Edit, Copy, RefreshCw, Trash2, ArrowRight, GitBranch } from '@lucide/svelte';
  import {
    ActionIcon,
    ChatMessageActionIconsBranchingControls,
    DialogConfirmation
  } from '$lib/components/app';
  import { Switch } from '$lib/components/ui/switch';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import Input from '$lib/components/ui/input/input.svelte';
  import Label from '$lib/components/ui/label/label.svelte';
  import { MessageRole } from '$lib/enums';
  import { activeConversation } from '$lib/stores/conversations.svelte';

  interface Props {
    role: MessageRole.USER | MessageRole.ASSISTANT;
    justify: 'start' | 'end';
    actionsPosition: 'left' | 'right';
    siblingInfo?: ChatMessageSiblingInfo | null;
    showDeleteDialog: boolean;
    deletionInfo: {
      totalCount: number;
      userMessages: number;
      assistantMessages: number;
      messageTypes: string[];
    } | null;
    onCopy: () => void;
    onEdit?: () => void;
    onRegenerate?: () => void;
    onContinue?: () => void;
    onForkConversation?: (options: { name: string; includeAttachments: boolean }) => void;
    onDelete: () => void;
    onConfirmDelete: () => void;
    onNavigateToSibling?: (siblingId: string) => void;
    onShowDeleteDialogChange: (show: boolean) => void;
    showRawOutputSwitch?: boolean;
    rawOutputEnabled?: boolean;
    onRawOutputToggle?: (enabled: boolean) => void;
  }

  let {
    actionsPosition,
    deletionInfo,
    justify,
    onCopy,
    onEdit,
    onConfirmDelete,
    onContinue,
    onDelete,
    onForkConversation,
    onNavigateToSibling,
    onShowDeleteDialogChange,
    onRegenerate,
    role,
    siblingInfo = null,
    showDeleteDialog,
    showRawOutputSwitch = false,
    rawOutputEnabled = false,
    onRawOutputToggle
  }: Props = $props();

  let showForkDialog = $state(false);
  let forkName = $state('');
  let forkIncludeAttachments = $state(true);

  function handleConfirmDelete() {
    onConfirmDelete();
    onShowDeleteDialogChange(false);
  }

  function handleOpenForkDialog() {
    const conv = activeConversation();

    forkName = fTranslate('text_205e60607abc', { p0: conv?.name ?? 'Conversation' });
    forkIncludeAttachments = true;
    showForkDialog = true;
  }

  function handleConfirmFork() {
    onForkConversation?.({ name: forkName.trim(), includeAttachments: forkIncludeAttachments });
    showForkDialog = false;
  }
</script>

<div class="relative {justify === 'start' ? 'mt-2' : ''} flex h-6 items-center justify-between">
  <div
    class="{actionsPosition === 'left'
      ? 'left-0'
      : 'right-0'} flex items-center gap-2 opacity-100 transition-opacity"
  >
    {#if siblingInfo && siblingInfo.totalSiblings > 1}
      <ChatMessageActionIconsBranchingControls {siblingInfo} {onNavigateToSibling} />
    {/if}

    <div
      class="pointer-events-auto inset-0 flex items-center gap-1 opacity-100 transition-all duration-150"
    >
      <ActionIcon icon={Copy} tooltip={fTranslate('text_e21f935f11d7')} onclick={onCopy} />

      {#if onEdit}
        <ActionIcon icon={Edit} tooltip={fTranslate('text_464c4ffd019e')} onclick={onEdit} />
      {/if}

      {#if role === MessageRole.ASSISTANT && onRegenerate}
        <ActionIcon
          icon={RefreshCw}
          tooltip={fTranslate('text_1651031bf58d')}
          onclick={() => onRegenerate()}
        />
      {/if}

      {#if role === MessageRole.ASSISTANT && onContinue}
        <ActionIcon
          icon={ArrowRight}
          tooltip={fTranslate('text_31fbef162594')}
          onclick={onContinue}
        />
      {/if}

      {#if onForkConversation}
        <ActionIcon
          icon={GitBranch}
          tooltip={fTranslate('text_0e5f7f6732e0')}
          onclick={handleOpenForkDialog}
        />
      {/if}

      <ActionIcon icon={Trash2} tooltip={fTranslate('text_e2d0a54968ea')} onclick={onDelete} />
    </div>
  </div>

  {#if showRawOutputSwitch}
    <div class="flex items-center gap-2">
      <span class="text-xs text-muted-foreground">{fTranslate('text_31d5cb1cf038')}</span>
      <Switch
        checked={rawOutputEnabled}
        onCheckedChange={(checked) => onRawOutputToggle?.(checked)}
      />
    </div>
  {/if}
</div>

<DialogConfirmation
  bind:open={showDeleteDialog}
  title={fTranslate('text_43e94c3cb95e')}
  description={deletionInfo && deletionInfo.totalCount > 1
    ? fTranslate('text_9c6b7e82eb81', {
        p0: deletionInfo.totalCount,
        p1: deletionInfo.userMessages,
        p2: deletionInfo.userMessages > 1 ? 's' : '',
        p3: deletionInfo.assistantMessages,
        p4: deletionInfo.assistantMessages > 1 ? 's' : ''
      })
    : fTranslate('text_24e7dc980667')}
  confirmText={deletionInfo && deletionInfo.totalCount > 1
    ? fTranslate('text_5b5338fe8b24', { p0: deletionInfo.totalCount })
    : fTranslate('text_e2d0a54968ea')}
  cancelText={fTranslate('text_19766ed6ccb2')}
  variant="destructive"
  icon={Trash2}
  onConfirm={handleConfirmDelete}
  onCancel={() => onShowDeleteDialogChange(false)}
/>

<DialogConfirmation
  bind:open={showForkDialog}
  title={fTranslate('text_84b04588e14c')}
  description={fTranslate('text_5af90254c54e')}
  confirmText={fTranslate('text_8e5b1a73152c')}
  cancelText={fTranslate('text_19766ed6ccb2')}
  icon={GitBranch}
  onConfirm={handleConfirmFork}
  onCancel={() => (showForkDialog = false)}
>
  <div class="flex flex-col gap-4 py-2">
    <div class="flex flex-col gap-2">
      <Label for="fork-name">{fTranslate('text_7e8cd2056da7')}</Label>

      <Input
        id="fork-name"
        class="text-foreground"
        placeholder={fTranslate('text_1be3523505c4')}
        type="text"
        bind:value={forkName}
      />
    </div>

    <div class="flex items-center gap-2">
      <Checkbox
        id="fork-attachments"
        checked={forkIncludeAttachments}
        onCheckedChange={(checked) => {
          forkIncludeAttachments = checked === true;
        }}
      />

      <Label for="fork-attachments" class="cursor-pointer text-sm font-normal">
        {fTranslate('text_c159fa23ee8e')}
      </Label>
    </div>
  </div>
</DialogConfirmation>

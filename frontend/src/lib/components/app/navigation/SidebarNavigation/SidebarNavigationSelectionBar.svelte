<script lang="ts">
  import { fTranslate } from '../../../../i18n';

  import { Download, Pin, PinOff, Trash2, X } from '@lucide/svelte';
  import { ActionIcon, DialogConfirmation } from '$lib/components/app';
  import { Checkbox } from '$lib/components/ui/checkbox';
  import { TooltipSide } from '$lib/enums';

  interface Props {
    class?: string;
    selectedCount: number;
    visibleCount: number;
    allVisibleSelected: boolean;
    someVisibleSelected: boolean;
    someSelectedPinned: boolean;
    pinStateIsMixed: boolean;
    onSelectAllToggle: () => void;
    onBulkPinToggle: () => void;
    onBulkExport: () => void;
    onBulkDelete: () => void;
    onClose: () => void;
  }

  let {
    class: className = '',
    selectedCount,
    visibleCount,
    allVisibleSelected,
    someVisibleSelected,
    someSelectedPinned,
    pinStateIsMixed,
    onSelectAllToggle,
    onBulkPinToggle,
    onBulkExport,
    onBulkDelete,
    onClose
  }: Props = $props();

  let showDeleteDialog = $state(false);

  function handleDeleteClick() {
    showDeleteDialog = true;
  }

  function handleDeleteConfirm() {
    showDeleteDialog = false;
    onBulkDelete();
  }

  function handleDeleteCancel() {
    showDeleteDialog = false;
  }

  const hasSelection = $derived(selectedCount > 0);
  const isMasterChecked = $derived(allVisibleSelected);
  const isMasterIndeterminate = $derived(!allVisibleSelected && someVisibleSelected);

  const pinTooltip = $derived(
    hasSelection
      ? pinStateIsMixed
        ? fTranslate('text_4a59b87acd7e')
        : someSelectedPinned
          ? selectedCount === 1
            ? fTranslate('text_ee3c71613054')
            : fTranslate('text_bb444562d616')
          : selectedCount === 1
            ? fTranslate('text_ff1cee744146')
            : fTranslate('text_81f50d740fb5')
      : fTranslate('text_ff1cee744146')
  );

  const pinDisabled = $derived(!hasSelection || pinStateIsMixed);
</script>

<div
  role="toolbar"
  aria-label={fTranslate('text_5667f96ffb3d')}
  class="flex items-center gap-1.5 rounded-xl border border-border/50 bg-background/50 px-2 py-1.5 shadow-sm backdrop-blur-xl {className}"
>
  <label class="flex min-w-0 cursor-pointer items-center gap-2">
    <Checkbox
      checked={isMasterChecked}
      indeterminate={isMasterIndeterminate}
      onCheckedChange={onSelectAllToggle}
      aria-label={isMasterChecked
        ? fTranslate('text_967549497036')
        : fTranslate('text_1fc9a387654d')}
    />

    <span class="truncate text-xs font-medium text-muted-foreground">
      {selectedCount} / {visibleCount}
      {fTranslate('text_d7cbbb688b2e')}
    </span>
  </label>

  <div class="ml-auto flex items-center gap-0.75">
    <ActionIcon
      icon={someSelectedPinned ? PinOff : Pin}
      tooltip={pinTooltip}
      tooltipSide={TooltipSide.TOP}
      disabled={pinDisabled}
      ariaLabel={pinTooltip}
      size="sm"
      iconSize="h-3.5 w-3.5"
      class="h-7 w-7 rounded-md bg-transparent backdrop-blur-none hover:bg-accent! {pinDisabled
        ? 'cursor-not-allowed'
        : ''} {!pinDisabled ? 'opacity-100' : 'opacity-40'}"
      onclick={onBulkPinToggle}
    />

    <ActionIcon
      icon={Download}
      tooltip={hasSelection ? fTranslate('text_3664895579f0') : fTranslate('text_3664895579f0')}
      tooltipSide={TooltipSide.TOP}
      disabled={!hasSelection}
      ariaLabel="Export selected"
      size="sm"
      iconSize="h-3.5 w-3.5"
      class="h-7 w-7 rounded-md bg-transparent backdrop-blur-none hover:bg-accent! {hasSelection
        ? 'opacity-100'
        : 'opacity-40'}"
      onclick={onBulkExport}
    />

    <ActionIcon
      icon={Trash2}
      tooltip={fTranslate('text_d2ab5d46fed4')}
      tooltipSide={TooltipSide.TOP}
      disabled={!hasSelection}
      ariaLabel="Delete selected"
      size="sm"
      iconSize="h-3.5 w-3.5 text-destructive"
      class="h-7 w-7 rounded-md bg-transparent backdrop-blur-none hover:bg-destructive/10! dark:hover:bg-destructive/20! disabled:hover:bg-transparent {hasSelection
        ? 'opacity-100'
        : 'opacity-40'}"
      onclick={handleDeleteClick}
    />

    <div class="mx-1 h-4 w-px bg-border" aria-hidden="true"></div>

    <ActionIcon
      icon={X}
      tooltip={fTranslate('text_0a6603b65249')}
      tooltipSide={TooltipSide.TOP}
      ariaLabel="Exit bulk selection mode"
      size="sm"
      iconSize="h-3.5 w-3.5"
      class="h-7 w-7 rounded-md bg-transparent backdrop-blur-none hover:bg-accent!"
      onclick={onClose}
    />
  </div>
</div>

<DialogConfirmation
  bind:open={showDeleteDialog}
  title={fTranslate('text_d2e31b55c80b', { p0: selectedCount, p1: selectedCount === 1 ? '' : 's' })}
  description={fTranslate('text_abaa31087e83', {
    p0: selectedCount === 1 ? '' : 's',
    p1: selectedCount === 1 ? 'its' : 'their'
  })}
  confirmText={selectedCount === 1
    ? fTranslate('text_e2d0a54968ea')
    : fTranslate('text_0ae262c71c03', { p0: selectedCount })}
  cancelText={fTranslate('text_19766ed6ccb2')}
  variant="destructive"
  icon={Trash2}
  onConfirm={handleDeleteConfirm}
  onCancel={handleDeleteCancel}
/>

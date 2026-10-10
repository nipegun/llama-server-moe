<script lang="ts">
  import { fTranslate } from '../../../i18n';

  import { Button } from '$lib/components/ui/button';
  import * as AlertDialog from '$lib/components/ui/alert-dialog';
  import { settingsStore } from '$lib/stores/settings.svelte';
  import { RotateCcw } from '@lucide/svelte';

  interface Props {
    onReset?: () => void;
    onSave?: () => void;
  }

  let { onReset, onSave }: Props = $props();

  let showResetDialog = $state(false);

  function handleResetClick() {
    showResetDialog = true;
  }

  function handleConfirmReset() {
    settingsStore.forceSyncWithServerDefaults();
    onReset?.();

    showResetDialog = false;
  }

  function handleSave() {
    onSave?.();
  }
</script>

<div class="sticky bottom-0 mx-auto mt-4 flex w-full justify-between p-6">
  <div class="flex gap-2">
    <Button variant="outline" onclick={handleResetClick}>
      <RotateCcw class="h-3 w-3" />
      {fTranslate('text_bc5b45ae7b60')}
    </Button>
  </div>

  <Button onclick={handleSave}>{fTranslate('text_7f3a3b142814')}</Button>
</div>

<AlertDialog.Root bind:open={showResetDialog}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>{fTranslate('text_7047e493541d')}</AlertDialog.Title>
      <AlertDialog.Description>{fTranslate('text_395d23b1d04b')}</AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel>{fTranslate('text_19766ed6ccb2')}</AlertDialog.Cancel>
      <AlertDialog.Action onclick={handleConfirmReset}
        >{fTranslate('text_c0334bae1053')}</AlertDialog.Action
      >
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>

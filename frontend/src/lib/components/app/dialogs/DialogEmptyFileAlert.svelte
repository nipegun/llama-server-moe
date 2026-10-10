<script lang="ts">
  import { fTranslate } from '../../../i18n';

  import * as AlertDialog from '$lib/components/ui/alert-dialog';
  import { FileX } from '@lucide/svelte';

  interface Props {
    open: boolean;
    emptyFiles: string[];
    onOpenChange?: (open: boolean) => void;
  }

  let { open = $bindable(), emptyFiles, onOpenChange }: Props = $props();

  function handleOpenChange(newOpen: boolean) {
    open = newOpen;
    onOpenChange?.(newOpen);
  }
</script>

<AlertDialog.Root {open} onOpenChange={handleOpenChange}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title class="flex items-center gap-2">
        <FileX class="h-5 w-5 text-destructive" />
        {fTranslate('text_d482e9733562')}
      </AlertDialog.Title>

      <AlertDialog.Description>{fTranslate('text_2b3fb3f06e10')}</AlertDialog.Description>
    </AlertDialog.Header>

    <div class="space-y-3 text-sm">
      <div class="rounded-lg bg-muted p-3">
        <div class="mb-2 font-medium">{fTranslate('text_a9484458301b')}</div>

        <ul class="list-inside list-disc space-y-1 text-muted-foreground">
          {#each emptyFiles as fileName (fileName)}
            <li class="font-mono text-sm">{fileName}</li>
          {/each}
        </ul>
      </div>

      <div>
        <div class="mb-2 font-medium">{fTranslate('text_8981f39cac60')}</div>

        <ul class="list-inside list-disc space-y-1 text-muted-foreground">
          <li>{fTranslate('text_3a7594ed9269')}</li>

          <li>{fTranslate('text_27ce175a9dbc')}</li>

          <li>{fTranslate('text_238412919030')}</li>
        </ul>
      </div>
    </div>

    <AlertDialog.Footer>
      <AlertDialog.Action onclick={() => handleOpenChange(false)}
        >{fTranslate('text_5ad3dbd1242a')}</AlertDialog.Action
      >
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>

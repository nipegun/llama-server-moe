<script lang="ts">
  import { fTranslate } from '../../../../i18n';

  import * as AlertDialog from '$lib/components/ui/alert-dialog';

  interface Props {
    open: boolean;
    displayName: string;
    onOpenChange: (open: boolean) => void;
    onConfirm: () => void;
  }

  let { open = $bindable(), displayName, onOpenChange, onConfirm }: Props = $props();
</script>

<AlertDialog.Root bind:open {onOpenChange}>
  <AlertDialog.Content>
    <AlertDialog.Header>
      <AlertDialog.Title>{fTranslate('text_056e6a5f6594')}</AlertDialog.Title>

      <AlertDialog.Description>
        {fTranslate('text_3a57bb9fb3bf')} <strong>{displayName}</strong>{fTranslate(
          'text_30f98589bee4'
        )}
      </AlertDialog.Description>
    </AlertDialog.Header>

    <AlertDialog.Footer>
      <AlertDialog.Cancel>{fTranslate('text_19766ed6ccb2')}</AlertDialog.Cancel>

      <AlertDialog.Action
        class="text-destructive-foreground bg-destructive hover:bg-destructive/90"
        onclick={onConfirm}
      >
        {fTranslate('text_e2d0a54968ea')}
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>

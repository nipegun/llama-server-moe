<script lang="ts">
  import { fTranslate } from '../../../../../../i18n';

  import { RotateCw } from '@lucide/svelte';
  import { Button } from '$lib/components/ui/button';
  import ChatMessageActionCard from './ChatMessageActionCard.svelte';

  interface Props {
    onDecision: (shouldContinue: boolean) => void;
  }

  let { onDecision }: Props = $props();
</script>

<ChatMessageActionCard icon={RotateCw}>
  {#snippet message()}
    {fTranslate('text_8e578ac4f04b')}
  {/snippet}

  {#snippet actions()}
    <Button size="sm" onclick={() => onDecision(true)}>{fTranslate('text_31fbef162594')}</Button>

    <Button
      variant="destructive"
      size="sm"
      class="text-destructive hover:text-destructive"
      onclick={() => onDecision(false)}
    >
      {fTranslate('text_cae7d57bc067')}
    </Button>
  {/snippet}
</ChatMessageActionCard>

<script lang="ts">
  import { fTranslate } from '../../i18n';

  import * as Card from '$lib/components/ui/card';
  import { Button } from '$lib/components/ui/button';

  let { needRefresh: needRefreshProp, updateServiceWorker, forceReload } = $props();
  let needRefresh = $derived(needRefreshProp ?? false);
</script>

{#if needRefresh}
  <Card.Root class="overflow-hidden gap-1 py-5">
    <Card.Header class="px-5">
      <Card.Title class="text-sm font-medium">{fTranslate('text_ff8b555d818f')}</Card.Title>
    </Card.Header>

    <Card.Content class="gap-6 grid px-5">
      <p class="text-xs text-muted-foreground">{fTranslate('text_79b7b8b4e2a8')}</p>

      <Button
        class="justify-self-end-safe"
        size="sm"
        onclick={() => {
          updateServiceWorker();

          if (forceReload) {
            window.location.reload();
          }

          needRefresh = false;
        }}
      >
        {fTranslate('text_bdc090ec61e3')}
      </Button>
    </Card.Content>
  </Card.Root>
{/if}

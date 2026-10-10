<script lang="ts">
  import { fTranslate } from '../../../../i18n';

  import { ICON_CLASS_DEFAULT } from '$lib/constants/css-classes';
  import { AlertTriangle, Loader2, RefreshCw } from '@lucide/svelte';
  import * as Alert from '$lib/components/ui/alert';
  import { serverError, serverLoading, serverStatus, serverStore } from '$lib/stores/server.svelte';

  let hasError = $derived(!!serverError());
  let isLoadingModel = $derived(serverStatus() === 503);
</script>

{#if hasError}
  <div class="pointer-events-auto mx-auto mb-4 max-w-[48rem] px-1">
    <Alert.Root variant={isLoadingModel ? 'default' : 'destructive'}>
      {#if isLoadingModel}
        <Loader2 class="{ICON_CLASS_DEFAULT} animate-spin" />
      {:else}
        <AlertTriangle class={ICON_CLASS_DEFAULT} />
      {/if}

      <Alert.Title class="flex items-center justify-between">
        <span
          >{isLoadingModel
            ? fTranslate('text_64590e4b6bc5')
            : fTranslate('text_b0f398a57ea3')}</span
        >

        {#if !isLoadingModel}
          <button
            onclick={() => serverStore.fetch()}
            disabled={serverLoading()}
            class="flex items-center gap-1.5 rounded-lg bg-destructive/20 px-2 py-1 text-xs font-medium hover:bg-destructive/30 disabled:opacity-50"
          >
            <RefreshCw class="h-3 w-3 {serverLoading() ? 'animate-spin' : ''}" />
            {serverLoading() ? fTranslate('text_84a657bcf3d9') : fTranslate('text_942087cc2d41')}
          </button>
        {/if}
      </Alert.Title>

      {#if !isLoadingModel}
        <Alert.Description>{serverError()}</Alert.Description>
      {/if}
    </Alert.Root>
  </div>
{/if}

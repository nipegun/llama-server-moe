<script lang="ts">
  import { fTranslate } from '../../../../i18n';

  import { serverStore } from '$lib/stores/server.svelte';

  interface Props {
    isEmpty: boolean;
  }

  let { isEmpty = false }: Props = $props();
</script>

<div
  class={[
    'pointer-events-none mb-4 hidden px-4 text-center text-balance',
    isEmpty && 'mb-[calc(50dvh-8rem)] md:mb-8 pointer-events-auto block!'
  ]}
>
  <h1 class="mb-2 text-2xl font-semibold tracking-tight md:text-3xl">
    {fTranslate('text_4e47826698bb')}
  </h1>

  <p class="text-muted-foreground md:text-lg">
    {serverStore.props?.modalities?.audio
      ? fTranslate('text_4f3e6e292131')
      : fTranslate('text_00cd58f655da')}
    {fTranslate('text_ccdde17885bd')}
  </p>
</div>

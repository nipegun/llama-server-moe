<script lang="ts">
  import { fTranslate } from '../../../../i18n';

  import { ICON_CLASS_DEFAULT } from '$lib/constants/css-classes';
  import { RefreshCw, Loader2 } from '@lucide/svelte';
  import { Button } from '$lib/components/ui/button';
  import { SearchInput } from '$lib/components/app/forms';

  interface Props {
    isLoading: boolean;
    onRefresh: () => void;
    onSearch?: (query: string) => void;
    searchQuery?: string;
  }

  let { isLoading, onRefresh, onSearch, searchQuery = '' }: Props = $props();
</script>

<div class="flex flex-col gap-2">
  <div class="mb-2 flex items-center gap-4">
    <SearchInput
      placeholder={fTranslate('text_76625c6090df')}
      value={searchQuery}
      onInput={(value) => onSearch?.(value)}
    />

    <Button
      variant="ghost"
      size="sm"
      class="h-8 w-8 p-0"
      onclick={onRefresh}
      disabled={isLoading}
      title={fTranslate('text_28a1a41378e7')}
    >
      {#if isLoading}
        <Loader2 class="{ICON_CLASS_DEFAULT} animate-spin" />
      {:else}
        <RefreshCw class={ICON_CLASS_DEFAULT} />
      {/if}
    </Button>
  </div>

  <h3 class="text-sm font-medium">{fTranslate('text_036bcef84f47')}</h3>
</div>

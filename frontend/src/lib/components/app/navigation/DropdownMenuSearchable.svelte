<script lang="ts">
  import { fTranslate } from '../../../i18n';

  import type { Snippet } from 'svelte';
  import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
  import { SearchInput } from '$lib/components/app';

  interface Props {
    placeholder?: string;
    searchValue?: string;
    onSearchChange?: (value: string) => void;
    onSearchKeyDown?: (event: KeyboardEvent) => void;
    emptyMessage?: string;
    isEmpty?: boolean;
    children: Snippet;
    footer?: Snippet;
  }

  let {
    placeholder = fTranslate('text_7f55382219f0'),
    searchValue = $bindable(''),
    onSearchChange,
    onSearchKeyDown,
    emptyMessage = fTranslate('text_949da6a3278e'),
    isEmpty = false,
    children,
    footer
  }: Props = $props();
</script>

<div class="sticky top-0 z-10 mb-2 bg-popover p-1 pt-2">
  <SearchInput
    {placeholder}
    bind:value={searchValue}
    onInput={onSearchChange}
    onKeyDown={onSearchKeyDown}
  />
</div>

<div class="overflow-y-auto">
  {@render children()}

  {#if isEmpty}
    <div class="px-2 py-3 text-center text-sm text-muted-foreground">{emptyMessage}</div>
  {/if}
</div>

{#if footer}
  <DropdownMenu.Separator />

  {@render footer()}
{/if}

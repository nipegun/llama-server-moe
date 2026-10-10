<script lang="ts">
  import { fTranslate } from '../../../../../../i18n';

  import { SyntaxHighlightedCode } from '$lib/components/app';
  import { DEFAULT_LANGUAGE, MAX_HEIGHT_CODE_BLOCK } from '$lib/constants';
  import { type AgenticSection } from '$lib/utils';
  import { parseReadFileMeta } from './parsers/read-file';
  import ToolCallBlock from './ToolCallBlock.svelte';

  interface Props {
    section: AgenticSection;
    open: boolean;
    isStreaming: boolean;
    onToggle?: () => void;
  }

  let { section, open, isStreaming, onToggle }: Props = $props();

  const readFileMeta = $derived(parseReadFileMeta(section));
</script>

<ToolCallBlock {section} {open} {isStreaming} meta={readFileMeta} {onToggle}>
  {#snippet titleSnippet()}
    <span class="text-muted-foreground">{fTranslate('text_47659c3dccc8')} </span>
    <span class="font-mono">{readFileMeta?.fileName}</span>
    {#if readFileMeta?.lineRange}
      <span class="text-muted-foreground">
        {fTranslate('text_83f47275bb38')}
        {readFileMeta.lineRange.start}-{readFileMeta.lineRange.end})</span
      >
    {/if}
  {/snippet}

  {#snippet children(_meta, _ctx)}
    {#if section.toolResult}
      <SyntaxHighlightedCode
        code={section.toolResult}
        language={readFileMeta?.language ?? DEFAULT_LANGUAGE}
        maxHeight={MAX_HEIGHT_CODE_BLOCK}
      />
    {:else}
      <div class="rounded bg-muted/20 p-2 text-xs text-muted-foreground/70 italic">
        {fTranslate('text_510899fbc0a1')}
      </div>
    {/if}
  {/snippet}
</ToolCallBlock>

<script lang="ts">
  import { fTranslate } from '../../../i18n';

  import { Eye } from '@lucide/svelte';
  import { ActionIcon, ActionIconCopyToClipboard } from '$lib/components/app';
  import { FileTypeText } from '$lib/enums';

  interface Props {
    code: string;
    language: string;
    disabled?: boolean;
    onPreview?: (code: string, language: string) => void;
  }

  let { code, language, disabled = false, onPreview }: Props = $props();

  const showPreview = $derived(language?.toLowerCase() === FileTypeText.HTML);
</script>

<div class="code-block-actions">
  <ActionIconCopyToClipboard
    text={code}
    canCopy={!disabled}
    ariaLabel={disabled ? fTranslate('text_ea6d26c39694') : fTranslate('text_49a0053f3b0d')}
  />

  {#if showPreview}
    <ActionIcon
      icon={Eye}
      tooltip={disabled ? fTranslate('text_ea6d26c39694') : fTranslate('text_7e8611fc24e8')}
      {disabled}
      onclick={() => onPreview!(code, language)}
    />
  {/if}
</div>

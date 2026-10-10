<script lang="ts">
  import { fTranslate } from '../../../i18n';

  import { ICON_CLASS_DEFAULT } from '$lib/constants/css-classes';
  import { Copy } from '@lucide/svelte';
  import { copyToClipboard } from '$lib/utils';
  import ActionIcon from './ActionIcon.svelte';

  interface Props {
    ariaLabel?: string;
    canCopy?: boolean;
    text: string;
  }

  let { ariaLabel = fTranslate('text_b749e205302c'), canCopy = true, text }: Props = $props();
</script>

<ActionIcon
  icon={Copy}
  tooltip={ariaLabel}
  iconSize={ICON_CLASS_DEFAULT}
  disabled={!canCopy}
  onclick={() => canCopy && copyToClipboard(text)}
/>

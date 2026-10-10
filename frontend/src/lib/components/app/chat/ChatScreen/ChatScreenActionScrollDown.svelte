<script lang="ts">
  import { fTranslate } from '../../../../i18n';

  import { ICON_CLASS_DEFAULT } from '$lib/constants/css-classes';
  import { ArrowDown } from '@lucide/svelte';
  import ActionIcon from '$lib/components/app/actions/ActionIcon.svelte';

  let { onclick }: { onclick: (e?: MouseEvent) => void } = $props();
</script>

<div class="pointer-events-auto flex justify-center relative h-0">
  <ActionIcon
    icon={ArrowDown}
    {onclick}
    ariaLabel="Scroll to bottom"
    tooltip={fTranslate('text_6a36c1b26f1c')}
    size="lg"
    iconSize={ICON_CLASS_DEFAULT}
    class="h-9 w-9 rounded-full bg-accent text-accent-foreground absolute bottom-4 shadow-md"
  />
</div>

<script lang="ts">
  import { fTranslate } from '../../../../../i18n';

  import { ChevronLeft, ChevronRight } from '@lucide/svelte';
  import { Button } from '$lib/components/ui/button';

  interface Props {
    onPrev: () => void;
    onNext: () => void;
    show: boolean;
  }

  let { onPrev, onNext, show }: Props = $props();
</script>

{#if show}
  <Button
    variant="secondary"
    size="icon"
    class="absolute top-1/2 left-4 z-10 h-8 w-8 -translate-y-1/2 rounded-full bg-background/5 p-0 text-white!"
    onclick={onPrev}
    aria-label={fTranslate('text_a57b08a480b8')}
  >
    <ChevronLeft class="size-4" />
  </Button>

  <Button
    variant="secondary"
    size="icon"
    class="absolute top-1/2 right-4 z-10 h-8 w-8 -translate-y-1/2 rounded-full bg-background/5 p-0 text-white!"
    onclick={onNext}
    aria-label={fTranslate('text_1ff57a29d7c9')}
  >
    <ChevronRight class="size-4" />
  </Button>
{/if}

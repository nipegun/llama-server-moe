<script lang="ts">
  import { fTranslate } from '../lib/i18n';

  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { ServerErrorSplash } from '$lib/components/app';
  import { ROUTES } from '$lib/constants/routes';
  import { APP_NAME } from '$lib/constants';

  let error = $derived($page.error);
  let status = $derived($page.status);

  // Check if this is an API key related error
  let isApiKeyError = $derived(
    status === 401 ||
      status === 403 ||
      error?.message?.toLowerCase().includes('access denied') ||
      error?.message?.toLowerCase().includes('unauthorized') ||
      error?.message?.toLowerCase().includes('invalid api key')
  );

  function handleRetry() {
    // Navigate back to home page after successful API key validation
    goto(ROUTES.START);
  }
</script>

<svelte:head>
  <title>{fTranslate('text_54a0e8c17ebb')} {status} - {APP_NAME}</title>
</svelte:head>

{#if isApiKeyError}
  <ServerErrorSplash
    error={error?.message || fTranslate('text_9b9b47684642')}
    onRetry={handleRetry}
    showRetry={false}
    showTroubleshooting={false}
  />
{:else}
  <!-- Generic error page for non-API key errors -->
  <div class="flex h-full items-center justify-center">
    <div class="w-full max-w-md px-4 text-center">
      <div class="mb-6">
        <div
          class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10"
        >
          <svg
            class="h-8 w-8 text-destructive"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
        </div>
        <h1 class="mb-2 text-2xl font-bold">{fTranslate('text_54a0e8c17ebb')} {status}</h1>
        <p class="text-muted-foreground">
          {error?.message || fTranslate('text_ab827e3fe17d')}
        </p>
      </div>
      <button
        onclick={() => goto(ROUTES.START)}
        class="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
      >
        {fTranslate('text_82bc39f68192')}
      </button>
    </div>
  </div>
{/if}

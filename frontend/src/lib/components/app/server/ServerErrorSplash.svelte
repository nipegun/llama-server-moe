<script lang="ts">
  import { fApiUrl } from '$lib/api-url';

  import { fTranslate } from '../../../i18n';

  import { ICON_CLASS_DEFAULT } from '$lib/constants/css-classes';
  import { base } from '$app/paths';
  import { AlertTriangle, RefreshCw, Key, CheckCircle, XCircle } from '@lucide/svelte';
  import { goto } from '$app/navigation';
  import { Button } from '$lib/components/ui/button';
  import { Input } from '$lib/components/ui/input';
  import Label from '$lib/components/ui/label/label.svelte';
  import { serverStore, serverLoading } from '$lib/stores/server.svelte';
  import { config, settingsStore } from '$lib/stores/settings.svelte';
  import { AUTHORIZATION_HEADER, BEARER_PREFIX, SETTINGS_KEYS } from '$lib/constants';
  import { ROUTES } from '$lib/constants/routes';
  import { fade, fly, scale } from 'svelte/transition';
  import { KeyboardKey } from '$lib/enums';

  interface Props {
    class?: string;
    error: string;
    onRetry?: () => void;
    showRetry?: boolean;
    showTroubleshooting?: boolean;
  }

  let {
    class: className = '',
    error,
    onRetry,
    showRetry = true,
    showTroubleshooting = false
  }: Props = $props();

  let isServerLoading = $derived(serverLoading());
  let isAccessDeniedError = $derived(
    error.toLowerCase().includes('access denied') ||
      error.toLowerCase().includes('invalid api key') ||
      error.toLowerCase().includes('unauthorized') ||
      error.toLowerCase().includes('401') ||
      error.toLowerCase().includes('403')
  );

  let apiKeyInput = $state('');
  let showApiKeyInput = $state(false);
  let apiKeyState = $state<'idle' | 'validating' | 'success' | 'error'>('idle');
  let apiKeyError = $state('');

  function handleRetryConnection() {
    if (onRetry) {
      onRetry();
    } else {
      serverStore.fetch();
    }
  }

  function handleShowApiKeyInput() {
    showApiKeyInput = true;
    // Pre-fill with current API key if it exists
    const currentConfig = config();
    apiKeyInput = currentConfig.apiKey?.toString() || '';
  }

  async function handleSaveApiKey() {
    if (!apiKeyInput.trim()) return;

    apiKeyState = 'validating';
    apiKeyError = '';

    try {
      // Update the API key in settings first
      settingsStore.updateConfig(SETTINGS_KEYS.API_KEY, apiKeyInput.trim());

      // Test the API key by making a real request to the server
      const response = await fetch(fApiUrl('/props'), {
        headers: {
          'Content-Type': 'application/json',
          [AUTHORIZATION_HEADER]: `${BEARER_PREFIX}${apiKeyInput.trim()}`
        }
      });

      if (response.ok) {
        // API key is valid - User Story B
        apiKeyState = 'success';

        // Show success state briefly, then navigate to home
        setTimeout(() => {
          goto(ROUTES.START);
        }, 1000);
      } else {
        // API key is invalid - User Story A
        apiKeyState = 'error';

        if (response.status === 401 || response.status === 403) {
          apiKeyError = fTranslate('text_1fa2d2208266');
        } else {
          apiKeyError = fTranslate('text_af83e449bf6a', { p0: response.status });
        }

        // Reset to idle state after showing error (don't reload UI)
        setTimeout(() => {
          apiKeyState = 'idle';
        }, 3000);
      }
    } catch (error) {
      // Network or other errors - User Story A
      apiKeyState = 'error';

      if (error instanceof Error) {
        if (error.message.includes('fetch')) {
          apiKeyError = fTranslate('text_0cbdcfd3ffe0');
        } else {
          apiKeyError = error.message;
        }
      } else {
        apiKeyError = fTranslate('text_d965734118e6');
      }

      // Reset to idle state after showing error (don't reload UI)
      setTimeout(() => {
        apiKeyState = 'idle';
      }, 3000);
    }
  }

  function handleApiKeyKeydown(event: KeyboardEvent) {
    if (event.key === KeyboardKey.ENTER) {
      handleSaveApiKey();
    }
  }
</script>

<div class="flex h-full items-center justify-center {className}">
  <div class="w-full max-w-md px-4 text-center">
    <div class="mb-6" in:fade={{ duration: 300 }}>
      <div
        class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10"
      >
        <AlertTriangle class="h-8 w-8 text-destructive" />
      </div>

      <h2 class="mb-2 text-xl font-semibold">{fTranslate('text_8d9809100ff0')}</h2>

      <p class="mb-4 text-sm text-muted-foreground">
        {error}
      </p>
    </div>

    {#if isAccessDeniedError && !showApiKeyInput}
      <div in:fly={{ y: 10, duration: 300, delay: 200 }} class="mb-4">
        <Button onclick={handleShowApiKeyInput} variant="outline" class="w-full">
          <Key class={ICON_CLASS_DEFAULT} />
          {fTranslate('text_895f77e86e47')}
        </Button>
      </div>
    {/if}

    {#if showApiKeyInput}
      <div in:fly={{ y: 10, duration: 300, delay: 200 }} class="mb-4 space-y-3 text-left">
        <div class="space-y-2">
          <Label for="api-key-input" class="text-sm font-medium"
            >{fTranslate('text_23189d55f697')}</Label
          >

          <div class="relative">
            <Input
              id="api-key-input"
              placeholder={fTranslate('text_cfc419f196c7')}
              bind:value={apiKeyInput}
              onkeydown={handleApiKeyKeydown}
              class="w-full pr-10 {apiKeyState === 'error'
                ? 'border-destructive'
                : apiKeyState === 'success'
                  ? 'border-green-500'
                  : ''}"
              disabled={apiKeyState === 'validating'}
            />
            {#if apiKeyState === 'validating'}
              <div class="absolute top-1/2 right-3 -translate-y-1/2">
                <RefreshCw class="{ICON_CLASS_DEFAULT} animate-spin text-muted-foreground" />
              </div>
            {:else if apiKeyState === 'success'}
              <div
                class="absolute top-1/2 right-3 -translate-y-1/2"
                in:scale={{ duration: 200, start: 0.8 }}
              >
                <CheckCircle class="{ICON_CLASS_DEFAULT} text-green-500" />
              </div>
            {:else if apiKeyState === 'error'}
              <div
                class="absolute top-1/2 right-3 -translate-y-1/2"
                in:scale={{ duration: 200, start: 0.8 }}
              >
                <XCircle class="{ICON_CLASS_DEFAULT} text-destructive" />
              </div>
            {/if}
          </div>
          {#if apiKeyError}
            <p class="text-sm text-destructive" in:fly={{ y: -10, duration: 200 }}>
              {apiKeyError}
            </p>
          {/if}
          {#if apiKeyState === 'success'}
            <p class="text-sm text-green-600" in:fly={{ y: -10, duration: 200 }}>
              {fTranslate('text_e40ab11d04df')}
            </p>
          {/if}
        </div>
        <div class="flex gap-2">
          <Button
            onclick={handleSaveApiKey}
            disabled={!apiKeyInput.trim() ||
              apiKeyState === 'validating' ||
              apiKeyState === 'success'}
            class="flex-1"
          >
            {#if apiKeyState === 'validating'}
              <RefreshCw class="{ICON_CLASS_DEFAULT} animate-spin" />
              {fTranslate('text_b28b48d59a08')}
            {:else if apiKeyState === 'success'}
              {fTranslate('text_662efaf46c61')}
            {:else}
              {fTranslate('text_49673e62edaf')}
            {/if}
          </Button>
          <Button
            onclick={() => {
              showApiKeyInput = false;
              apiKeyState = 'idle';
              apiKeyError = '';
            }}
            variant="outline"
            class="flex-1"
            disabled={apiKeyState === 'validating'}
          >
            {fTranslate('text_19766ed6ccb2')}
          </Button>
        </div>
      </div>
    {/if}

    {#if showRetry}
      <div in:fly={{ y: 10, duration: 300, delay: 200 }}>
        <Button onclick={handleRetryConnection} disabled={isServerLoading} class="w-full">
          {#if isServerLoading}
            <RefreshCw class="{ICON_CLASS_DEFAULT} animate-spin" />
            {fTranslate('text_5f04ae9ed6a8')}
          {:else}
            <RefreshCw class={ICON_CLASS_DEFAULT} /> {fTranslate('text_35f09f1991fb')}
          {/if}
        </Button>
      </div>
    {/if}

    {#if showTroubleshooting}
      <div class="mt-4 text-left" in:fly={{ y: 10, duration: 300, delay: 400 }}>
        <details class="text-sm">
          <summary class="cursor-pointer text-muted-foreground hover:text-foreground">
            {fTranslate('text_c3af076f92c5')}
          </summary>

          <div class="mt-2 space-y-3 text-xs text-muted-foreground">
            <div class="space-y-2">
              <p class="mb-4 font-medium">{fTranslate('text_d5420ce33622')}</p>

              <div class="rounded bg-muted/50 px-2 py-1 font-mono text-xs">
                <p>{fTranslate('text_177038b4d0bd')}</p>
              </div>

              <p>{fTranslate('text_7175517a370b')}</p>

              <div class="rounded bg-muted/50 px-2 py-1 font-mono text-xs">
                <p class="mt-1">{fTranslate('text_6b398631299a')}</p>
              </div>
            </div>
            <ul class="list-disc space-y-1 pl-4">
              <li>{fTranslate('text_4d326da4f4c4')}</li>

              <li>{fTranslate('text_f5cb1a5f2421')}</li>

              <li>{fTranslate('text_7b3d3f648257')}</li>
            </ul>
          </div>
        </details>
      </div>
    {/if}
  </div>
</div>

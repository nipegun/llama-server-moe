<script lang="ts">
  import { fTranslate } from '../../../../i18n';

  import { Download, Upload, Trash2 } from '@lucide/svelte';
  import {
    DialogConversationSelection,
    DialogConfirmation,
    DialogExportSettings
  } from '$lib/components/app';
  import { createMessageCountMap } from '$lib/utils';
  import { settingsStore } from '$lib/stores/settings.svelte';
  import { conversationsStore, conversations } from '$lib/stores/conversations.svelte';
  import { toast } from 'svelte-sonner';
  import { fade } from 'svelte/transition';
  import { ConversationSelectionMode, HtmlInputType, FileExtensionText } from '$lib/enums';
  import SettingsChatImportExportSection from './SettingsChatImportExportSection.svelte';
  import SettingsGroup from '$lib/components/app/settings/SettingsGroup.svelte';

  let exportedConversations = $state<DatabaseConversation[]>([]);
  let importedConversations = $state<DatabaseConversation[]>([]);
  let showExportSummary = $state(false);
  let showImportSummary = $state(false);

  let showExportDialog = $state(false);
  let showImportDialog = $state(false);
  let availableConversations = $state<DatabaseConversation[]>([]);
  let messageCountMap = $state<Map<string, number>>(new Map());
  let fullImportData = $state<Array<{ conv: DatabaseConversation; messages: DatabaseMessage[] }>>(
    []
  );

  // Delete functionality state
  let showDeleteDialog = $state(false);

  // Settings import/export state
  let showSettingsExportSummary = $state(false);
  let showSettingsImportSummary = $state(false);
  let showSettingsExportDialog = $state(false);
  let includeSensitiveData = $state(false);

  function handleSettingsExport() {
    showSettingsExportDialog = true;
    includeSensitiveData = false;
  }

  function handleSettingsExportConfirm() {
    showSettingsExportDialog = false;

    try {
      const data = settingsStore.exportSettings(includeSensitiveData);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `llama_settings_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showSettingsExportSummary = true;
      showSettingsImportSummary = false;
      toast.success(fTranslate('text_5bfca92e998f'));
    } catch (err) {
      console.error('Failed to export settings:', err);
      toast.error(fTranslate('text_3cf664c4bd2b'));
    }
  }

  function handleSettingsExportCancel() {
    showSettingsExportDialog = false;
  }

  function handleSettingsImport() {
    try {
      const input = document.createElement('input');
      input.type = HtmlInputType.FILE;
      input.accept = FileExtensionText.JSON;

      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement)?.files?.[0];
        if (!file) return;

        try {
          const text = await file.text();
          const data = JSON.parse(text);

          if (!data || typeof data !== 'object' || !data.config) {
            toast.error(fTranslate('text_e65771eee330'));
            return;
          }

          settingsStore.importSettings(data);

          showSettingsImportSummary = true;
          showSettingsExportSummary = false;
          toast.success(fTranslate('text_f3addd823e40'));
        } catch (err) {
          console.error('Failed to import settings:', err);
          toast.error(fTranslate('text_6ffd4b51379f'));
        }
      };

      input.click();
    } catch (err) {
      console.error('Failed to open file picker:', err);
      toast.error(fTranslate('text_5843f72974fd'));
    }
  }

  async function handleExportClick() {
    try {
      const allConversations = conversations();
      if (allConversations.length === 0) {
        toast.info(fTranslate('text_bf0779e06dd8'));
        return;
      }

      const conversationsWithMessages = await conversationsStore.mGetConversationsForExport(
        allConversations.map((pConversation) => pConversation.id)
      );

      messageCountMap = createMessageCountMap(conversationsWithMessages);
      availableConversations = conversationsWithMessages.map((pEntry) => pEntry.conv);
      showExportDialog = true;
    } catch (err) {
      console.error('Failed to load conversations:', err);
      alert(fTranslate('text_ae55fc046c4c'));
    }
  }

  async function handleExportConfirm(selectedConversations: DatabaseConversation[]) {
    try {
      const allData = await conversationsStore.mGetConversationsForExport(
        selectedConversations.map((pConversation) => pConversation.id)
      );

      if (allData.length === 0) {
        toast.info(fTranslate('text_bf0779e06dd8'));
        return;
      }

      if (allData.length === 1) {
        conversationsStore.downloadConversationFile(allData[0]);
      } else {
        conversationsStore.downloadConversationsArchive(allData);
      }

      exportedConversations = allData.map((pEntry) => pEntry.conv);
      showExportSummary = true;
      showImportSummary = false;
      showExportDialog = false;
    } catch (err) {
      console.error('Export failed:', err);
      alert(fTranslate('text_96f775dbb3fc'));
    }
  }

  async function handleImportClick() {
    try {
      const input = document.createElement('input');

      // No `accept` filter: iOS resolves each entry to a UTI and has none for
      // `.jsonl`, which greys out exported conversations in the file picker.
      // `parseImportFile` detects the format from the file contents instead.
      input.type = HtmlInputType.FILE;

      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement)?.files?.[0];
        if (!file) return;

        try {
          const importedData = await conversationsStore.parseImportFile(file);

          if (importedData.length === 0) {
            throw new Error(fTranslate('text_5db93832d23b'));
          }

          fullImportData = importedData;
          availableConversations = importedData.map((item) => item.conv);
          messageCountMap = createMessageCountMap(importedData);
          showImportDialog = true;
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : fTranslate('text_27c2ccd962c2');

          console.error('Failed to parse file:', err);
          alert(fTranslate('text_0d691e020bf8', { p0: message }));
        }
      };

      input.click();
    } catch (err) {
      console.error('Import failed:', err);
      alert(fTranslate('text_ebbdaaef4f97'));
    }
  }

  async function handleImportConfirm(selectedConversations: DatabaseConversation[]) {
    try {
      const selectedIds = new Set(selectedConversations.map((c) => c.id));
      const selectedData = $state
        .snapshot(fullImportData)
        .filter((item) => selectedIds.has(item.conv.id));

      const { imported, skipped } = await conversationsStore.importConversationsData(selectedData);

      // A conversation already in the database is left untouched, so the summary
      // lists what was written and the toast accounts for the rest.
      if (skipped.length > 0) {
        toast.info(
          fTranslate('text_5a073b148789', {
            p0: skipped.length,
            p1: skipped.length === 1 ? '' : 's'
          })
        );
      }

      importedConversations = imported;
      showImportSummary = true;
      showExportSummary = false;
      showImportDialog = false;
    } catch (err) {
      console.error('Import failed:', err);
      alert(fTranslate('text_1b082e402d1d'));
    }
  }

  async function handleDeleteAllClick() {
    try {
      const allConversations = conversations();

      if (allConversations.length === 0) {
        toast.info(fTranslate('text_5c9a78a4a817'));
        return;
      }

      showDeleteDialog = true;
    } catch (err) {
      console.error('Failed to load conversations for deletion:', err);
      toast.error(fTranslate('text_ae55fc046c4c'));
    }
  }

  async function handleDeleteAllConfirm() {
    try {
      await conversationsStore.deleteAll();

      showDeleteDialog = false;
    } catch (err) {
      console.error('Failed to delete conversations:', err);
    }
  }

  function handleDeleteAllCancel() {
    showDeleteDialog = false;
  }
</script>

<div class="space-y-12" in:fade={{ duration: 150 }}>
  <SettingsGroup title={fTranslate('text_1d432f58690c')}>
    <SettingsChatImportExportSection
      title={fTranslate('text_3664895579f0')}
      description={fTranslate('text_e1c29b8d7188')}
      IconComponent={Download}
      buttonText="Export conversations"
      onclick={handleExportClick}
      summary={{ show: showExportSummary, verb: 'Exported', items: exportedConversations }}
    />

    <SettingsChatImportExportSection
      title={fTranslate('text_2cff9baabf56')}
      description={fTranslate('text_a659626215c6')}
      IconComponent={Upload}
      buttonText="Import conversations"
      onclick={handleImportClick}
      summary={{ show: showImportSummary, verb: 'Imported', items: importedConversations }}
    />

    <SettingsChatImportExportSection
      title={fTranslate('text_ef85afa1b92c')}
      description={fTranslate('text_21814f9e74f4')}
      IconComponent={Trash2}
      buttonText="Delete all conversations"
      onclick={handleDeleteAllClick}
      titleClass="text-destructive"
      buttonVariant="destructive"
      buttonClass="text-destructive-foreground justify-start justify-self-start bg-destructive hover:bg-destructive/80 md:w-auto"
    />
  </SettingsGroup>

  <SettingsGroup title={fTranslate('text_74a883a037bc')}>
    <SettingsChatImportExportSection
      title={fTranslate('text_3664895579f0')}
      description={fTranslate('text_72df65773b40')}
      IconComponent={Download}
      buttonText="Export settings"
      onclick={handleSettingsExport}
      summary={{ show: showSettingsExportSummary, verb: 'Exported', items: [] }}
    />

    <SettingsChatImportExportSection
      title={fTranslate('text_2cff9baabf56')}
      description={fTranslate('text_6235faca5e63')}
      IconComponent={Upload}
      buttonText="Import settings"
      onclick={handleSettingsImport}
      summary={{ show: showSettingsImportSummary, verb: 'Imported', items: [] }}
    />
  </SettingsGroup>
</div>

<DialogExportSettings
  bind:open={showSettingsExportDialog}
  bind:includeSensitiveData
  onConfirm={handleSettingsExportConfirm}
  onCancel={handleSettingsExportCancel}
/>

<DialogConversationSelection
  conversations={availableConversations}
  {messageCountMap}
  mode={ConversationSelectionMode.EXPORT}
  bind:open={showExportDialog}
  onCancel={() => (showExportDialog = false)}
  onConfirm={handleExportConfirm}
/>

<DialogConversationSelection
  conversations={availableConversations}
  {messageCountMap}
  mode={ConversationSelectionMode.IMPORT}
  bind:open={showImportDialog}
  onCancel={() => (showImportDialog = false)}
  onConfirm={handleImportConfirm}
/>

<DialogConfirmation
  bind:open={showDeleteDialog}
  title={fTranslate('text_43a72ccf4424')}
  description={fTranslate('text_45145fe2a7ce')}
  confirmText={fTranslate('text_ef85afa1b92c')}
  cancelText={fTranslate('text_19766ed6ccb2')}
  variant="destructive"
  icon={Trash2}
  onConfirm={handleDeleteAllConfirm}
  onCancel={handleDeleteAllCancel}
/>

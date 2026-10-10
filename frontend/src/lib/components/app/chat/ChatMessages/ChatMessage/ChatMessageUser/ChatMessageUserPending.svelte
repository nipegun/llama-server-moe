<script lang="ts">
  import { fTranslate } from '../../../../../../i18n';

  import { ActionIcon, ChatMessageEditForm, ChatMessageUserBubble } from '$lib/components/app';
  import { ArrowUp, Edit, Trash2 } from '@lucide/svelte';
  import { useMessageEditContext } from '$lib/hooks/use-message-edit-context.svelte';

  interface Props {
    class?: string;
    content: string;
    extras?: DatabaseMessageExtra[];
    onSendImmediately: () => void;
    onEdit: (newContent: string, extras?: DatabaseMessageExtra[]) => void;
    onDelete: () => void;
  }

  let {
    class: className = '',
    content,
    extras = [],
    onSendImmediately,
    onEdit,
    onDelete
  }: Props = $props();

  const editCtx = useMessageEditContext({
    getContent: () => content,
    getExtras: () => extras,
    onSave: (content, extras) => onEdit(content, extras)
  });
</script>

<div
  aria-label={fTranslate('text_99c5e7655065')}
  class="group flex flex-col items-end gap-3 transition-opacity hover:opacity-80 md:gap-2 {className} sticky bottom-32"
  role="group"
>
  {#if editCtx.isEditing}
    <ChatMessageEditForm />
  {:else}
    <ChatMessageUserBubble
      {content}
      attachments={extras}
      textColorClass="text-muted-foreground"
      cardBgClass="dark:bg-primary/8"
      maxHeightStyle="overflow-wrap: anywhere; word-break: break-word;"
    />

    <div class="max-w-[80%]">
      <div class="relative flex h-6 items-center justify-between">
        <div class="right-0 flex items-center gap-2 opacity-100 transition-opacity">
          <div
            class="pointer-events-auto inset-0 flex items-center gap-1 opacity-0 transition-all duration-150 group-hover:opacity-100"
          >
            <ActionIcon
              icon={Edit}
              tooltip={fTranslate('text_464c4ffd019e')}
              onclick={editCtx.handleEdit}
            />
            <ActionIcon
              icon={Trash2}
              tooltip={fTranslate('text_e2d0a54968ea')}
              onclick={onDelete}
            />
            <ActionIcon
              icon={ArrowUp}
              tooltip={fTranslate('text_d330d7c6066f')}
              onclick={onSendImmediately}
            />
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

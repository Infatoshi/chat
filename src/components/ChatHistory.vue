<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import type { Conversation } from '../types/Conversation';
import { formatDistanceToNow } from 'date-fns';

const props = defineProps<{
  conversations: Conversation[];
  currentConversationId?: string;
}>();

const emit = defineEmits<{
  (e: 'select', conversation: Conversation): void;
  (e: 'new'): void;
  (e: 'delete', conversation: Conversation): void;
}>();

const handleDelete = (conversation: Conversation) => {
  console.log('Delete button clicked for conversation:', {
    id: conversation.id,
    title: conversation.title
  });
  
  console.log('Emitting delete event');
  emit('delete', conversation);
};

const getTimeAgo = (isoString: string) => {
  return formatDistanceToNow(new Date(isoString), { addSuffix: true });
};

const getPreviewText = (conversation: Conversation) => {
  const lastMessage = conversation.messages[conversation.messages.length - 1];
  if (!lastMessage) return 'New conversation';
  return lastMessage.content.slice(0, 60) + (lastMessage.content.length > 60 ? '...' : '');
};
</script>

<template>
  <aside class="chat-history">
    <div class="header">
      <div class="header-title">
        <h2>Chat History</h2>
        <span class="keyboard-hint">(⌘H to hide)</span>
      </div>
      <button class="new-chat" @click="emit('new')" title="New Chat (⌘N)">
        <span>+</span> New Chat
      </button>
    </div>
    
    <div class="conversations">
      <div
        v-for="conversation in conversations"
        :key="conversation.id"
        :class="['conversation-item', { active: conversation.id === currentConversationId }]"
      >
        <div class="conversation-content" @click="emit('select', conversation)">
          <div class="conversation-title">{{ conversation.title }}</div>
          <div class="conversation-preview">{{ getPreviewText(conversation) }}</div>
          <div class="conversation-time">{{ getTimeAgo(conversation.lastResponseTime) }}</div>
        </div>
        <button 
          class="delete-button" 
          @click.stop="handleDelete(conversation)"
          title="Delete conversation"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 6h18"></path>
            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    </div>
  </aside>
</template>

<style scoped>
.chat-history {
  width: 260px;
  height: 100vh;
  background: var(--color-bg-secondary);
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  position: fixed;
  left: 0;
  top: 0;
}

.header {
  padding: 1rem;
  border-bottom: 1px solid var(--color-border);
}

.header h2 {
  margin: 0;
  font-size: 1.2rem;
  color: var(--color-text-primary);
  margin-bottom: 1rem;
}

.new-chat {
  width: 100%;
  padding: 0.75rem;
  background: var(--color-accent);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  transition: all 0.2s ease;
}

.new-chat:hover {
  background: var(--color-accent-hover);
}

.new-chat span {
  font-size: 1.2rem;
  font-weight: bold;
}

.conversations {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.conversation-item {
  padding: 0.75rem;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
  border: 1px solid transparent;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
}

.conversation-item:hover {
  background: var(--color-bg-hover);
}

.conversation-item.active {
  background: var(--color-bg-active);
  border-color: var(--color-accent);
}

.conversation-content {
  flex: 1;
  min-width: 0;
}

.conversation-title {
  font-weight: 500;
  color: var(--color-text-primary);
  margin-bottom: 0.25rem;
}

.conversation-preview {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
  margin-bottom: 0.25rem;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.conversation-time {
  font-size: 0.75rem;
  color: var(--color-text-tertiary);
}

.delete-button {
  opacity: 0;
  background: none;
  border: none;
  padding: 0.25rem;
  color: var(--color-text-tertiary);
  cursor: pointer;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.delete-button:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-error);
}

.conversation-item:hover .delete-button {
  opacity: 1;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.keyboard-hint {
  font-size: 0.8rem;
  color: var(--color-text-tertiary);
  font-weight: normal;
}
</style> 
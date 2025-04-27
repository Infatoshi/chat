<!-- A modern command palette style prompt selector -->
<template>
  <div v-if="isPromptSelectorVisible" class="prompt-container" @keydown="handleKeydown" tabindex="-1" ref="containerRef">
    <div class="prompt-backdrop" @click="$emit('close')" />
    <div class="prompt-overlay">
      <div class="prompt-content">
        <h3>Prompts (Press Esc to close)</h3>
        
        <div v-if="!isAddingPrompt" class="prompt-section">
          <div class="prompt-list">
            <!-- Add New Prompt button -->
            <div
              class="prompt-item"
              :class="{ 'is-focused': selectedIndex === -1 }"
              @click="$emit('update:is-adding-prompt', true)"
            >
              <div class="prompt-item-content">
                <span class="prompt-name">+ New Prompt</span>
                <span class="prompt-shortcut">⌘P</span>
              </div>
            </div>

            <!-- Existing prompts -->
            <div
              v-for="(prompt, index) in availablePrompts"
              :key="prompt.id"
              class="prompt-item"
              :class="{ 'is-focused': index === selectedIndex }"
              @click="handlePromptClick(index)"
              @mouseenter="$emit('update:selected-index', index)"
            >
              <div class="prompt-item-content">
                <span class="prompt-name">{{ prompt.name }}</span>
                <div class="prompt-actions">
                  <button
                    v-if="prompt.id !== 'default'"
                    class="delete-button"
                    type="button"
                    @click.stop="() => {
                      console.log('🗑️ Delete button clicked, emitting delete for prompt:', prompt);
                      emit('delete', prompt.id);
                    }"
                    title="Delete prompt"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M3 6h18"></path>
                      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                    </svg>
                  </button>
                  <span v-if="prompt.id === 'new'" class="prompt-shortcut">⌘P</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="prompt-section">
          <div class="prompt-controls">
            <div class="prompt-field" :class="{ 'is-focused': focusedField === 'name' }">
              <label>Prompt Name</label>
              <input
                type="text"
                :value="newPromptName"
                @input="(e) => $emit('update:new-prompt-name', (e.target as HTMLInputElement).value)"
                @focus="focusedField = 'name'"
                @blur="focusedField = null"
                ref="nameInputRef"
                placeholder="Enter prompt name..."
              />
            </div>

            <div class="prompt-field" :class="{ 'is-focused': focusedField === 'content' }">
              <label>Prompt Content</label>
              <textarea
                :value="newPromptContent"
                @input="(e) => $emit('update:new-prompt-content', (e.target as HTMLTextAreaElement).value)"
                @focus="focusedField = 'content'"
                @blur="focusedField = null"
                ref="contentInputRef"
                placeholder="Enter prompt content..."
                rows="6"
              ></textarea>
            </div>

            <div class="prompt-actions">
              <button 
                class="create-button" 
                @click="$emit('create')"
                :disabled="!newPromptName || !newPromptContent"
              >
                Create
              </button>
              <button class="cancel-button" @click="handleCancel">
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, nextTick } from 'vue';

const props = defineProps<{
  prompts: Array<{ id: string; name: string; content: string; }>;
  selectedIndex: number;
  isAddingPrompt: boolean;
  newPromptName: string;
  newPromptContent: string;
  isPromptSelectorVisible: boolean;
}>();

const emit = defineEmits<{
  (e: 'select', prompt: { id: string; name: string; content: string }): void;
  (e: 'create'): void;
  (e: 'delete', id: string): void;
  (e: 'close'): void;
  (e: 'update:new-prompt-name', value: string): void;
  (e: 'update:new-prompt-content', value: string): void;
  (e: 'update:is-adding-prompt', value: boolean): void;
  (e: 'update:selected-index', value: number): void;
}>();

const containerRef = ref<HTMLElement | null>(null);
const nameInputRef = ref<HTMLInputElement | null>(null);
const contentInputRef = ref<HTMLTextAreaElement | null>(null);
const focusedField = ref<string | null>(null);

const availablePrompts = computed(() => props.prompts);

watch(() => props.isPromptSelectorVisible, async (visible) => {
  if (visible) {
    await nextTick();
    containerRef.value?.focus();
  }
});

watch(() => props.isAddingPrompt, async (isAdding) => {
  if (isAdding) {
    await nextTick();
    nameInputRef.value?.focus();
  }
});

function handlePromptClick(index: number) {
  const selectedPrompt = availablePrompts.value[index];
  console.log('Clicked prompt:', selectedPrompt.name);
  emit('update:selected-index', index);
  emit('select', selectedPrompt);
  emit('close');
}

function handleCancel() {
  emit('update:new-prompt-name', '');
  emit('update:new-prompt-content', '');
  emit('update:is-adding-prompt', false);
}

function handleKeydown(event: KeyboardEvent) {
  if (props.isAddingPrompt) {
    if (event.key === 'Escape') {
      event.preventDefault();
      handleCancel();
    } else if (event.key === 'Tab') {
      if (event.shiftKey && document.activeElement === nameInputRef.value) {
        event.preventDefault();
        contentInputRef.value?.focus();
      } else if (!event.shiftKey && document.activeElement === contentInputRef.value) {
        event.preventDefault();
        nameInputRef.value?.focus();
      }
    }
    return;
  }

  switch (event.key) {
    case 'ArrowUp':
      event.preventDefault();
      emit('update:selected-index', Math.max(-1, props.selectedIndex - 1));
      break;
    case 'ArrowDown':
      event.preventDefault();
      emit('update:selected-index', Math.min(availablePrompts.value.length - 1, props.selectedIndex + 1));
      break;
    case 'Enter':
      event.preventDefault();
      if (props.selectedIndex === -1) {
        emit('update:is-adding-prompt', true);
      } else if (props.selectedIndex >= 0) {
        handlePromptClick(props.selectedIndex);
      }
      break;
    case 'Escape':
      event.preventDefault();
      emit('close');
      break;
  }
}
</script>

<style scoped>
.prompt-container {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.prompt-backdrop {
  position: fixed;
  inset: 0;
  background: var(--color-overlay);
}

.prompt-overlay {
  position: relative;
  background: var(--color-bg-primary);
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: var(--shadow-lg);
  border: 1px solid var(--color-border);
  min-width: 500px;
  max-width: 90vw;
}

.prompt-content h3 {
  margin: 0 0 1rem 0;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text-primary);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.1rem;
}

.prompt-section {
  margin-bottom: 1rem;
}

.prompt-list {
  max-height: 300px;
  overflow-y: auto;
}

.prompt-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.prompt-item-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex: 1;
  margin-right: 0.5rem;
}

.prompt-name {
  flex: 1;
  margin-right: 1rem;
}

.prompt-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.prompt-shortcut {
  font-size: 0.8rem;
  color: var(--color-text-tertiary);
  padding: 0.2rem 0.4rem;
  background: var(--color-bg-secondary);
  border-radius: 4px;
}

.prompt-item:hover {
  background: var(--color-bg-hover);
}

.prompt-item.is-focused {
  background: var(--color-bg-hover);
}

.delete-button {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.25rem;
  border: none;
  background: transparent;
  color: var(--color-text-tertiary);
  border-radius: 4px;
  cursor: pointer;
  opacity: 0;
  transition: all 0.2s ease;
}

.prompt-item:hover .delete-button {
  opacity: 1;
}

.delete-button:hover {
  background: var(--color-bg-danger);
  color: var(--color-text-danger);
}

.prompt-controls {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.prompt-field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem;
  border-radius: 6px;
  transition: background-color 0.2s;
}

.prompt-field.is-focused {
  background: var(--color-bg-hover);
}

.prompt-field label {
  color: var(--color-text-primary);
  font-size: 0.9rem;
  font-weight: 500;
}

.prompt-field input,
.prompt-field textarea {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  font-size: 0.9rem;
  transition: border-color 0.2s;
}

.prompt-field input:focus,
.prompt-field textarea:focus {
  outline: none;
  border-color: var(--color-accent);
}

.create-button,
.cancel-button {
  padding: 0.5rem 1rem;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s ease;
}

.create-button {
  background-color: var(--color-accent);
  color: white;
}

.create-button:hover:not(:disabled) {
  background-color: var(--color-accent-hover);
}

.create-button:disabled {
  background-color: var(--color-disabled);
  cursor: not-allowed;
}

.cancel-button {
  background-color: var(--color-bg-secondary);
  color: var(--color-text-primary);
}

.cancel-button:hover {
  background-color: var(--color-bg-hover);
}

.prompt-container:focus {
  outline: none;
}
</style> 
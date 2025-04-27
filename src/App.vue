<script setup lang="ts">
import { ref, onMounted, watch, computed } from "vue";
import { useModelSelection } from './composables/useModelSelection';
import { useCommandK } from './composables/useCommandK';
import { useAddModels } from './composables/useAddModels';
import type { CustomModel } from './composables/useAddModels';
import ChatWindow from './components/ChatWindow.vue';
import { useDarkMode } from './composables/useDarkMode';
import { useConversations } from './composables/useConversations';
import ChatHistory from './components/ChatHistory.vue';
import ErrorBoundary from './components/ErrorBoundary.vue';
import ErrorLogger from './utils/errorLogger';
import Settings from './components/Settings.vue';
import type { Message, Conversation } from './types/Conversation';
import PromptSelector from './components/PromptSelector.vue';
import { usePromptSelection } from './composables/usePromptSelection';

// Add debug logging
const logDebug = (component: string, message: string, data?: any) => {
  console.log(`[${component}] ${message}`, data || '');
};

// Log initial mount
logDebug('App', 'Component mounting');

const messages = ref<Message[]>([]);
const isLoading = ref(false);
const chatWindowRef = ref<InstanceType<typeof ChatWindow> | null>(null);
const isChatHistoryVisible = ref(false);
const isSettingsVisible = ref(false);
const modelSettings = ref({
  temperature: 0.7,
  maxTokens: 4096
});

// Use the add models composable first
const {
  isAddModelVisible,
  customModels,
  newModelName,
  newModelId,
  showAddModel,
  hideAddModel,
  addModel,
  removeModel,
  isLoading: modelsLoading
} = useAddModels((model) => {
  logDebug('App', 'New model added', model);
});

logDebug('App', 'Custom models loaded', customModels.value);

// Initialize model selection with current models
const {
  selectedModel,
  isModelSelectorVisible,
  isDeleteMode,
  selectedModelIndex,
  availableModels,
  handleKeydown: handleModelKeydown,
  getSystemMessage,
  getModelDisplayName,
  selectModel,
  updateModels,
  handleDeleteModel
} = useModelSelection(customModels.value, async (modelId) => {
  try {
    await removeModel(modelId);
  } catch (error) {
    console.error('Failed to delete model:', error);
  }
});

// Watch for models loading completion and updates
watch([customModels, modelsLoading], ([newModels, isLoading]) => {
  logDebug('App', 'Custom models or loading state changed', { models: newModels, isLoading });
  if (!isLoading) {
    updateModels(newModels);
  }
}, { immediate: true, deep: true });

logDebug('App', 'Model selection initialized', {
  selectedModel: selectedModel.value,
  availableModels: availableModels.value
});

// Use the command menu composable
const {
  isCommandMenuVisible,
  selectedCommandIndex,
  availableCommands: baseCommands,
  handleKeydown: handleCommandKeydown
} = useCommandK(undefined, () => {
  // Show model selector in delete mode
  isModelSelectorVisible.value = true;
  isDeleteMode.value = true;
});

// Extend available commands
const availableCommands = [
  ...baseCommands,
  "Clear All Conversations",
  "Delete Current Chat"
];

// Use dark mode composable
const { isDark, toggleDarkMode } = useDarkMode();

const searchTerm = ref('');

// Use the conversations composable
const {
  conversations,
  currentConversationId,
  createConversation,
  updateConversation,
  deleteConversation,
  clearAllConversations,
  loadConversations
} = useConversations();

logDebug('App', 'Conversations loaded', {
  count: conversations.value.length,
  currentId: currentConversationId.value
});

// Add handler for settings changes
const handleSettingsChange = (newSettings: any) => {
  modelSettings.value = {
    temperature: newSettings.temperature,
    maxTokens: newSettings.maxTokens
  };
};

async function sendMessage(message: string) {
  if (!currentConversationId.value) {
    createConversation(getSystemMessage(), selectedModel.value?.id || '');
  }

  // Add user message to chat and conversation
  const userMessage: Message = {
    role: "user",
    content: message
  };
  messages.value.push(userMessage);
  updateConversation(currentConversationId.value!, userMessage);
  
  isLoading.value = true;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${import.meta.env.VITE_OPENROUTER_API_KEY}`,
        "HTTP-Referer": import.meta.env.VITE_SITE_URL,
        "X-Title": import.meta.env.VITE_SITE_NAME,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        "model": selectedModel.value?.id || '',
        "messages": messages.value,
        "stream": true,
        "temperature": modelSettings.value.temperature,
        "max_tokens": modelSettings.value.maxTokens
      })
    });

    if (!response.ok) {
      throw new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
      });
    }

    if (!response.body) {
      throw new Error("Response body is null");
    }

    // Start streaming
    chatWindowRef.value?.startStreaming();
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // Decode the chunk and split into lines
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      // Process each line
      for (const line of lines) {
        if (line.trim() === '') continue;
        if (line.includes('[DONE]')) continue;

        try {
          // Remove 'data: ' prefix and parse JSON
          const data = JSON.parse(line.replace(/^data: /, ''));
          if (data.choices?.[0]?.delta?.content) {
            const token = data.choices[0].delta.content;
            fullContent += token;
            chatWindowRef.value?.appendToken(token);
          }
        } catch (e) {
          console.warn('Error parsing streaming response line:', e);
        }
      }
    }

    // End streaming and add the complete message
    chatWindowRef.value?.endStreaming();
    const assistantMessage: Message = {
      role: "assistant",
      content: fullContent
    };
    messages.value.push(assistantMessage);
    updateConversation(currentConversationId.value!, assistantMessage);
  } catch (error) {
    console.error('Error:', error);
    const errorMessage: Message = {
      role: "system",
      content: "Sorry, there was an error processing your request."
    };
    messages.value.push(errorMessage);
    updateConversation(currentConversationId.value!, errorMessage);
  } finally {
    isLoading.value = false;
  }
}

// Handle conversation selection
function handleConversationSelect(conversation: Conversation) {
  currentConversationId.value = conversation.id;
  messages.value = [...conversation.messages];
  const model = customModels.value.find(m => m.id === conversation.model);
  if (model) {
    selectModel(model);
  }
}

// Handle conversation deletion
function handleConversationDelete(conversation: Conversation) {
  console.log('Handling conversation delete in App.vue:', {
    id: conversation.id,
    title: conversation.title,
    currentId: currentConversationId.value
  });
  
  if (conversation.id === currentConversationId.value) {
    console.log('Clearing messages as current conversation is being deleted');
    messages.value = [];
  }
  
  console.log('Calling deleteConversation function');
  deleteConversation(conversation).then(() => {
    console.log('Delete completed, reloading conversations');
    loadConversations();
  }).catch(error => {
    console.error('Error in deleteConversation:', error);
  });
}

// Handle new conversation
function handleNewConversation() {
  messages.value = [];
  const conversation = createConversation(getSystemMessage(), selectedModel.value?.id || '');
  handleConversationSelect(conversation);
}

// Function to handle command selection
function handleCommandSelect(command: typeof availableCommands[number]) {
  switch (command) {
    case "Clear Chat":
      messages.value = [];
      break;
    case "Toggle Dark Mode":
      toggleDarkMode();
      break;
    case "Export Chat":
      const chatExport = messages.value.map(m => `${m.role}: ${m.content}`).join('\n');
      const blob = new Blob([chatExport], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'chat-export.txt';
      a.click();
      URL.revokeObjectURL(url);
      break;
    case "Add Model":
      showAddModel();
      break;
    case "Delete Model":
      isModelSelectorVisible.value = true;
      isDeleteMode.value = true;
      break;
    case "Clear All Conversations":
      clearAllConversations().then(() => {
        loadConversations();
        messages.value = [];
      });
      break;
    case "Delete Current Chat":
      if (currentConversationId.value) {
        const conversation = conversations.value.find(c => c.id === currentConversationId.value);
        if (conversation && confirm('Are you sure you want to delete this conversation? This action cannot be undone.')) {
          deleteConversation(conversation).then(() => {
            loadConversations();
            messages.value = [];
          });
        }
      }
      break;
    case "Settings":
      console.log('Settings command selected');
      isSettingsVisible.value = true;
      break;
  }
}

// Add prompt selection setup
const {
  isPromptSelectorVisible,
  isAddingPrompt,
  selectedPromptIndex,
  availablePrompts,
  newPromptName,
  newPromptContent,
  activePrompt,
  handleKeydown: handlePromptKeydown,
  createPrompt,
  deletePrompt,
} = usePromptSelection([], selectedModel.value, (prompt) => {
  // Handle prompt selection
  console.log('Selected prompt content:', prompt.content);

  // Update the system prompt in the current conversation
  const conversationId = currentConversationId.value;
  if (conversationId) {
    const conversation = conversations.value.find(c => c.id === conversationId);
    if (conversation) {
      conversation.systemPrompt = prompt.content;
      
      // Also update the messages array to show the change
      const systemMessageIndex = conversation.messages.findIndex(m => m.role === 'system');
      if (systemMessageIndex !== -1) {
        conversation.messages[systemMessageIndex].content = prompt.content;
      } else {
        conversation.messages.unshift({
          role: 'system',
          content: prompt.content
        });
      }
      // Update the local messages array to reflect changes
      messages.value = [...conversation.messages];
    }
  }
});

// Watch for model changes to update the system prompt
watch(selectedModel, () => {
  if (activePrompt.value) {
    handlePromptSelect(activePrompt.value);
  }
});

function handlePromptSelect(prompt: { id: string; name: string; content: string }) {
  console.log('Selected prompt content:', prompt.content);
  
  // Update the system prompt in the current conversation
  const conversationId = currentConversationId.value;
  if (conversationId) {
    const conversation = conversations.value.find(c => c.id === conversationId);
    if (conversation) {
      conversation.systemPrompt = prompt.content;
      
      // Also update the messages array to show the change
      const systemMessageIndex = conversation.messages.findIndex(m => m.role === 'system');
      if (systemMessageIndex !== -1) {
        conversation.messages[systemMessageIndex].content = prompt.content;
      } else {
        conversation.messages.unshift({
          role: 'system',
          content: prompt.content
        });
      }
      // Update the local messages array to reflect changes
      messages.value = [...conversation.messages];
    }
  }
}

// Update onMounted to handle keyboard shortcuts
onMounted(async () => {
  // Load existing conversations
  await loadConversations();

  window.addEventListener('keydown', (e) => {
    // Handle Command+L to focus chat input
    if ((e.metaKey || e.ctrlKey) && e.key === 'l') {
      e.preventDefault();
      chatWindowRef.value?.focusInput();
      return;
    }

    // Handle Command+H to toggle chat history
    if ((e.metaKey || e.ctrlKey) && e.key === 'h') {
      e.preventDefault();
      isChatHistoryVisible.value = !isChatHistoryVisible.value;
      return;
    }

    // Handle Command+N for new chat
    if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
      e.preventDefault();
      handleNewConversation();
      return;
    }
    
    // Handle all other keyboard shortcuts
    handleModelKeydown(e);
    handleCommandKeydown(e, handleCommandSelect);
    handlePromptKeydown(e);
  });

  // Always create a new conversation when the app opens
  handleNewConversation();
});
</script>

<template>
  <ErrorBoundary component-name="App">
    <div class="app-container">
      <ErrorBoundary component-name="ChatHistory">
        <ChatHistory
          v-if="isChatHistoryVisible"
          :conversations="conversations"
          :current-conversation-id="currentConversationId"
          @select="handleConversationSelect"
          @new="handleNewConversation"
          @delete="handleConversationDelete"
        />
      </ErrorBoundary>
      
      <main :class="['container', { 'full-width': !isChatHistoryVisible }]">

        <!-- Add Model Dialog -->
        <div v-if="isAddModelVisible" class="modal">
          <div class="modal-content">
            <h3>Add Custom Model</h3>
            <form @submit.prevent="addModel">
              <div class="form-group">
                <label for="modelName">Model Name:</label>
                <input 
                  id="modelName"
                  v-model="newModelName"
                  placeholder="e.g. My Custom GPT-4"
                  required
                />
              </div>
              <div class="form-group">
                <label for="modelId">Model ID:</label>
                <input 
                  id="modelId"
                  v-model="newModelId"
                  placeholder="e.g. openai/custom-gpt4"
                  required
                />
              </div>
              <div class="modal-actions">
                <button type="button" @click="hideAddModel">Cancel</button>
                <button type="submit">Add Model</button>
              </div>
            </form>
          </div>
        </div>

        <!-- Add command menu overlay -->
        <div v-if="isCommandMenuVisible" class="command-menu">
          <div class="command-menu-content">
            <h3>Commands (⌘K)</h3>
            <div class="command-list">
              <div
                v-for="(command, index) in availableCommands"
                :key="command"
                :class="['command-option', { active: index === selectedCommandIndex }]"
              >
                {{ command }}
              </div>
            </div>
          </div>
        </div>

        <!-- Model selector overlay -->
        <div v-if="isModelSelectorVisible" class="model-selector">
          <div class="model-selector-content">
            <h3>
              Select Model (⌘J)
              <span v-if="searchTerm" class="search-indicator">
                "{{ searchTerm }}"
              </span>
            </h3>
            <div class="model-list">
              <div
                v-for="(model, index) in availableModels"
                :key="model.id"
                :class="['model-option', { active: index === selectedModelIndex }]"
              >
                {{ model.name }}
              </div>
            </div>
          </div>
        </div>

        <!-- Prompt selector overlay -->
        <div v-if="isPromptSelectorVisible" class="prompt-selector">
          <div class="prompt-selector-content">
            <h3>Prompts (⌘P)</h3>
            <div class="prompt-list">
              <div
                v-for="(prompt, index) in availablePrompts"
                :key="prompt.id"
                :class="['prompt-option', { active: index === selectedPromptIndex }]"
              >
                {{ prompt.name }}
              </div>
            </div>
          </div>
        </div>

        <ErrorBoundary component-name="ChatWindow">
          <ChatWindow 
            ref="chatWindowRef"
            :messages="messages"
            :is-loading="isLoading"
            :selected-model="selectedModel"
            :get-model-display-name="getModelDisplayName"
            @send-message="sendMessage"
          />
        </ErrorBoundary>
      </main>

      <Settings 
        :is-open="isSettingsVisible"
        @close="isSettingsVisible = false"
        @settings-change="handleSettingsChange"
      />

      <!-- Prompt selector -->
      <PromptSelector
        v-if="isPromptSelectorVisible"
        :prompts="availablePrompts"
        :selected-index="selectedPromptIndex"
        :is-adding-prompt="isAddingPrompt"
        :new-prompt-name="newPromptName"
        :new-prompt-content="newPromptContent"
        :is-prompt-selector-visible="isPromptSelectorVisible"
        @select="handlePromptSelect"
        @create="createPrompt"
        @delete="(id) => {
          console.log('🗑️ App received delete event for prompt:', id);
          deletePrompt(id);
        }"
        @close="isPromptSelectorVisible = false"
        @update:new-prompt-name="newPromptName = $event"
        @update:new-prompt-content="newPromptContent = $event"
        @update:is-adding-prompt="isAddingPrompt = $event"
        @update:selected-index="selectedPromptIndex = $event"
      />
    </div>
  </ErrorBoundary>
</template>

<style scoped>
.app-container {
  display: flex;
  min-height: 100vh;
  background-color: var(--color-bg-primary);
}

.container {
  flex: 1;
  margin-left: 260px; /* Match the width of chat history */
  padding: 2rem;
  max-width: 1200px;
  transition: margin-left 0.3s ease;
}

.container.full-width {
  margin-left: 0;
}

h1 {
  color: var(--color-text-primary);
  font-size: 2rem;
  font-weight: 600;
  margin-bottom: 2rem;
}

.modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: var(--color-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: var(--color-bg-primary);
  padding: 2rem;
  border-radius: 8px;
  min-width: 400px;
  box-shadow: var(--shadow-lg);
  border: 1px solid var(--color-border);
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: var(--color-text-primary);
}

.form-group input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 1rem;
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  transition: all 0.2s ease;
}

.form-group input:focus {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 2px var(--color-accent-hover);
  outline: none;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 1rem;
  margin-top: 1.5rem;
}

.modal-actions button {
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.modal-actions button[type="button"] {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);
}

.modal-actions button[type="submit"] {
  background: var(--color-accent);
  color: white;
  border: none;
}

.modal-actions button:hover {
  transform: translateY(-1px);
}

.modal-actions button:active {
  transform: translateY(0);
}

.command-menu,
.model-selector,
.prompt-selector {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: var(--color-bg-primary);
  padding: 1rem;
  border-radius: 8px;
  box-shadow: var(--shadow-lg);
  z-index: 1000;
  border: 1px solid var(--color-border);
  min-width: 300px;
}

.command-menu h3,
.model-selector h3,
.prompt-selector h3 {
  margin: 0 0 1rem 0;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text-primary);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.command-menu h3::after,
.model-selector h3::after,
.prompt-selector h3::after {
  content: "(↵ to select)";
  font-size: 0.8rem;
  font-weight: normal;
  color: var(--color-text-tertiary);
}

.command-list,
.model-list,
.prompt-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 60vh;
  overflow-y: auto;
}

.command-option,
.model-option,
.prompt-option {
  padding: 0.75rem;
  cursor: pointer;
  border-radius: 6px;
  color: var(--color-text-primary);
  transition: all 0.2s ease;
}

.command-option:hover,
.model-option:hover,
.prompt-option:hover {
  background: var(--color-bg-hover);
}

.command-option.active,
.model-option.active,
.prompt-option.active {
  background: var(--color-accent);
  color: white;
}

.search-indicator {
  font-size: 0.9rem;
  color: var(--color-accent);
  margin-left: 0.5rem;
  font-weight: normal;
}
</style>
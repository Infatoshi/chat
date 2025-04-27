<script setup lang="ts">
import { ref, nextTick, computed } from "vue";
import type { CustomModel } from '../composables/useAddModels';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';

const props = defineProps<{
  messages: Array<{ role: string; content: string }>;
  isLoading: boolean;
  selectedModel: CustomModel | null;
  getModelDisplayName: (modelId: string) => string;
}>();

const emit = defineEmits<{
  (e: 'send-message', message: string): void;
}>();

// Function to format markdown text
const formatMarkdown = (text: string) => {
  if (!text) return '';
  
  let formatted = text;

  // Language normalization map
  const languageMap: { [key: string]: string } = {
    'cuda': 'cpp',
    'c++': 'cpp',
    'js': 'javascript',
    'shell': 'bash',
    'sh': 'bash',
    'py': 'python'
  };

  // Replace code blocks with syntax highlighting
  formatted = formatted.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
    // Normalize the language
    const normalizedLang = lang ? (languageMap[lang.toLowerCase()] || lang.toLowerCase()) : '';
    
    // Only highlight if it's one of our supported languages
    if (['python', 'javascript', 'cpp', 'bash'].includes(normalizedLang)) {
      try {
        const highlighted = hljs.highlight(code.trim(), { language: normalizedLang }).value;
        return `<pre class="code-block ${normalizedLang}"><code>${highlighted}</code></pre>`;
      } catch (e) {
        return `<pre class="code-block ${normalizedLang}"><code>${code}</code></pre>`;
      }
    } else {
      // For unsupported languages, just return formatted code without highlighting
      return `<pre class="code-block"><code>${code}</code></pre>`;
    }
  });

  // Replace inline code (single backticks)
  formatted = formatted.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

  // Replace headings (must be at start of line)
  formatted = formatted.replace(/^### (.*?)$/gm, '<h3>$1</h3>');
  formatted = formatted.replace(/^## (.*?)$/gm, '<h2>$1</h2>');
  formatted = formatted.replace(/^# (.*?)$/gm, '<h1>$1</h1>');
  
  // Replace **text** with <strong>text</strong> for bold
  formatted = formatted.replace(/\*\*(?!\*)(.*?)(?<!\*)\*\*/g, '<strong>$1</strong>');
  
  // Replace *text* with <em>text</em> for italic
  formatted = formatted.replace(/(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
  
  return formatted;
};

const newMessage = ref("");
const messagesContainer = ref<HTMLElement | null>(null);
const streamingMessage = ref("");
const isStreaming = ref(false);
const inputRef = ref<HTMLInputElement | null>(null);

// Computed property to combine regular messages with streaming message
const displayMessages = computed(() => {
  const allMessages = [...props.messages];
  if (isStreaming.value && streamingMessage.value) {
    allMessages.push({
      role: "assistant",
      content: streamingMessage.value
    });
  }
  return allMessages;
});

// Function to scroll to bottom of messages
async function scrollToBottom() {
  await nextTick();
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
}

async function sendMessage() {
  if (!newMessage.value.trim()) return;
  emit('send-message', newMessage.value);
  newMessage.value = "";
  streamingMessage.value = "";
  await scrollToBottom();
}

// Function to focus input
function focusInput() {
  inputRef.value?.focus();
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    if (e.metaKey || e.ctrlKey) {
      // Cmd+Enter to send
      e.preventDefault();
      sendMessage();
    } else {
      // Regular Enter for new line
      e.stopPropagation(); // Prevent form submission
    }
  }
}

// Expose methods for parent component
defineExpose({
  startStreaming() {
    isStreaming.value = true;
    streamingMessage.value = "";
  },
  appendToken(token: string) {
    streamingMessage.value += token;
    scrollToBottom();
  },
  endStreaming() {
    isStreaming.value = false;
    streamingMessage.value = "";
  },
  focusInput,
  updateTextbox(content: string) {
    console.log('ChatWindow: Updating textbox with content:', content);
    newMessage.value = content;
    nextTick(() => {
      if (inputRef.value) {
        inputRef.value.value = content;
      }
    });
  }
});
</script>

<template>
  <div class="chat-window">
    <div class="messages" ref="messagesContainer">
      <div v-for="(message, index) in displayMessages" 
           :key="index" 
           :class="['message', message.role, { 'streaming': isStreaming && index === displayMessages.length - 1 }]">
        <div class="message-content">
          <span v-html="formatMarkdown(message.content.replace(/\t/g, '    '))"></span>
          <span v-if="isStreaming && index === displayMessages.length - 1 && message.role === 'assistant'" class="cursor">▋</span>
        </div>
      </div>
      <div v-if="isLoading && !isStreaming" class="message system">
        <p>Thinking...</p>
      </div>
    </div>

    <div class="input-container">
      <form class="input-area" @submit.prevent="sendMessage">
        <textarea 
          v-model="newMessage" 
          placeholder=""
          ref="inputRef"
          @keydown="handleKeydown"
          rows="4"
        />
        <button type="submit" :disabled="isLoading || !newMessage.trim()">
          ⌘↵
        </button>
      </form>
      <div class="model-info">
        Current model: <span class="model-name">{{ selectedModel?.name || 'No model selected' }}</span>
        <span class="model-hint">(⌘J to change)</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chat-window {
  width: 100%;
  max-width: 800px;
  margin: 2rem auto;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-bg-primary);
  display: flex;
  flex-direction: column;
  height: 90vh;
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}

.messages {
  flex-grow: 1;
  overflow-y: auto;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  scroll-behavior: smooth;
  background: var(--color-bg-secondary);
}

.message {
  padding: 1rem;
  border-radius: 12px;
  max-width: 80%;
  line-height: 1.5;
  box-shadow: var(--shadow-sm);
  transition: all 0.2s ease;
  font-family: 'Fira Code', monospace;
}

.message:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.message.user {
  background-color: var(--color-accent);
  color: white;
  align-self: flex-end;
}

.message.assistant {
  background-color: var(--color-bg-primary);
  color: var(--color-text-primary);
  align-self: flex-start;
  border: 1px solid var(--color-border);
}

.message.system {
  background-color: var(--color-warning);
  color: var(--color-text-primary);
  align-self: center;
  font-size: 0.9rem;
  max-width: 95%;
  border: 2px solid var(--color-border);
  box-shadow: var(--shadow-lg);
  padding: 1.0rem;
}

.message.streaming .cursor {
  display: inline-block;
  animation: blink 1s step-end infinite;
  margin-left: 3px;
  font-weight: 300;
}

@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

.input-container {
  border-top: 1px solid var(--color-border);
  background: var(--color-bg-primary);
}

.input-area {
  padding: 1rem;
  display: flex;
  gap: 1rem;
}

.input-area textarea {
  flex-grow: 1;
  padding: 0.75rem 1rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-size: 1rem;
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  transition: all 0.2s ease;
  resize: none;
  font-family: inherit;
  line-height: 1.5;
  min-height: 3rem;
  max-height: 12rem;
  overflow-y: auto;
}

.input-area textarea:focus {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 2px var(--color-accent-hover);
}

.input-area textarea::placeholder {
  color: var(--color-text-secondary);
}

.input-area button {
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-size: 1rem;
  background: var(--color-accent);
  color: white;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
}

.input-area button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.input-area button:not(:disabled):hover {
  background: var(--color-accent-hover);
  transform: translateY(-1px);
}

.input-area button:not(:disabled):active {
  transform: translateY(0);
}

.model-info {
  padding: 0.75rem 1rem;
  font-size: 0.9rem;
  color: var(--color-text-secondary);
  border-top: 1px solid var(--color-border);
  background: var(--color-bg-secondary);
}

.model-name {
  color: var(--color-accent);
  font-weight: 500;
}

.model-hint {
  color: var(--color-text-secondary);
  font-size: 0.8rem;
  margin-left: 0.5rem;
  opacity: 0.8;
}

.message-content {
  white-space: pre-wrap;
  word-wrap: break-word;
  margin: 0;
}

.message-content :deep(strong) {
  font-weight: 600;
}

.message-content :deep(em) {
  font-style: italic;
}

.message-content :deep(h1) {
  font-size: 1.8em;
  font-weight: 600;
  margin: 0.5em 0;
  line-height: 1.2;
  color: var(--color-text-primary);
}

.message-content :deep(h2) {
  font-size: 1.5em;
  font-weight: 600;
  margin: 0.4em 0;
  line-height: 1.2;
  color: var(--color-text-primary);
}

.message-content :deep(h3) {
  font-size: 1.2em;
  font-weight: 600;
  margin: 0.3em 0;
  line-height: 1.2;
  color: var(--color-text-primary);
}

.message-content :deep(.inline-code) {
  background-color: var(--color-bg-secondary);
  padding: 0.2em 0.4em;
  border-radius: 4px;
  font-family: 'Fira Code', monospace;
  font-size: 0.9em;
  color: var(--color-accent);
}

.message-content :deep(.code-block) {
  background-color: var(--color-bg-secondary);
  border-radius: 8px;
  padding: 1em;
  margin: 0.5em 0;
  overflow-x: auto;
  font-family: 'Fira Code', monospace;
  font-size: 0.9em;
  line-height: 1.5;
  position: relative;
}

.message-content :deep(.code-block code) {
  display: block;
  white-space: pre;
  tab-size: 2;
}

.message-content :deep(.code-block.python)::before,
.message-content :deep(.code-block.javascript)::before,
.message-content :deep(.code-block.cpp)::before,
.message-content :deep(.code-block.bash)::before {
  content: attr(class);
  position: absolute;
  top: 0;
  right: 1em;
  font-size: 0.8em;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  padding: 0.3em 0;
}
</style> 
<script setup lang="ts">
import { ref, nextTick, computed, watch, onMounted } from "vue";
import type { CustomModel } from '../composables/useAddModels';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';

// Add type for code blocks with message index
interface CodeBlock {
  id: string;
  language: string;
  code: string;
  highlighted: string;
  messageIndex: number;  // Add message index to track which message this belongs to
}

const props = defineProps<{
  messages: Array<{ role: string; content: string }>;
  isLoading: boolean;
  selectedModel: CustomModel | null;
  getModelDisplayName: (modelId: string) => string;
}>();

const emit = defineEmits<{
  (e: 'send-message', message: string): void;
  (e: 'stop-stream'): void;
  (e: 'edit-message', index: number, newContent: string): void;
}>();

// Add ref for code blocks
const codeBlocks = ref<CodeBlock[]>([]);

// Add ref for the message container
const messageContainer = ref<HTMLElement | null>(null);

// Add ref for streaming code blocks
const streamingCodeBlocks = ref<CodeBlock[]>([]);

// Function to generate unique ID
function generateId() {
  return '_' + Math.random().toString(36).substr(2, 9);
}

// Modified formatMarkdown to handle code blocks with placeholders but keep them in place
const formatMarkdown = (text: string, messageIndex: number) => {
  if (!text) return '';
  
  let formatted = text;
  const newCodeBlocks: CodeBlock[] = [];

  // Language normalization map
  const languageMap: { [key: string]: string } = {
    'cuda': 'cpp',
    'c++': 'cpp',
    'js': 'javascript',
    'shell': 'bash',
    'sh': 'bash',
    'py': 'python'
  };

  // Replace code blocks with syntax highlighting but keep them in place
  formatted = formatted.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
    const id = generateId();
    const normalizedLang = lang ? (languageMap[lang.toLowerCase()] || lang.toLowerCase()) : '';
    
    let highlighted = code;
    if (['python', 'javascript', 'cpp', 'bash'].includes(normalizedLang)) {
      try {
        highlighted = hljs.highlight(code.trim(), { language: normalizedLang }).value;
      } catch (e) {
        console.warn('Highlight failed:', e);
      }
    }

    // Store the code block for reference
    newCodeBlocks.push({
      id,
      language: normalizedLang,
      code: code.trim(),
      highlighted,
      messageIndex
    });

    // Return the HTML directly in place
    const codeBlockHtml = `
      <div class="code-block ${normalizedLang}" id="${id}">
        <div class="code-block-header">
          <button class="copy-button" data-code-id="${id}">
            <span class="copy-icon">📋</span>
            <span class="copy-text">Copy</span>
          </button>
        </div>
        <pre><code>${highlighted}</code></pre>
      </div>
    `;

    return codeBlockHtml;
  });

  // Update code blocks for reference
  codeBlocks.value = [
    ...codeBlocks.value.filter(block => block.messageIndex !== messageIndex),
    ...newCodeBlocks
  ];

  // Handle other markdown formatting
  formatted = formatted.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
  formatted = formatted.replace(/^### (.*?)$/gm, '<h3>$1</h3>');
  formatted = formatted.replace(/^## (.*?)$/gm, '<h2>$1</h2>');
  formatted = formatted.replace(/^# (.*?)$/gm, '<h1>$1</h1>');
  formatted = formatted.replace(/\*\*(?!\*)(.*?)(?<!\*)\*\*/g, '<strong>$1</strong>');
  formatted = formatted.replace(/(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
  
  return formatted;
};

// Function to process streaming content and extract code blocks
const processStreamingContent = (content: string): string => {
  let processed = content;
  const blocks: CodeBlock[] = [];

  // Use the same language map as in formatMarkdown
  const languageMap: { [key: string]: string } = {
    'cuda': 'cpp',
    'c++': 'cpp',
    'js': 'javascript',
    'shell': 'bash',
    'sh': 'bash',
    'py': 'python'
  };

  // Look for complete code blocks in the streaming content
  processed = processed.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
    const id = generateId();
    const normalizedLang = lang ? (languageMap[lang.toLowerCase()] || lang.toLowerCase()) : '';
    
    let highlighted = code;
    if (['python', 'javascript', 'cpp', 'bash'].includes(normalizedLang)) {
      try {
        highlighted = hljs.highlight(code.trim(), { language: normalizedLang }).value;
      } catch (e) {
        console.warn('Highlight failed:', e);
      }
    }

    // Store the code block
    blocks.push({
      id,
      language: normalizedLang,
      code: code.trim(),
      highlighted,
      messageIndex: -1  // Special index for streaming message
    });

    // Return the HTML for the code block
    return `
      <div class="code-block ${normalizedLang}" id="${id}">
        <div class="code-block-header">
          <button class="copy-button" data-code-id="${id}">
            <span class="copy-icon">📋</span>
            <span class="copy-text">Copy</span>
          </button>
        </div>
        <pre><code>${highlighted}</code></pre>
      </div>
    `;
  });

  // Update streaming code blocks
  streamingCodeBlocks.value = blocks;
  return processed;
};

// Update appendToken to process code blocks
const appendToken = (token: string) => {
  streamingMessage.value += token;
  
  // Process the entire streaming message after each token
  // This ensures we catch complete code blocks as soon as they're fully received
  const processed = processStreamingContent(streamingMessage.value);
  
  // Find the last message (which should be the streaming one)
  const lastMessageEl = messagesContainer.value?.querySelector('.message:last-child .message-content');
  if (lastMessageEl) {
    lastMessageEl.innerHTML = processed;
  }
};

// Modify the copy click handler to check both regular and streaming code blocks
onMounted(() => {
  const handleCopyClick = async (event: Event) => {
    const button = (event.target as Element).closest('.copy-button') as HTMLButtonElement;
    if (!button) return;

    const codeId = button.getAttribute('data-code-id');
    if (!codeId) return;

    // Check both regular and streaming code blocks
    const codeBlock = codeBlocks.value.find(block => block.id === codeId) || 
                     streamingCodeBlocks.value.find(block => block.id === codeId);
    if (!codeBlock) return;

    console.log('🔵 Copy button clicked!');
    event.preventDefault();
    event.stopPropagation();
    
    try {
      await navigator.clipboard.writeText(codeBlock.code);
      console.log('✅ Copied to clipboard:', codeBlock.code.slice(0, 50) + '...');
      
      const copyText = button.querySelector('.copy-text');
      const originalText = copyText?.textContent || 'Copy';
      if (copyText) copyText.textContent = 'Copied!';
      button.classList.add('copied');
      
      setTimeout(() => {
        if (copyText) copyText.textContent = originalText;
        button.classList.remove('copied');
      }, 2000);
    } catch (err) {
      console.error('❌ Copy failed:', err);
      const copyText = button.querySelector('.copy-text');
      if (copyText) copyText.textContent = 'Failed';
      button.classList.add('error');
      
      setTimeout(() => {
        if (copyText) copyText.textContent = 'Copy';
        button.classList.remove('error');
      }, 2000);
    }
  };

  // Add event listener to the messages container for event delegation
  if (messagesContainer.value) {
    messagesContainer.value.addEventListener('click', (event) => {
      if ((event.target as Element).closest('.copy-button')) {
        handleCopyClick(event);
      }
    });
  }
});

// Clear streaming code blocks when streaming ends
const endStreaming = () => {
  console.log('Ending stream...');
  isStreaming.value = false;
  console.log('Streaming state set to:', isStreaming.value);
  streamingMessage.value = "";
  streamingCodeBlocks.value = [];  // Clear streaming code blocks
};

// Add TypeScript declaration for the window object
declare global {
  interface Window {
    handleCodeCopy: (event: Event) => Promise<void>;
  }
}

const newMessage = ref("");
const messagesContainer = ref<HTMLElement | null>(null);
const streamingMessage = ref("");
const isStreaming = ref(false);
const inputRef = ref<HTMLInputElement | null>(null);
const hoveredMessageIndex = ref<number | null>(null);
const editingMessageIndex = ref<number | null>(null);
const editingContent = ref("");
const editTextarea = ref<HTMLTextAreaElement | null>(null);

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

function handleStopStream() {
  console.log('Stop stream button clicked');
  console.log('Current streaming state:', isStreaming.value);
  emit('stop-stream');
}

function showEditButton(index: number) {
  hoveredMessageIndex.value = index;
}

function hideEditButton() {
  hoveredMessageIndex.value = null;
}

function startEditing(index: number) {
  editingMessageIndex.value = index;
  editingContent.value = props.messages[index].content;
  nextTick(() => {
    if (editTextarea.value) {
      editTextarea.value.focus();
    }
  });
}

function handleEditKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    if (editingMessageIndex.value !== null) {
      emit('edit-message', editingMessageIndex.value, editingContent.value);
      editingMessageIndex.value = null;
    }
  } else if (e.key === 'Escape') {
    editingMessageIndex.value = null;
  }
}

// Expose methods for parent component
defineExpose({
  startStreaming() {
    console.log('Starting stream...');
    isStreaming.value = true;
    console.log('Streaming state set to:', isStreaming.value);
    streamingMessage.value = "";
  },
  appendToken,
  endStreaming,
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

// Add a watcher for isStreaming
watch(isStreaming, (newValue) => {
  console.log('Streaming state changed to:', newValue);
});
</script>

<template>
  <div class="chat-window">
    <div class="messages" ref="messagesContainer">
      <div v-for="(message, index) in displayMessages" 
           :key="index" 
           :class="['message', message.role, { 'streaming': isStreaming && index === displayMessages.length - 1 }]"
           @mouseenter="message.role === 'user' ? showEditButton(index) : null"
           @mouseleave="hideEditButton">
        <div class="message-content">
          <template v-if="editingMessageIndex === index">
            <textarea 
              v-model="editingContent"
              @keydown="handleEditKeydown"
              ref="editTextarea"
              rows="4"
              class="edit-textarea"
            ></textarea>
          </template>
          <template v-else>
            <div v-html="formatMarkdown(message.content, index)"></div>
          </template>
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
        <button 
          type="button" 
          :class="['action-button', { 'stop-button': isStreaming }]"
          @click="isStreaming ? handleStopStream() : sendMessage()"
          :disabled="(!isStreaming && (!newMessage.trim() || isLoading))"
          @mouseenter="console.log('Button state:', { isStreaming: isStreaming, isDisabled: (!isStreaming && (!newMessage.trim() || isLoading)) })"
        >
          <span v-if="isStreaming" class="stop-icon"></span>
          <span v-else>⌘↵</span>
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
  line-height: 1.5;
  box-shadow: var(--shadow-sm);
  transition: all 0.2s ease;
  font-family: 'Fira Code', monospace;
  position: relative;
}

.message:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.message.user {
  background-color: var(--color-accent);
  color: white;
  align-self: flex-end;
  max-width: 80%;
}

.message.assistant {
  background-color: var(--color-bg-primary);
  color: var(--color-text-primary);
  align-self: stretch;
  width: 100%;
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
  color: #FF6B00; /* Bright orange color */
}

.message-content :deep(.code-block) {
  background-color: var(--color-bg-secondary) !important;
  border-radius: 8px !important;
  padding: 1.5rem !important;
  margin: 1rem 0 !important;
  overflow-x: auto !important;
  font-family: 'Fira Code', monospace !important;
  font-size: 0.9em !important;
  line-height: 1.6 !important;
  position: relative !important;
  white-space: pre !important;
  border: 1px solid var(--color-border) !important;
  transition: all 0.2s ease !important;
  width: 100% !important;
  box-sizing: border-box !important;
}

.message-content :deep(.code-block:hover) {
  border-color: var(--color-accent) !important;
  box-shadow: var(--shadow-sm) !important;
}

:deep(.code-block code) {
  display: block !important;
  white-space: pre !important;
  overflow-x: auto !important;
  font-size: 14px !important;
  padding: 0 !important;
  margin: 0 !important;
  width: 100% !important;
}

:deep(.code-block-header) {
  position: absolute !important;
  top: 0.75rem !important;
  right: 0.75rem !important;
  z-index: 2 !important;
  opacity: 0 !important;
  transition: opacity 0.2s ease !important;
}

:deep(.code-block:hover .code-block-header) {
  opacity: 1 !important;
}

:deep(.copy-button) {
  background: var(--color-bg-primary) !important;
  border: 1px solid var(--color-border) !important;
  border-radius: 6px !important;
  padding: 6px 12px !important;
  font-size: 12px !important;
  color: var(--color-text-secondary) !important;
  cursor: pointer !important;
  transition: all 0.2s ease !important;
  user-select: none !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  box-shadow: var(--shadow-sm) !important;
  font-family: system-ui, -apple-system, sans-serif !important;
  letter-spacing: 0.3px !important;
  min-width: 80px !important;
}

:deep(.copy-button:hover) {
  background: var(--color-accent) !important;
  color: white !important;
  border-color: var(--color-accent) !important;
  transform: translateY(-1px) !important;
  box-shadow: var(--shadow-md) !important;
}

:deep(.copy-button.copied) {
  background: var(--color-accent) !important;
  color: white !important;
  border-color: var(--color-accent) !important;
  transform: translateY(-1px) !important;
  box-shadow: var(--shadow-md) !important;
}

:deep(.copy-button.copied .copy-icon) {
  opacity: 0 !important;
  width: 0 !important;
  margin: 0 !important;
}

:deep(.copy-button.error) {
  background: var(--color-warning) !important;
  color: white !important;
  border-color: var(--color-warning) !important;
  transform: translateY(-1px) !important;
  box-shadow: var(--shadow-md) !important;
}

:deep(.copy-button.error .copy-icon) {
  opacity: 0 !important;
  width: 0 !important;
  margin: 0 !important;
}

:deep(.copy-button .copy-icon) {
  margin-right: 4px !important;
  font-size: 14px !important;
  transition: all 0.2s ease !important;
}

:deep(.copy-button .copy-text) {
  font-size: 12px !important;
  font-weight: 500 !important;
  transition: all 0.2s ease !important;
  white-space: nowrap !important;
}

/* Ensure code blocks don't show language indicators */
:deep(.code-block::before) {
  display: none !important;
}

.action-button {
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-size: 1rem;
  background: var(--color-accent);
  color: white;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
  min-width: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-button.stop-button {
  background-color: var(--color-warning);
  padding: 0.75rem;
}

.stop-icon {
  width: 16px;
  height: 16px;
  border: 2px solid white;
  border-radius: 50%;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stop-icon::after {
  content: '';
  width: 8px;
  height: 8px;
  background-color: white;
  border-radius: 1px;
}

.action-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.action-button:not(:disabled):hover {
  background: var(--color-accent-hover);
  transform: translateY(-1px);
}

.action-button.stop-button:not(:disabled):hover {
  background: var(--color-warning-hover);
}

.action-button:not(:disabled):active {
  transform: translateY(0);
}

.edit-button {
  position: absolute;
  top: -20px;
  right: 10px;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.message:hover .edit-button {
  opacity: 1;
}

.edit-button button {
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: 50%;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--color-text-primary);
  padding: 6px;
  transition: all 0.2s ease;
}

.edit-button button:hover {
  background: var(--color-bg-secondary);
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

.edit-textarea {
  width: 100%;
  min-height: 120px;
  padding: 12px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  font-family: inherit;
  font-size: inherit;
  line-height: 1.5;
  resize: vertical;
  margin: 8px 0;
  box-sizing: border-box;
}

.edit-textarea:focus {
  border-color: var(--color-accent);
  outline: none;
  box-shadow: 0 0 0 2px var(--color-accent-hover);
}
</style> 
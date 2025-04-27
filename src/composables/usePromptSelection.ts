import { ref, computed, watch, onMounted } from 'vue';
import type { CustomModel } from './useAddModels';

interface Prompt {
  id: string;
  name: string;
  content: string;
}

export function usePromptSelection(
  initialPrompts: Prompt[] = [],
  selectedModel: CustomModel | null = null,
  onSelect?: (prompt: Prompt) => void
) {
  const isPromptSelectorVisible = ref(false);
  const isAddingPrompt = ref(false);
  const selectedPromptIndex = ref(-1);
  const newPromptName = ref('');
  const newPromptContent = ref('');
  const prompts = ref<Prompt[]>(initialPrompts);
  const focusedField = ref<string | null>(null);

  // Load prompts from server
  async function loadPrompts() {
    console.log('Attempting to load prompts from server...');
    try {
      const response = await fetch('http://localhost:3000/prompts');
      console.log('Server response:', response.status, response.statusText);
      if (!response.ok) throw new Error(`Failed to load prompts: ${response.status} ${response.statusText}`);
      const data = await response.json();
      console.log('Loaded prompts:', data);
      prompts.value = data;
    } catch (error) {
      console.error('Error loading prompts:', error);
      // Initialize with empty array if loading fails
      prompts.value = [];
    }
  }

  // Save prompts to server
  async function savePrompts() {
    console.log('Attempting to save prompts:', prompts.value);
    try {
      const response = await fetch('http://localhost:3000/prompts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(prompts.value),
      });
      console.log('Save response:', response.status, response.statusText);
      if (!response.ok) throw new Error(`Failed to save prompts: ${response.status} ${response.statusText}`);
      console.log('Successfully saved prompts');
    } catch (error) {
      console.error('Error saving prompts:', error);
    }
  }

  // Delete prompt from server
  async function deletePromptFromServer(id: string) {
    console.log('\n🗑️ Attempting to delete prompt from server:', id);
    try {
      const url = `http://localhost:3000/prompts/${id}`;
      console.log('📤 Sending DELETE request to:', url);
      
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log('📥 Server response:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        url: response.url
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Server error response:', errorData);
        throw new Error(`Failed to delete prompt: ${errorData.error || response.statusText}`);
      }

      const result = await response.json().catch(() => ({ success: true }));
      console.log('✅ Server delete response:', result);
      return result;
      
    } catch (error) {
      console.error('❌ Error in deletePromptFromServer:', error);
      throw error;
    }
  }

  // Add activePrompt ref with default system message
  const activePrompt = computed(() => {
    if (selectedPromptIndex.value >= 0 && selectedPromptIndex.value < availablePrompts.value.length) {
      return availablePrompts.value[selectedPromptIndex.value];
    }
    return {
      id: 'default',
      name: 'Default System Message',
      content: selectedModel ? 
        `You are ${selectedModel.name}, a helpful AI assistant. Respond conversationally.` :
        'You are Grok 3, a helpful AI assistant. Respond conversationally.'
    };
  });

  // Sort prompts by name
  const availablePrompts = computed(() => 
    prompts.value.sort((a, b) => a.name.localeCompare(b.name))
  );

  // Watch for index changes and trigger selection
  watch(selectedPromptIndex, (newIndex) => {
    console.log('Prompt index changed:', newIndex);
    if (newIndex >= 0 && newIndex < availablePrompts.value.length) {
      const selectedPrompt = availablePrompts.value[newIndex];
      console.log('Selecting prompt:', selectedPrompt.name);
      onSelect?.(selectedPrompt);
    } else {
      // When no prompt is selected, use the default system message
      onSelect?.(activePrompt.value);
    }
  });

  // Watch for model changes to update default prompt
  watch(() => selectedModel, (newModel) => {
    if (selectedPromptIndex.value === -1) {
      onSelect?.(activePrompt.value);
    }
  }, { immediate: true });

  function togglePromptSelector() {
    isPromptSelectorVisible.value = !isPromptSelectorVisible.value;
    if (!isPromptSelectorVisible.value) {
      resetState();
    } else {
      selectedPromptIndex.value = -1;
    }
  }

  function resetState() {
    isAddingPrompt.value = false;
    if (!isPromptSelectorVisible.value) {
      // Keep the current selection
    }
    newPromptName.value = '';
    newPromptContent.value = '';
    focusedField.value = null;
  }

  function handleKeydown(event: KeyboardEvent) {
    // Only handle Command+P/Ctrl+P to open
    if (!isPromptSelectorVisible.value) {
      if ((event.metaKey || event.ctrlKey) && event.key === 'p') {
        event.preventDefault();
        togglePromptSelector();
      }
      return;
    }

    // Handle navigation when prompt selector is visible
    if (isAddingPrompt.value) {
      if (event.key === 'Escape') {
        event.preventDefault();
        resetState();
      }
      return;
    }

    switch (event.key) {
      case 'ArrowUp':
        event.preventDefault();
        selectedPromptIndex.value = Math.max(-1, selectedPromptIndex.value - 1);
        break;
      case 'ArrowDown':
        event.preventDefault();
        selectedPromptIndex.value = Math.min(availablePrompts.value.length - 1, selectedPromptIndex.value + 1);
        break;
      case 'Enter':
        event.preventDefault();
        if (selectedPromptIndex.value === -1) {
          isAddingPrompt.value = true;
        } else if (selectedPromptIndex.value >= 0) {
          isPromptSelectorVisible.value = false;
          resetState();
        }
        break;
      case 'Escape':
        event.preventDefault();
        isPromptSelectorVisible.value = false;
        resetState();
        break;
    }
  }

  async function createPrompt() {
    if (newPromptName.value && newPromptContent.value) {
      const newPrompt: Prompt = {
        id: Date.now().toString(),
        name: newPromptName.value,
        content: newPromptContent.value,
      };
      prompts.value.push(newPrompt);
      await savePrompts(); // Save to server
      resetState();
      isPromptSelectorVisible.value = false;
    }
  }

  async function deletePrompt(id: string) {
    console.log('\n🗑️ deletePrompt called with id:', id);
    if (!id) {
      console.error('❌ No prompt ID provided for deletion');
      return;
    }

    try {
      // First update local state
      console.log('📝 Current prompts:', prompts.value);
      const promptToDelete = prompts.value.find(p => p.id === id);
      
      if (!promptToDelete) {
        console.warn('⚠️ Prompt not found in local state:', id);
        return;
      }
      
      console.log('🎯 Found prompt to delete:', promptToDelete);
      
      // First delete from server
      console.log('📤 Calling deletePromptFromServer...');
      const deleteResult = await deletePromptFromServer(id);
      console.log('📥 Delete server response:', deleteResult);
      
      if (deleteResult.success) {
        // Then update local state
        const previousPrompts = [...prompts.value];
        prompts.value = prompts.value.filter(prompt => prompt.id !== id);
        console.log('✅ Updated local state. New prompts:', prompts.value);
        
        try {
          // Save updated prompts to server
          console.log('💾 Saving updated prompts to server...');
          await savePrompts();
          console.log('✅ Delete operation completed successfully');
        } catch (error) {
          console.error('❌ Failed to save updated prompts:', error);
          // Revert local state
          prompts.value = previousPrompts;
          throw error;
        }
      } else {
        throw new Error('Server delete operation failed');
      }
    } catch (error) {
      console.error('❌ Delete operation failed:', error);
      // Revert local state if server delete failed
      console.log('🔄 Reverting local state...');
      await loadPrompts();
      throw error; // Re-throw to notify caller
    }
  }

  // Load prompts on mount
  onMounted(() => {
    console.log('Component mounted, loading prompts...');
    loadPrompts();
  });

  return {
    isPromptSelectorVisible,
    isAddingPrompt,
    selectedPromptIndex,
    availablePrompts,
    newPromptName,
    newPromptContent,
    focusedField,
    activePrompt,
    togglePromptSelector,
    handleKeydown,
    createPrompt,
    deletePrompt,
    resetState,
  };
} 
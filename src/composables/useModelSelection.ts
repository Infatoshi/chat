import { ref, computed, watch, toRaw } from 'vue';
import type { Message } from '../types/Conversation';
import type { CustomModel } from './useAddModels';

export function useModelSelection(initialModels: CustomModel[], onDeleteModel?: (modelId: string) => Promise<void>) {
  console.log('useModelSelection initialized with models:', initialModels);
  
  const selectedModelIndex = ref(0);
  const isModelSelectorVisible = ref(false);
  const isDeleteMode = ref(false);
  const pendingModelSelection = ref<CustomModel | null>(null);
  const modelsList = ref<CustomModel[]>(Array.isArray(initialModels) ? initialModels : []);

  const availableModels = computed(() => {
    const models = modelsList.value;
    console.log('Computing available models:', models, 'Length:', models.length);
    return models;
  });

  const selectedModel = ref<CustomModel | null>(null);

  // Update models list and try to maintain selection
  function updateModels(newModels: CustomModel[]) {
    console.log('Updating models list:', newModels);
    const currentSelection = selectedModel.value;
    modelsList.value = Array.isArray(newModels) ? newModels : [];
    
    if (currentSelection && newModels.length > 0) {
      // Try to maintain current selection
      const index = newModels.findIndex(m => 
        toRaw(m).id === toRaw(currentSelection).id
      );
      if (index !== -1) {
        selectedModel.value = newModels[index];
        selectedModelIndex.value = index;
      } else {
        // Fallback to first model if current selection not found
        selectedModel.value = newModels[0];
        selectedModelIndex.value = 0;
      }
    } else if (newModels.length > 0) {
      // No current selection, select first model
      selectedModel.value = newModels[0];
      selectedModelIndex.value = 0;
    } else {
      // No models available
      selectedModel.value = null;
      selectedModelIndex.value = 0;
    }
  }

  // Watch for changes in initial models
  watch(() => initialModels, (newModels) => {
    console.log('Initial models changed:', newModels);
    updateModels(newModels);
  }, { immediate: true, deep: true });

  function handleKeydown(e: KeyboardEvent) {
    // Handle ⌘J to toggle model selector
    if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
      e.preventDefault();
      console.log('Toggling model selector visibility');
      isModelSelectorVisible.value = !isModelSelectorVisible.value;
      isDeleteMode.value = false; // Reset delete mode when toggling
      return;
    }

    // Handle ⌘D to toggle delete mode when selector is visible
    if ((e.metaKey || e.ctrlKey) && e.key === 'd' && isModelSelectorVisible.value) {
      e.preventDefault();
      console.log('Toggling delete mode');
      isDeleteMode.value = !isDeleteMode.value;
      return;
    }

    if (!isModelSelectorVisible.value) return;

    // Handle arrow keys
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedModelIndex.value = Math.max(0, selectedModelIndex.value - 1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedModelIndex.value = Math.min(availableModels.value.length - 1, selectedModelIndex.value + 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selectedModel = availableModels.value[selectedModelIndex.value];
      if (selectedModel) {
        if (isDeleteMode.value) {
          handleDeleteModel(selectedModel);
        } else {
          selectModel(selectedModel);
        }
      }
      isModelSelectorVisible.value = false;
      isDeleteMode.value = false;
    } else if (e.key === 'Escape') {
      e.preventDefault();
      isModelSelectorVisible.value = false;
      isDeleteMode.value = false;
    }
  }

  function selectModel(model: CustomModel) {
    console.log('Selecting model:', model);
    const rawModel = toRaw(model);
    console.log('Raw model for comparison:', rawModel);
    
    // Try exact match first
    let index = availableModels.value.findIndex(m => {
      const rawM = toRaw(m);
      console.log('Comparing models:', {
        current: { id: rawM.id, name: rawM.name },
        target: { id: rawModel.id, name: rawModel.name }
      });
      return rawM.id === rawModel.id && rawM.name === rawModel.name;
    });
    
    // Fallback to ID-only match if needed
    if (index === -1) {
      console.log('Exact match not found, trying ID-only match');
      index = availableModels.value.findIndex(m => toRaw(m).id === rawModel.id);
    }
    
    console.log('Found model at index:', index);
    if (index !== -1) {
      selectedModelIndex.value = index;
      selectedModel.value = availableModels.value[index];
      console.log('Model selection complete:', selectedModel.value);
    } else {
      console.error('Model selection failed:', {
        attempted: rawModel,
        available: availableModels.value.map(m => toRaw(m))
      });
    }
  }

  async function handleDeleteModel(model: CustomModel) {
    console.log('Attempting to delete model:', model);
    try {
      if (onDeleteModel) {
        await onDeleteModel(model.id);
        console.log('Model deleted successfully');
      }
    } catch (error) {
      console.error('Failed to delete model:', error);
    }
  }

  function getSystemMessage(): Message {
    if (!selectedModel.value) {
      return {
        role: "system",
        content: "No model selected"
      };
    }
    return {
      role: "system",
      content: `You are ${selectedModel.value.name}, a helpful AI assistant. Respond conversationally.`
    };
  }

  function getModelDisplayName(modelId: string): string {
    const model = availableModels.value.find(m => toRaw(m).id === modelId);
    return model ? model.name : modelId;
  }

  return {
    selectedModel,
    isModelSelectorVisible,
    isDeleteMode,
    selectedModelIndex,
    availableModels,
    handleKeydown,
    getSystemMessage,
    getModelDisplayName,
    selectModel,
    updateModels,
    handleDeleteModel
  };
} 
import { ref, onMounted } from 'vue';

const API_BASE = 'http://localhost:3000';

console.log('useAddModels.ts is being imported!'); // Debug module import

export interface CustomModel {
  name: string;
  id: string;
}

// Convert models.json format to CustomModel array
function parseModelsFile(content: Record<string, string>): CustomModel[] {
  try {
    const models = Object.entries(content).map(([name, id]) => ({
      name,
      id
    }));
    console.log('Converted to CustomModel array:', models);
    return models;
  } catch (error) {
    console.error('Failed to parse models:', error);
    return [];
  }
}

// Convert CustomModel array to models.json format
function stringifyModels(models: CustomModel[]): Record<string, string> {
  return models.reduce((acc, model) => {
    acc[model.name] = model.id;
    return acc;
  }, {} as Record<string, string>);
}

export function useAddModels(onModelAdded?: (model: CustomModel) => void) {
  console.log('useAddModels function is being called!');
  
  const isAddModelVisible = ref(false);
  const customModels = ref<CustomModel[]>([]);
  const newModelName = ref('');
  const newModelId = ref('');
  const isLoading = ref(true);

  // Load existing models on initialization
  onMounted(() => {
    console.log('onMounted hook is running!');
    loadModels();
  });

  async function loadModels() {
    console.log('Starting to load models...');
    try {
      const response = await fetch(`${API_BASE}/models`);
      if (!response.ok) throw new Error('Failed to fetch models');
      const content = await response.json();
      console.log('Fetched content:', content);
      
      const models = parseModelsFile(content);
      console.log('Final loaded models:', models);
      
      customModels.value = models;
      console.log('Models set in ref:', customModels.value);
    } catch (error) {
      console.error('Failed to load models:', error);
      // If request fails, use default models
      const defaultModels = [
        { name: "Grok 3", id: "x-ai/grok-3-beta" },
        { name: "DeepSeek R1", id: "deepseek/deepseek-r1" },
        { name: "Claude 3 Opus", id: "anthropic/claude-3-opus" },
        { name: "GPT-4 Turbo", id: "openai/gpt-4-turbo-preview" },
        { name: "Mixtral 8x7B", id: "mistral/mixtral-8x7b" }
      ];
      customModels.value = defaultModels;
      
      // Try to save default models
      try {
        await fetch(`${API_BASE}/models`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(stringifyModels(defaultModels)),
        });
      } catch (saveError) {
        console.error('Failed to save default models:', saveError);
      }
    } finally {
      isLoading.value = false;
    }
  }

  function showAddModel() {
    isAddModelVisible.value = true;
    newModelName.value = '';
    newModelId.value = '';
  }

  function hideAddModel() {
    isAddModelVisible.value = false;
  }

  async function addModel() {
    if (newModelName.value.trim() && newModelId.value.trim()) {
      const newModel = {
        name: newModelName.value.trim(),
        id: newModelId.value.trim()
      };
      
      customModels.value.push(newModel);
      
      // Persist to models.json
      try {
        const response = await fetch(`${API_BASE}/models`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(stringifyModels(customModels.value)),
        });
        
        if (!response.ok) {
          throw new Error('Failed to save models');
        }
      } catch (error) {
        console.error('Failed to save to models.json:', error);
        // Remove the model if save failed
        customModels.value = customModels.value.filter(m => m !== newModel);
        return false;
      }

      hideAddModel();
      onModelAdded?.(newModel);
      return true;
    }
    return false;
  }

  async function removeModel(modelId: string) {
    const previousModels = [...customModels.value];
    customModels.value = customModels.value.filter(model => model.id !== modelId);
    
    // Delete model using DELETE endpoint
    try {
      const response = await fetch(`${API_BASE}/models/${modelId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete model');
      }
    } catch (error) {
      console.error('Failed to delete model:', error);
      // Restore previous state if delete failed
      customModels.value = previousModels;
      throw error; // Propagate error to caller
    }
  }

  return {
    isAddModelVisible,
    customModels,
    newModelName,
    newModelId,
    showAddModel,
    hideAddModel,
    addModel,
    removeModel,
    isLoading
  };
} 
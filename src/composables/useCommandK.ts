import { ref } from 'vue';
import type { CustomModel } from './useAddModels';

// Available commands
const availableCommands = [
  "Clear Chat",
  "Export Chat",
  "Add Model",
  "Delete Model",
  "Settings"
] as const;

type AvailableCommand = typeof availableCommands[number];

export function useCommandK(
  onModelSelect?: (model: CustomModel) => void,
  onDeleteModelCommand?: () => void
) {
  const isCommandMenuVisible = ref(false);
  const selectedCommandIndex = ref(0);

  // Function to handle keyboard shortcuts
  function handleKeydown(event: KeyboardEvent, onCommandSelect?: (command: AvailableCommand) => void) {
    // Command+K (or Ctrl+K) to toggle command menu
    if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
      event.preventDefault();
      isCommandMenuVisible.value = !isCommandMenuVisible.value;
      return;
    }

    // Only handle keys if command menu is visible
    if (!isCommandMenuVisible.value) return;

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      selectedCommandIndex.value = (selectedCommandIndex.value - 1 + availableCommands.length) % availableCommands.length;
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      selectedCommandIndex.value = (selectedCommandIndex.value + 1) % availableCommands.length;
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const selectedCommand = availableCommands[selectedCommandIndex.value];
      isCommandMenuVisible.value = false;
      if (selectedCommand === "Delete Model" && onDeleteModelCommand) {
        onDeleteModelCommand();
      } else {
        onCommandSelect?.(selectedCommand);
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      isCommandMenuVisible.value = false;
    }
  }

  function handleModelAdded(model: CustomModel) {
    onModelSelect?.(model);
  }

  return {
    isCommandMenuVisible,
    selectedCommandIndex,
    availableCommands,
    handleKeydown,
    handleModelAdded
  };
} 
<script setup lang="ts">
import { ref, onErrorCaptured } from 'vue';
import ErrorLogger from '../utils/errorLogger';

const props = defineProps<{
  componentName: string;
}>();

const error = ref<Error | null>(null);

onErrorCaptured((err: Error, component, info) => {
  error.value = err;
  ErrorLogger.logError(err, props.componentName, { componentInfo: info });
  return false; // Prevent error from propagating
});
</script>

<template>
  <div v-if="error" class="error-boundary">
    <div class="error-content">
      <h3>Something went wrong</h3>
      <p>{{ error.message }}</p>
      <button @click="error = null">Try Again</button>
    </div>
  </div>
  <slot v-else></slot>
</template>

<style scoped>
.error-boundary {
  padding: 2rem;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-accent);
  border-radius: 8px;
  margin: 1rem;
}

.error-content {
  text-align: center;
}

.error-content h3 {
  color: var(--color-accent);
  margin-bottom: 1rem;
}

button {
  background: var(--color-accent);
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
  margin-top: 1rem;
}

button:hover {
  background: var(--color-accent-hover);
}
</style> 
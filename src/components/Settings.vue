<template>
  <div v-if="isOpen" class="settings-container" @keydown="handleKeydown" tabindex="-1" ref="containerRef">
    <div class="settings-backdrop" @click="onClose" />
    <div class="settings-overlay">
      <div class="settings-content">
        <h3>Settings (Press Esc or Enter to close)</h3>
        
        <div class="settings-section">
          <h4>Appearance</h4>
          <div class="settings-controls">
            <div class="setting-item" :class="{ 'is-focused': focusedSetting === 'fontSize' }">
              <label>Font Size ({{ settings.fontSize }}px)</label>
              <input
                type="range"
                min="10"
                max="24"
                step="1"
                :value="settings.fontSize"
                @input="handleFontSizeChange"
                @focus="focusedSetting = 'fontSize'"
                @blur="focusedSetting = null"
                ref="fontSizeInputRef"
              />
            </div>

            <div class="setting-item" :class="{ 'is-focused': focusedSetting === 'darkMode' }">
              <label>Theme Mode ({{ isDark ? 'Dark' : 'Light' }})</label>
              <input
                type="range"
                min="0"
                max="1"
                step="1"
                :value="isDark ? 1 : 0"
                @input="handleDarkModeChange"
                @focus="focusedSetting = 'darkMode'"
                @blur="focusedSetting = null"
                ref="darkModeInputRef"
                class="theme-toggle"
              />
              <div class="setting-description">
                Switch between light and dark themes.
              </div>
            </div>
          </div>
        </div>

        <div class="settings-section">
          <h4>Model Settings</h4>
          <div class="settings-controls">
            <div class="setting-item" :class="{ 'is-focused': focusedSetting === 'temperature' }">
              <label>Temperature ({{ settings.temperature.toFixed(2) }})</label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.05"
                :value="settings.temperature"
                @input="handleTemperatureChange"
                @focus="focusedSetting = 'temperature'"
                @blur="focusedSetting = null"
                ref="temperatureInputRef"
              />
              <div class="setting-description">
                Lower values make responses more focused and deterministic, higher values make them more creative and varied.
              </div>
            </div>

            <div class="setting-item" :class="{ 'is-focused': focusedSetting === 'maxTokens' }">
              <label>Max Tokens ({{ settings.maxTokens.toLocaleString() }})</label>
              <input
                type="range"
                :min="1024"
                :max="8192"
                :step="1024"
                :value="settings.maxTokens"
                @input="handleMaxTokensChange"
                @focus="focusedSetting = 'maxTokens'"
                @blur="focusedSetting = null"
                ref="maxTokensInputRef"
              />
              <div class="setting-description">
                Maximum number of tokens the model can generate in a response.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick, watch } from 'vue'
import { useDarkMode } from '../composables/useDarkMode'

const props = defineProps({
  isOpen: {
    type: Boolean,
    required: true
  }
})

const emit = defineEmits(['close', 'settingsChange'])

const { isDark, toggleDarkMode } = useDarkMode()

const settings = ref({
  fontSize: 14,
  temperature: 0.7,
  maxTokens: 4096
})

const containerRef = ref(null)
const fontSizeInputRef = ref(null)
const darkModeInputRef = ref(null)
const temperatureInputRef = ref(null)
const maxTokensInputRef = ref(null)
const focusedSetting = ref(null)

// Watch for isOpen changes to manage focus
watch(() => props.isOpen, async (newValue) => {
  if (newValue) {
    await nextTick()
    containerRef.value?.focus()
    fontSizeInputRef.value?.focus()
  }
})

const handleKeydown = (e) => {
  const activeElement = document.activeElement
  
  // Handle Escape and Enter keys
  if (e.key === 'Escape' || e.key === 'Enter') {
    e.preventDefault()
    onClose()
    return
  }

  // Handle vertical navigation between settings
  if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
    e.preventDefault()
    
    if (e.key === 'ArrowUp') {
      if (activeElement === maxTokensInputRef.value) {
        temperatureInputRef.value?.focus()
        return
      } else if (activeElement === temperatureInputRef.value) {
        darkModeInputRef.value?.focus()
        return
      } else if (activeElement === darkModeInputRef.value) {
        fontSizeInputRef.value?.focus()
        return
      }
    } else if (e.key === 'ArrowDown') {
      if (activeElement === fontSizeInputRef.value) {
        darkModeInputRef.value?.focus()
        return
      } else if (activeElement === darkModeInputRef.value) {
        temperatureInputRef.value?.focus()
        return
      } else if (activeElement === temperatureInputRef.value) {
        maxTokensInputRef.value?.focus()
        return
      }
    }
  }

  // Handle horizontal slider adjustments
  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    e.preventDefault()
    
    if (!activeElement?.type === 'range') return
    
    const step = parseFloat(activeElement.step) || 1
    const min = parseFloat(activeElement.min)
    const max = parseFloat(activeElement.max)
    const currentValue = parseFloat(activeElement.value)
    
    let newValue
    if (e.key === 'ArrowRight') {
      newValue = Math.min(currentValue + step, max)
    } else {
      newValue = Math.max(currentValue - step, min)
    }
    
    if (activeElement === fontSizeInputRef.value) {
      handleFontSizeChange({ target: { value: newValue } })
    } else if (activeElement === darkModeInputRef.value) {
      handleDarkModeChange({ target: { value: newValue } })
    } else if (activeElement === temperatureInputRef.value) {
      handleTemperatureChange({ target: { value: newValue } })
    } else if (activeElement === maxTokensInputRef.value) {
      handleMaxTokensChange({ target: { value: newValue } })
    }
  }
}

onMounted(() => {
  console.log('Settings component mounted')
  loadSettings()
})

const loadSettings = async () => {
  try {
    console.log('Loading settings from server')
    const response = await fetch('http://localhost:3000/appearance')
    const data = await response.json()
    console.log('Loaded settings:', data)
    settings.value = {
      ...settings.value,
      ...data
    }
  } catch (error) {
    console.error('Failed to load settings:', error)
  }
}

const handleFontSizeChange = (e) => {
  console.log('Font size change:', e.target.value)
  const value = parseInt(e.target.value)
  settings.value.fontSize = value
  saveSettings()
  document.documentElement.style.setProperty('--app-font-size', `${value}px`)
}

const handleTemperatureChange = (e) => {
  console.log('Temperature change:', e.target.value)
  const value = parseFloat(e.target.value)
  settings.value.temperature = value
  saveSettings()
  emit('settingsChange', settings.value)
}

const handleMaxTokensChange = (e) => {
  console.log('Max tokens change:', e.target.value)
  const value = parseInt(e.target.value)
  settings.value.maxTokens = value
  saveSettings()
  emit('settingsChange', settings.value)
}

const handleDarkModeChange = (e) => {
  console.log('Dark mode change:', e.target.value)
  const value = parseInt(e.target.value)
  toggleDarkMode()
}

const saveSettings = async () => {
  try {
    console.log('Saving settings:', settings.value)
    await fetch('http://localhost:3000/appearance', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(settings.value),
    })
    console.log('Settings saved successfully')
  } catch (error) {
    console.error('Failed to save settings:', error)
  }
}

const onClose = () => {
  emit('close')
}
</script>

<style scoped>
.settings-container {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.settings-backdrop {
  position: fixed;
  inset: 0;
  background: var(--color-overlay);
}

.settings-overlay {
  position: relative;
  background: var(--color-bg-primary);
  padding: 1rem;
  border-radius: 8px;
  box-shadow: var(--shadow-lg);
  border: 1px solid var(--color-border);
  min-width: 400px;
}

.settings-content h3 {
  margin: 0 0 1rem 0;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--color-border);
  color: var(--color-text-primary);
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
}

.settings-section {
  margin-bottom: 1rem;
}

.settings-section h4 {
  color: var(--color-text-primary);
  font-size: 0.9rem;
  margin-bottom: 1rem;
}

.settings-controls {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.setting-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.setting-item label {
  color: var(--color-text-primary);
  font-size: 0.9rem;
}

.setting-item input[type="range"] {
  width: 100%;
  height: 4px;
  background: var(--color-bg-secondary);
  border-radius: 2px;
  outline: none;
  -webkit-appearance: none;
}

.setting-item input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  background: var(--color-accent);
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.2s ease;
}

.setting-item input[type="range"]::-webkit-slider-thumb:hover {
  transform: scale(1.1);
}

.setting-item.is-focused {
  background: var(--color-bg-hover);
  padding: 0.75rem;
  margin: -0.75rem;
  border-radius: 6px;
}

.setting-item input[type="range"]:focus {
  outline: none;
}

.setting-item input[type="range"]:focus::-webkit-slider-thumb {
  box-shadow: 0 0 0 2px var(--color-accent-hover);
  transform: scale(1.1);
}

.settings-container:focus {
  outline: none;
}

.setting-description {
  font-size: 0.8rem;
  color: var(--color-text-tertiary);
  margin-top: 0.25rem;
  line-height: 1.4;
}

.theme-toggle {
  height: 24px !important;
  border-radius: 12px !important;
  background: var(--color-bg-secondary) !important;
  border: 1px solid var(--color-border) !important;
  cursor: pointer;
}

.theme-toggle::-webkit-slider-thumb {
  width: 22px !important;
  height: 22px !important;
  border: 1px solid var(--color-border) !important;
  background: var(--color-accent) !important;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1) !important;
}

.theme-toggle::-webkit-slider-thumb:hover {
  transform: scale(1.1) !important;
}

.theme-toggle:focus::-webkit-slider-thumb {
  box-shadow: 0 0 0 2px var(--color-accent-hover) !important;
}
</style> 
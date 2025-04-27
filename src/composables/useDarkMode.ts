import { ref, watch, onMounted } from 'vue';

export function useDarkMode() {
  const isDark = ref(true); // Default to dark mode

  // Function to toggle dark mode
  function toggleDarkMode() {
    isDark.value = !isDark.value;
    updateTheme();
  }

  // Function to update theme
  function updateTheme() {
    if (isDark.value) {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
      document.documentElement.classList.remove('dark');
    }
  }

  // Initialize theme
  onMounted(() => {
    updateTheme();
  });

  return {
    isDark,
    toggleDarkMode
  };
} 
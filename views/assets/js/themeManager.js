/**
 * Theme Manager
 * Handles theme switching between light and dark modes
 * Synchronizes Bootstrap theme and ACE editor themes
 */

const THEME_STORAGE_KEY = 'postman-toolbox-theme';
const THEMES = {
  LIGHT: 'light',
  DARK: 'dark'
};

const ACE_THEMES = {
  light: 'ace/theme/github',
  dark: 'ace/theme/monokai'
};

/**
 * Get current theme from localStorage or default to light
 * @returns {string} Current theme ('light' or 'dark')
 */
function getCurrentTheme() {
  return localStorage.getItem(THEME_STORAGE_KEY) || THEMES.LIGHT;
}

/**
 * Set theme and persist to localStorage
 * @param {string} theme - Theme to set ('light' or 'dark')
 */
function setTheme(theme) {
  if (theme !== THEMES.LIGHT && theme !== THEMES.DARK) {
    console.warn(`Invalid theme: ${theme}. Defaulting to light.`);
    theme = THEMES.LIGHT;
  }

  // Update HTML data attribute for Bootstrap
  document.documentElement.setAttribute('data-bs-theme', theme);

  // Persist to localStorage
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch (e) {
    console.error('Failed to save theme preference:', e);
  }

  // Update ACE editors if they exist
  updateEditorThemes(theme);

  // Update theme toggle button if it exists
  updateThemeToggleButton(theme);

  // Dispatch custom event for other components to react to theme change
  window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme } }));
}

/**
 * Toggle between light and dark themes
 */
function toggleTheme() {
  const currentTheme = getCurrentTheme();
  const newTheme = currentTheme === THEMES.LIGHT ? THEMES.DARK : THEMES.LIGHT;
  setTheme(newTheme);
}

/**
 * Update ACE editor themes to match current app theme
 * @param {string} theme - Theme to apply to editors
 */
function updateEditorThemes(theme) {
  // Check if ACE editors exist (on Governance Playground and Test Composer pages)
  if (typeof window.editors !== 'undefined' && Array.isArray(window.editors)) {
    const aceTheme = ACE_THEMES[theme] || ACE_THEMES.light;
    window.editors.forEach(editor => {
      try {
        editor.setTheme(aceTheme);
      } catch (e) {
        console.error('Failed to set editor theme:', e);
      }
    });
  }

  // Also update standalone editors (like on test composer page)
  if (typeof window.jsonEditor !== 'undefined') {
    try {
      const aceTheme = ACE_THEMES[theme] || ACE_THEMES.light;
      window.jsonEditor.setTheme(aceTheme);
    } catch (e) {
      console.error('Failed to set jsonEditor theme:', e);
    }
  }

  if (typeof window.testJSEditor !== 'undefined') {
    try {
      const aceTheme = ACE_THEMES[theme] || ACE_THEMES.light;
      window.testJSEditor.setTheme(aceTheme);
    } catch (e) {
      console.error('Failed to set testJSEditor theme:', e);
    }
  }
}

/**
 * Update theme toggle button appearance
 * @param {string} theme - Current theme
 */
function updateThemeToggleButton(theme) {
  const toggleButton = document.getElementById('themeToggle');
  if (!toggleButton) return;

  const icon = toggleButton.querySelector('.theme-icon');
  if (!icon) return;

  if (theme === THEMES.DARK) {
    // Show sun icon (switch to light)
    icon.innerHTML = '☀️';
    toggleButton.setAttribute('aria-label', 'Switch to light mode');
    toggleButton.setAttribute('title', 'Switch to light mode');
  } else {
    // Show moon icon (switch to dark)
    icon.innerHTML = '🌙';
    toggleButton.setAttribute('aria-label', 'Switch to dark mode');
    toggleButton.setAttribute('title', 'Switch to dark mode');
  }
}

/**
 * Initialize theme manager on page load
 */
function initThemeManager() {
  // Set initial theme (already applied by inline script, but update editors)
  const currentTheme = getCurrentTheme();
  updateEditorThemes(currentTheme);
  updateThemeToggleButton(currentTheme);

  // Add click handler to theme toggle button
  const toggleButton = document.getElementById('themeToggle');
  if (toggleButton) {
    toggleButton.addEventListener('click', toggleTheme);
  }

  // Listen for editor initialization and update their themes
  window.addEventListener('editorsInitialized', () => {
    const currentTheme = getCurrentTheme();
    updateEditorThemes(currentTheme);
  });

  console.log(`Theme Manager initialized. Current theme: ${currentTheme}`);
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initThemeManager);
} else {
  // DOM already loaded
  initThemeManager();
}

// Export for use in other scripts
window.ThemeManager = {
  getCurrentTheme,
  setTheme,
  toggleTheme,
  THEMES
};

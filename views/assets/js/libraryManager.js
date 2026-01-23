/**
 * Library Manager
 * Handles saving, loading, and managing Spectral rules and custom functions
 * in browser localStorage
 */

const RULES_STORAGE_KEY = 'spectral_rules_library';
const FUNCTIONS_STORAGE_KEY = 'spectral_functions_library';
const LIBRARY_TYPES = {
  RULE: 'rule',
  FUNCTION: 'function'
};

/**
 * Generate a unique ID for library items
 * @returns {string} Unique ID
 */
function generateId() {
  // Use crypto.randomUUID if available, otherwise fallback
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback: timestamp + random string
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get all items from localStorage
 * @param {string} type - 'rule' or 'function'
 * @returns {Array} Array of library items
 */
function getItems(type) {
  try {
    const key = type === LIBRARY_TYPES.RULE ? RULES_STORAGE_KEY : FUNCTIONS_STORAGE_KEY;
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error(`Error reading ${type} library:`, error);
    return [];
  }
}

/**
 * Save items to localStorage
 * @param {string} type - 'rule' or 'function'
 * @param {Array} items - Array of library items
 * @returns {boolean} Success status
 */
function saveItems(type, items) {
  try {
    const key = type === LIBRARY_TYPES.RULE ? RULES_STORAGE_KEY : FUNCTIONS_STORAGE_KEY;
    localStorage.setItem(key, JSON.stringify(items));
    return true;
  } catch (error) {
    if (error.name === 'QuotaExceededError') {
      console.error('localStorage quota exceeded');
      alert('Storage quota exceeded. Please delete some items to free up space.');
    } else {
      console.error(`Error saving ${type} library:`, error);
    }
    return false;
  }
}

/**
 * Get sorted list of items (alphabetically by name)
 * @param {string} type - 'rule' or 'function'
 * @returns {Array} Sorted array of library items
 */
function getItemsList(type) {
  const items = getItems(type);
  return items.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Validate that name is unique and not empty
 * @param {string} name - Item name to validate
 * @param {string} type - 'rule' or 'function'
 * @param {string} excludeId - ID to exclude from duplicate check (for editing)
 * @returns {Object} { valid: boolean, error: string }
 */
function validateName(name, type, excludeId = null) {
  if (!name || name.trim() === '') {
    return { valid: false, error: 'Name cannot be empty.' };
  }

  const trimmedName = name.trim();
  if (trimmedName.length > 50) {
    return { valid: false, error: 'Name must be 50 characters or less.' };
  }

  const items = getItems(type);
  const duplicate = items.find(item =>
    item.name === trimmedName && item.id !== excludeId
  );

  if (duplicate) {
    return { valid: false, error: 'A library item with this name already exists.' };
  }

  return { valid: true, error: null };
}

/**
 * Save a new rule to the library
 * @param {string} name - Rule name
 * @param {string} content - Rule content (YAML)
 * @returns {Object} { success: boolean, item: Object, error: string }
 */
function saveRule(name, content) {
  const validation = validateName(name, LIBRARY_TYPES.RULE);
  if (!validation.valid) {
    return { success: false, item: null, error: validation.error };
  }

  if (!content || content.trim() === '') {
    return { success: false, item: null, error: 'Rule content cannot be empty.' };
  }

  const items = getItems(LIBRARY_TYPES.RULE);
  const newItem = {
    id: generateId(),
    name: name.trim(),
    content: content,
    timestamp: Date.now(),
    createdAt: new Date().toISOString()
  };

  items.push(newItem);
  const saved = saveItems(LIBRARY_TYPES.RULE, items);

  if (saved) {
    dispatchLibraryEvent('itemAdded', { type: LIBRARY_TYPES.RULE, item: newItem });
    return { success: true, item: newItem, error: null };
  } else {
    return { success: false, item: null, error: 'Failed to save rule to storage.' };
  }
}

/**
 * Save a new function to the library
 * @param {string} name - Function name
 * @param {string} content - Function content (JavaScript)
 * @returns {Object} { success: boolean, item: Object, error: string }
 */
function saveFunction(name, content) {
  const validation = validateName(name, LIBRARY_TYPES.FUNCTION);
  if (!validation.valid) {
    return { success: false, item: null, error: validation.error };
  }

  if (!content || content.trim() === '') {
    return { success: false, item: null, error: 'Function content cannot be empty.' };
  }

  const items = getItems(LIBRARY_TYPES.FUNCTION);
  const newItem = {
    id: generateId(),
    name: name.trim(),
    content: content,
    timestamp: Date.now(),
    createdAt: new Date().toISOString()
  };

  items.push(newItem);
  const saved = saveItems(LIBRARY_TYPES.FUNCTION, items);

  if (saved) {
    dispatchLibraryEvent('itemAdded', { type: LIBRARY_TYPES.FUNCTION, item: newItem });
    return { success: true, item: newItem, error: null };
  } else {
    return { success: false, item: null, error: 'Failed to save function to storage.' };
  }
}

/**
 * Load a rule by ID
 * @param {string} id - Rule ID
 * @returns {Object|null} Rule object or null if not found
 */
function loadRule(id) {
  const items = getItems(LIBRARY_TYPES.RULE);
  return items.find(item => item.id === id) || null;
}

/**
 * Load a function by ID
 * @param {string} id - Function ID
 * @returns {Object|null} Function object or null if not found
 */
function loadFunction(id) {
  const items = getItems(LIBRARY_TYPES.FUNCTION);
  return items.find(item => item.id === id) || null;
}

/**
 * Delete a rule by ID
 * @param {string} id - Rule ID
 * @returns {boolean} Success status
 */
function deleteRule(id) {
  const items = getItems(LIBRARY_TYPES.RULE);
  const filteredItems = items.filter(item => item.id !== id);

  if (filteredItems.length === items.length) {
    // Item wasn't found
    return false;
  }

  const saved = saveItems(LIBRARY_TYPES.RULE, filteredItems);
  if (saved) {
    dispatchLibraryEvent('itemDeleted', { type: LIBRARY_TYPES.RULE, id });
  }
  return saved;
}

/**
 * Delete a function by ID
 * @param {string} id - Function ID
 * @returns {boolean} Success status
 */
function deleteFunction(id) {
  const items = getItems(LIBRARY_TYPES.FUNCTION);
  const filteredItems = items.filter(item => item.id !== id);

  if (filteredItems.length === items.length) {
    // Item wasn't found
    return false;
  }

  const saved = saveItems(LIBRARY_TYPES.FUNCTION, filteredItems);
  if (saved) {
    dispatchLibraryEvent('itemDeleted', { type: LIBRARY_TYPES.FUNCTION, id });
  }
  return saved;
}

/**
 * Update a rule
 * @param {string} id - Rule ID
 * @param {string} name - New name
 * @param {string} content - New content
 * @returns {Object} { success: boolean, item: Object, error: string }
 */
function updateRule(id, name, content) {
  const validation = validateName(name, LIBRARY_TYPES.RULE, id);
  if (!validation.valid) {
    return { success: false, item: null, error: validation.error };
  }

  if (!content || content.trim() === '') {
    return { success: false, item: null, error: 'Rule content cannot be empty.' };
  }

  const items = getItems(LIBRARY_TYPES.RULE);
  const itemIndex = items.findIndex(item => item.id === id);

  if (itemIndex === -1) {
    return { success: false, item: null, error: 'Rule not found.' };
  }

  const updatedItem = {
    ...items[itemIndex],
    name: name.trim(),
    content: content,
    timestamp: Date.now()
  };

  items[itemIndex] = updatedItem;
  const saved = saveItems(LIBRARY_TYPES.RULE, items);

  if (saved) {
    dispatchLibraryEvent('itemUpdated', { type: LIBRARY_TYPES.RULE, item: updatedItem });
    return { success: true, item: updatedItem, error: null };
  } else {
    return { success: false, item: null, error: 'Failed to update rule.' };
  }
}

/**
 * Update a function
 * @param {string} id - Function ID
 * @param {string} name - New name
 * @param {string} content - New content
 * @returns {Object} { success: boolean, item: Object, error: string }
 */
function updateFunction(id, name, content) {
  const validation = validateName(name, LIBRARY_TYPES.FUNCTION, id);
  if (!validation.valid) {
    return { success: false, item: null, error: validation.error };
  }

  if (!content || content.trim() === '') {
    return { success: false, item: null, error: 'Function content cannot be empty.' };
  }

  const items = getItems(LIBRARY_TYPES.FUNCTION);
  const itemIndex = items.findIndex(item => item.id === id);

  if (itemIndex === -1) {
    return { success: false, item: null, error: 'Function not found.' };
  }

  const updatedItem = {
    ...items[itemIndex],
    name: name.trim(),
    content: content,
    timestamp: Date.now()
  };

  items[itemIndex] = updatedItem;
  const saved = saveItems(LIBRARY_TYPES.FUNCTION, items);

  if (saved) {
    dispatchLibraryEvent('itemUpdated', { type: LIBRARY_TYPES.FUNCTION, item: updatedItem });
    return { success: true, item: updatedItem, error: null };
  } else {
    return { success: false, item: null, error: 'Failed to update function.' };
  }
}

/**
 * Clear all items of a specific type
 * @param {string} type - 'rule' or 'function'
 * @returns {boolean} Success status
 */
function clearLibrary(type) {
  const saved = saveItems(type, []);
  if (saved) {
    dispatchLibraryEvent('libraryCleared', { type });
  }
  return saved;
}

/**
 * Get library statistics
 * @returns {Object} Statistics object
 */
function getStatistics() {
  const rules = getItems(LIBRARY_TYPES.RULE);
  const functions = getItems(LIBRARY_TYPES.FUNCTION);

  return {
    totalRules: rules.length,
    totalFunctions: functions.length,
    totalItems: rules.length + functions.length,
    storageUsed: getStorageUsage()
  };
}

/**
 * Get approximate storage usage
 * @returns {Object} Storage usage information
 */
function getStorageUsage() {
  try {
    const rulesData = localStorage.getItem(RULES_STORAGE_KEY) || '';
    const functionsData = localStorage.getItem(FUNCTIONS_STORAGE_KEY) || '';
    const totalBytes = (rulesData.length + functionsData.length) * 2; // Rough estimate (UTF-16)
    const totalKB = (totalBytes / 1024).toFixed(2);

    return {
      bytes: totalBytes,
      kb: totalKB,
      readable: totalKB < 1024 ? `${totalKB} KB` : `${(totalKB / 1024).toFixed(2)} MB`
    };
  } catch (error) {
    console.error('Error calculating storage usage:', error);
    return { bytes: 0, kb: '0', readable: '0 KB' };
  }
}

/**
 * Dispatch custom library events for other components to listen to
 * @param {string} eventName - Event name
 * @param {Object} detail - Event detail
 */
function dispatchLibraryEvent(eventName, detail) {
  window.dispatchEvent(new CustomEvent(eventName, { detail }));
}

/**
 * Export library data as JSON
 * @returns {Object} Complete library export
 */
function exportLibrary() {
  return {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    rules: getItems(LIBRARY_TYPES.RULE),
    functions: getItems(LIBRARY_TYPES.FUNCTION)
  };
}

/**
 * Import library data from JSON
 * @param {Object} data - Import data
 * @param {boolean} merge - Whether to merge with existing or replace
 * @returns {Object} { success: boolean, error: string, imported: Object }
 */
function importLibrary(data, merge = false) {
  try {
    if (!data || !data.rules || !data.functions) {
      return { success: false, error: 'Invalid import data format.', imported: null };
    }

    let rules = data.rules;
    let functions = data.functions;

    // Regenerate IDs to avoid conflicts
    rules = rules.map(rule => ({ ...rule, id: generateId(), timestamp: Date.now() }));
    functions = functions.map(func => ({ ...func, id: generateId(), timestamp: Date.now() }));

    if (merge) {
      const existingRules = getItems(LIBRARY_TYPES.RULE);
      const existingFunctions = getItems(LIBRARY_TYPES.FUNCTION);
      rules = [...existingRules, ...rules];
      functions = [...existingFunctions, ...functions];
    }

    const rulesSaved = saveItems(LIBRARY_TYPES.RULE, rules);
    const functionsSaved = saveItems(LIBRARY_TYPES.FUNCTION, functions);

    if (rulesSaved && functionsSaved) {
      dispatchLibraryEvent('libraryImported', { rules: rules.length, functions: functions.length });
      return {
        success: true,
        error: null,
        imported: { rules: rules.length, functions: functions.length }
      };
    } else {
      return { success: false, error: 'Failed to save imported data.', imported: null };
    }
  } catch (error) {
    console.error('Error importing library:', error);
    return { success: false, error: error.message, imported: null };
  }
}

// Export LibraryManager API
window.LibraryManager = {
  // Types
  TYPES: LIBRARY_TYPES,

  // CRUD operations for rules
  saveRule,
  loadRule,
  deleteRule,
  updateRule,
  getRules: () => getItemsList(LIBRARY_TYPES.RULE),

  // CRUD operations for functions
  saveFunction,
  loadFunction,
  deleteFunction,
  updateFunction,
  getFunctions: () => getItemsList(LIBRARY_TYPES.FUNCTION),

  // Utility
  validateName,
  clearLibrary,
  getStatistics,
  exportLibrary,
  importLibrary
};

console.log('Library Manager initialized');

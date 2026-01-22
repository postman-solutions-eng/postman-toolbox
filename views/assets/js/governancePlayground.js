/**
 * Script.js
 * Author: Jordan Walsh
 *
 */

const AI_MODEL = 'gpt-4o-mini'
const AI_RATE_LIMIT_WINDOW_MS = 60 * 1000
const AI_RATE_LIMIT_MAX = 5
const AI_STORAGE_KEY = 'openai_key_obfuscated_v2'
const LEGACY_STORAGE_KEY = 'openai_key_encrypted_v1'
const enableServerAi = window.ENABLE_SERVER_AI === true
const systemPromptUrl = window.SYSTEM_PROMPT_URL || '/prompts/system.json'

const aiState = {
  keySource: 'user',
  validatedKey: '',
  unlockedKey: '',
  requestTimestamps: [],
  isGenerating: false
}

let aiSystemPrompt = ''
let aiRateLimitTimer = null
let aiElements = null

async function validate () {
  //hide any errors and reset results
  document.getElementById('spectralResultsError').style.display = 'none'
  document.getElementById('spectralResultsTableBody').innerHTML = ''
  document.getElementById('spectralResultsTable').style.display = 'table'
  document.getElementById('jsonPathTableResultsBody').innerHTML = ''

  // Hide results sections initially
  document.getElementById('jsonPathResultsSection').style.display = 'none'
  document.getElementById('spectralResultsSection').style.display = 'none'

  let spectralRule = editors[0].getValue()
  let spectralCustomFunctions = editors[1].getValue()
  let openApiSpec = editors[2].getValue()

  let formBody = [
    `spectralRule=${encodeURIComponent(spectralRule)}`,
    `spectralCustomFunctions=${encodeURIComponent(spectralCustomFunctions)}`,
    `openApiSpec=${encodeURIComponent(openApiSpec)}`
  ]

  formBody = formBody.join('&')

  await fetch(`/validate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
    },
    body: formBody
  })
    .then(response => response.json())
    .then(data => {
      if (data.error && data.error == 500) {
        throw data.message
      }

      // Show JSON Path results section
      document.getElementById('jsonPathResultsSection').style.display = 'block'
      document.getElementById('jsonPathTableResultsBody').innerHTML = ''

      for (let jsonPathMatch of data.jsonPathMatches) {
        let tr = document.createElement('tr')

        let pathTd = document.createElement('td')
        pathTd.innerText = jsonPathMatch.path
        pathTd.style.fontFamily = 'Monaco, Consolas, monospace'
        pathTd.style.fontSize = '0.85rem'
        pathTd.style.color = 'var(--color-accent)'

        let matchesTd = document.createElement('td')
        if (jsonPathMatch.matches.length > 0) {
          const tree = jsonview.create(jsonPathMatch.matches)
          jsonview.render(tree, matchesTd)
          jsonview.expand(tree)
        } else {
          matchesTd.innerText = 'No matches found.'
          matchesTd.style.color = 'var(--color-text-muted)'
          matchesTd.style.fontStyle = 'italic'
        }

        tr.appendChild(pathTd)
        tr.appendChild(matchesTd)

        document.getElementById('jsonPathTableResultsBody').appendChild(tr)
      }

      // Show Spectral results section
      document.getElementById('spectralResultsSection').style.display = 'block'

      if (!data.spectralResults || data.spectralResults.length == 0) {
        const successEl = document.getElementById('spectralResultsError')
        successEl.innerHTML = '✓ No issues found! Your API spec passes all validation rules.'
        successEl.style.display = 'block'
        successEl.classList.remove('is-error')
        successEl.classList.add('is-success')
        document.getElementById('spectralResultsTable').style.display = 'none'
      } else {
        document.getElementById('spectralResultsTableBody').innerHTML = ''

        for (let spectralResult of data.spectralResults) {
          let tr = document.createElement('tr')

          let codeTd = document.createElement('td')
          codeTd.innerText = spectralResult.code
          codeTd.style.fontFamily = 'Monaco, Consolas, monospace'
          codeTd.style.fontSize = '0.85rem'
          codeTd.style.fontWeight = '600'

          let messageTd = document.createElement('td')
          messageTd.innerText = spectralResult.message
          messageTd.style.fontSize = '0.9rem'

          let pathTd = document.createElement('td')
          pathTd.innerText = spectralResult.path.join(' → ')
          pathTd.style.fontFamily = 'Monaco, Consolas, monospace'
          pathTd.style.fontSize = '0.85rem'
          pathTd.style.color = 'var(--color-text-secondary)'

          let severityTd = document.createElement('td')
          let severityBadge = document.createElement('span')
          severityBadge.className = 'severity-badge'

          switch (spectralResult.severity) {
            case 0:
              severityBadge.innerText = 'error'
              severityBadge.classList.add('severity-error')
              break
            case 1:
              severityBadge.innerText = 'warn'
              severityBadge.classList.add('severity-warn')
              break
            case 2:
              severityBadge.innerText = 'info'
              severityBadge.classList.add('severity-info')
              break
            case 3:
              severityBadge.innerText = 'hint'
              severityBadge.classList.add('severity-hint')
              break
            default:
              severityBadge.innerText = 'n/a'
              severityBadge.style.backgroundColor = 'var(--color-text-muted)'
              break
          }
          severityTd.appendChild(severityBadge)

          let rangeTd = document.createElement('td')
          rangeTd.innerHTML = `<a href="javascript:goto(${
            parseInt(spectralResult.range.start.line) + 1
          })">Line ${parseInt(spectralResult.range.start.line) + 1}</a>`

          //add nodes to table
          tr.appendChild(codeTd)
          tr.appendChild(messageTd)
          tr.appendChild(pathTd)
          tr.appendChild(severityTd)
          tr.appendChild(rangeTd)

          document.getElementById('spectralResultsTableBody').appendChild(tr)
        }
      }
    })
    .catch(message => {
      // Show error in spectral results section
      document.getElementById('spectralResultsSection').style.display = 'block'
      document.getElementById('jsonPathTableResultsBody').innerHTML = ''
      document.getElementById('spectralResultsTableBody').innerHTML = ''

      const errorEl = document.getElementById('spectralResultsError')
      errorEl.innerText = message
      errorEl.style.display = 'block'
      errorEl.classList.remove('is-success')
      errorEl.classList.add('is-error')

      //hide the table
      document.getElementById('spectralResultsTable').style.display = 'none'
    })
}

let editorNames = [
  { name: 'spectralRule', type: 'ace/mode/yaml' },
  { name: 'spectralCustomFunctions', type: 'ace/mode/javascript' },
  { name: 'openApiSpec', type: 'ace/mode/yaml' }
]
let editors = []

for (let editor of editorNames) {
  ace.require('ace/ext/language_tools')
  var thisEditor = ace.edit(editor.name)
  // Set theme based on current app theme (light or dark)
  const currentTheme = document.documentElement.getAttribute('data-bs-theme') || 'light'
  const aceTheme = currentTheme === 'dark' ? 'ace/theme/monokai' : 'ace/theme/github'
  thisEditor.setTheme(aceTheme)
  thisEditor.session.setMode(editor.type)
  thisEditor.session.setTabSize(2)
  thisEditor.session.setUseSoftTabs(true)
  thisEditor.setOptions({
    enableBasicAutocompletion: true,
    enableSnippets: true,
    enableLiveAutocompletion: false
  })

  thisEditor.on('focus', function() {
    const prevMarkers = thisEditor.session.getMarkers();
    if (prevMarkers) {
      const prevMarkersArr = Object.keys(prevMarkers);
      for (let item of prevMarkersArr) {
        thisEditor.session.removeMarker(prevMarkers[item].id);
      }
    }
  });

  editors.push(thisEditor)
}

// Expose editors globally for theme manager
window.editors = editors

// Dispatch event to notify theme manager that editors are ready
window.dispatchEvent(new CustomEvent('editorsInitialized'))

function goto (line) {
  if (line && parseInt(line) / 1 == line) {
    var editor = ace.edit('openApiSpec')

    //Move the cursor and the editor to the right line
    editor.resize(true)
    editor.scrollToLine(line, true, true, function () {})
    editor.gotoLine(line, 10, true)

    //Remove any previous markers
    const prevMarkers = editor.session.getMarkers();
    if (prevMarkers) {
      const prevMarkersArr = Object.keys(prevMarkers);
      for (let item of prevMarkersArr) {
        editor.session.removeMarker(prevMarkers[item].id);
      }
    }

    //Add a new marker to highlight the line
    var Range = ace.require('ace/range').Range;
    editor.session.addMarker(new Range(line-1, 1, line-1, 0), "myMarker", "fullLine");
    
    //Scroll the window to the line
    window.scrollTo(0, 0);
  }
}

function fullScreen() {
  var editor = ace.edit('openApiSpec')
  editor.container.webkitRequestFullscreen()
}

/**
 * Toggle results section collapsed state
 * @param {string} section - 'jsonPath' or 'spectral'
 */
function toggleResultsSection(section) {
  const contentId = section === 'jsonPath' ? 'jsonPathResultsContent' : 'spectralResultsContent'
  const content = document.getElementById(contentId)
  const header = content.previousElementSibling

  if (content.classList.contains('collapsed')) {
    content.classList.remove('collapsed')
    header.classList.remove('collapsed')
  } else {
    content.classList.add('collapsed')
    header.classList.add('collapsed')
  }
}

// Make function globally available
window.toggleResultsSection = toggleResultsSection

async function generate () {
  if (!aiElements) {
    return
  }

  let textarea = aiElements.promptInput
  let codeblock = aiElements.responseTextArea
  let resultSection = document.getElementById('aiResultSection')
  let valid = false

  // Helper to set result text (works for both textarea and pre elements)
  const setResultText = (text) => {
    if (codeblock) {
      if (codeblock.tagName === 'TEXTAREA') {
        codeblock.value = text
      } else {
        codeblock.textContent = text
      }
    }
    if (resultSection && text) {
      resultSection.hidden = false
    }
  }

  if (!textarea || !textarea.value) {
    textarea.classList.add('is-invalid')
    setResultText('')
  } else {
    textarea.classList.remove('is-invalid')
    valid = true
    setResultText('Generating ruleset...')
  }

  if (!valid) {
    updateGenerateButtonState()
    return
  }

  if (aiState.keySource === 'user' && !aiState.validatedKey) {
    setKeyStatus('Validate your key before generating.', 'warning')
    // Open settings dropdown to show the key input
    const settingsDropdown = document.getElementById('aiSettingsDropdown')
    const settingsBtn = document.getElementById('aiSettingsToggle')
    if (settingsDropdown && settingsBtn) {
      settingsDropdown.hidden = false
      settingsBtn.setAttribute('aria-expanded', 'true')
    }
    updateGenerateButtonState()
    return
  }

  if (aiState.keySource === 'server' && !enableServerAi) {
    setResultText('Server-side AI is disabled.')
    updateGenerateButtonState()
    return
  }

  const rateLimitState = getRateLimitState()
  if (rateLimitState.limited) {
    setResultText('Too many requests. You are allowed 5 requests per minute. Please wait a few seconds and try again.')
    startRateLimitCountdown(rateLimitState.waitMs)
    return
  }

  aiState.requestTimestamps.push(Date.now())
  aiState.isGenerating = true
  updateGenerateButtonState()

  try {
    if (aiState.keySource === 'server') {
      await generateWithServer(textarea.value, codeblock, setResultText)
    } else {
      await generateWithUserKey(textarea.value, codeblock, setResultText)
    }
  } finally {
    aiState.isGenerating = false
    updateGenerateButtonState()
  }
}

async function generateWithUserKey (prompt, codeblock, setResultText) {
  let systemPrompt = ''
  try {
    systemPrompt = await getSystemPrompt()
  } catch (err) {
    setResultText('System prompt is unavailable.')
    return
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + aiState.validatedKey
    },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [
        {
          role: 'system',
          content: systemPrompt
        },
        {
          role: 'user',
          content: prompt
        }
      ]
    })
  })

  if (response.status === 401 || response.status === 403) {
    if (getStoredKeyPayload()) {
      clearStoredKey('Stored key is invalid and was cleared.', 'error')
    } else {
      aiState.validatedKey = ''
      setKeyStatus('Invalid or unauthorized key.', 'error')
    }
    setResultText('Invalid or unauthorized OpenAI key.')
    return
  }

  if (response.status === 429) {
    setResultText('Too many requests. You are allowed 5 requests per minute. Please wait a few seconds and try again.')
    startRateLimitCountdown(10 * 1000)
    return
  }

  if (!response.ok) {
    setResultText('An error occurred. Please raise an issue in the GitHub repository if this continues to occur.')
    return
  }

  try {
    const data = await response.json()
    if (data && data.choices && data.choices.length > 0) {
      setResultText(data.choices[0].message.content)
    } else {
      setResultText('An error occurred. Please raise an issue in the GitHub repository if this continues to occur.')
    }
  } catch (err) {
    console.log(err)
    setResultText('An error occurred. Please raise an issue in the GitHub repository if this continues to occur.')
  }
}

async function generateWithServer (prompt, codeblock, setResultText) {
  const response = await fetch('/api/generate', {
    method: 'POST',
    mode: 'cors',
    cache: 'no-cache',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prompt: prompt
    })
  })

  if (response.status === 501 || response.status === 403) {
    setResultText('Server-side AI is disabled.')
    return
  }

  if (response && response.status == 200) {
    try {
      const data = await response.json()
      if (data && data.result && data.result.message) {
        setResultText(data.result.message.content)
      } else {
        setResultText('An error occurred. Please raise an issue in the GitHub repository if this continues to occur.')
      }
    } catch (err) {
      console.log(err)
      setResultText('An error occurred. Please raise an issue in the GitHub repository if this continues to occur.')
    }
    return
  }

  if (response && response.status == 429) {
    setResultText('Too many requests. You are allowed 5 requests per minute. Please wait a few seconds and try again.')
    startRateLimitCountdown(10 * 1000)
    return
  }

  setResultText('An error occurred. Please raise an issue in the GitHub repository if this continues to occur.')
}

async function getSystemPrompt () {
  if (aiSystemPrompt) {
    return aiSystemPrompt
  }

  const response = await fetch(systemPromptUrl, { cache: 'no-cache' })
  if (!response.ok) {
    throw new Error('System prompt unavailable.')
  }

  const data = await response.json()
  if (!data || !data.content) {
    throw new Error('System prompt invalid.')
  }

  aiSystemPrompt = data.content
  return aiSystemPrompt
}

function initAiUi () {
  aiElements = getAiElements()
  if (!aiElements) {
    return
  }

  // Panel toggle
  const togglePanelBtn = document.getElementById('toggleAiPanel')
  const aiPanel = document.getElementById('aiGeneratePanel')
  if (togglePanelBtn && aiPanel) {
    togglePanelBtn.addEventListener('click', () => {
      const isExpanded = togglePanelBtn.getAttribute('aria-expanded') === 'true'
      togglePanelBtn.setAttribute('aria-expanded', !isExpanded)
      aiPanel.hidden = isExpanded
    })
  }

  // Settings dropdown toggle
  const settingsBtn = document.getElementById('aiSettingsToggle')
  const settingsDropdown = document.getElementById('aiSettingsDropdown')
  if (settingsBtn && settingsDropdown) {
    settingsBtn.addEventListener('click', () => {
      const isExpanded = settingsBtn.getAttribute('aria-expanded') === 'true'
      settingsBtn.setAttribute('aria-expanded', !isExpanded)
      settingsDropdown.hidden = isExpanded
    })
  }

  // Copy result button
  const copyBtn = document.getElementById('copyResultBtn')
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const resultText = aiElements.responseTextArea.textContent
      navigator.clipboard.writeText(resultText).then(() => {
        copyBtn.classList.add('copied')
        setTimeout(() => copyBtn.classList.remove('copied'), 1500)
      })
    })
  }

  // Generate button click
  const generateBtn = document.getElementById('generateRule')
  if (generateBtn) {
    generateBtn.addEventListener('click', generate)
  }

  aiElements.keySourceUser.addEventListener('change', () => {
    setKeySource('user')
  })

  if (aiElements.keySourceServer) {
    aiElements.keySourceServer.addEventListener('change', () => {
      setKeySource('server')
    })
  }

  aiElements.keyInput.addEventListener('input', () => {
    aiState.unlockedKey = ''
    aiState.validatedKey = ''
    setKeyStatus('Key not validated', 'muted')
    updateGenerateButtonState()
  })

  aiElements.validateButton.addEventListener('click', () => validateKey())
  aiElements.rememberCheckbox.addEventListener('change', handleRememberToggle)
  aiElements.forgetStoredKeyButton.addEventListener('click', forgetStoredKey)

  if (!window.AIKeyUtils || !AIKeyUtils.supportsWebCrypto()) {
    aiElements.rememberCheckbox.disabled = true
    aiElements.rememberCheckbox.checked = false
    aiElements.rememberCheckbox.title = 'Encryption is unavailable in this browser.'
    clearStoredKey('Stored key cleared because encryption is unavailable.', 'warning')
  }

  cleanupLegacyStoredKey()
  updateStoredKeyUi()
  const defaultSource =
    aiElements.keySourceServer && aiElements.keySourceServer.checked
      ? 'server'
      : 'user'
  setKeySource(defaultSource)
  setKeyStatus('Key not validated', 'muted')
  autoLoadStoredKey()
  updateGenerateButtonState()
}

function initializeTooltips () {
  const tooltipTriggers = document.querySelectorAll('[data-bs-toggle="tooltip"]')
  for (let trigger of tooltipTriggers) {
    new bootstrap.Tooltip(trigger)
  }
}

function getAiElements () {
  const keySourceUser = document.getElementById('keySourceUser')
  if (!keySourceUser) {
    return null
  }

  return {
    keySourceUser: keySourceUser,
    keySourceServer: document.getElementById('keySourceServer'),
    userKeySection: document.getElementById('userKeySection'),
    serverKeySection: document.getElementById('serverKeySection'),
    keyInput: document.getElementById('openaiKeyInput'),
    validateButton: document.getElementById('validateKeyButton'),
    keyStatus: document.getElementById('keyStatus'),
    rememberCheckbox: document.getElementById('rememberKey'),
    storedKeyContainer: document.getElementById('storedKeyContainer'),
    storedKeyStatus: document.getElementById('storedKeyStatus'),
    forgetStoredKeyButton: document.getElementById('forgetStoredKeyButton'),
    generateButton: document.getElementById('generateRule'),
    promptInput: document.getElementById('promptTextArea'),
    responseTextArea: document.getElementById('responseTextArea')
  }
}

function setKeySource (source) {
  aiState.keySource = source
  if (source === 'server') {
    aiElements.userKeySection.hidden = true
    aiElements.serverKeySection.hidden = false
  } else {
    aiElements.userKeySection.hidden = false
    aiElements.serverKeySection.hidden = true
  }
  updateGenerateButtonState()
}

function setKeyStatus (message, tone) {
  if (!aiElements || !aiElements.keyStatus) {
    return
  }

  const status = aiElements.keyStatus
  status.textContent = message
  status.classList.remove('valid', 'error', 'warning')

  switch (tone) {
    case 'success':
      status.classList.add('valid')
      break
    case 'error':
      status.classList.add('error')
      break
    case 'warning':
      status.classList.add('warning')
      break
    default:
      // muted - no additional class needed
      break
  }
}

function handleRememberToggle () {
  if (!aiElements.rememberCheckbox.checked) {
    if (getStoredKeyPayload()) {
      clearStoredKey('Stored key removed.', 'muted', { preserveMemory: true })
    }
    updateGenerateButtonState()
    return
  }

  if (aiState.validatedKey) {
    storeEncryptedKey(aiState.validatedKey)
  }
}

function getCandidateKey () {
  const inputValue = aiElements.keyInput.value.trim()
  if (inputValue) {
    return inputValue
  }
  return aiState.unlockedKey
}

async function validateKey (options) {
  if (aiState.keySource !== 'user') {
    return
  }

  const opts = options || {}
  const key = opts.keyOverride || getCandidateKey()
  if (!key) {
    setKeyStatus('Enter your OpenAI key to validate.', 'warning')
    updateGenerateButtonState()
    return
  }

  const statusMessage = opts.isStoredKey ? 'Validating stored key...' : 'Validating key...'
  setKeyStatus(statusMessage, 'muted')
  aiState.validatedKey = ''
  updateGenerateButtonState()

  let response
  try {
    response = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        Authorization: 'Bearer ' + key
      }
    })
  } catch (err) {
    setKeyStatus('Unable to reach OpenAI. Check your connection.', 'error')
    return
  }

  if (response.status === 401 || response.status === 403) {
    if (opts.isStoredKey) {
      clearStoredKey('Stored key is invalid and was cleared.', 'error')
    } else {
      setKeyStatus('Invalid or unauthorized key.', 'error')
    }
    return
  }

  if (!response.ok) {
    if (opts.isStoredKey) {
      clearStoredKey('Stored key could not be validated and was cleared.', 'error')
    } else {
      setKeyStatus('Unable to validate the key. Try again.', 'error')
    }
    return
  }

  let data = {}
  try {
    data = await response.json()
  } catch (err) {
    if (opts.isStoredKey) {
      clearStoredKey('Stored key could not be validated and was cleared.', 'error')
    } else {
      setKeyStatus('Unable to validate the key. Try again.', 'error')
    }
    return
  }

  const models = Array.isArray(data.data) ? data.data : []
  const hasModel = models.some(item => item && item.id === AI_MODEL)
  aiState.validatedKey = key
  if (hasModel) {
    setKeyStatus('Key valid. Model is available.', 'success')
  } else {
    setKeyStatus('Key valid, but model is not available.', 'warning')
  }

  if (!opts.skipStore && aiElements.rememberCheckbox.checked) {
    await storeEncryptedKey(key)
  }

  updateGenerateButtonState()
}

function getStoredKeyPayload () {
  try {
    const raw = localStorage.getItem(AI_STORAGE_KEY)
    if (!raw) {
      return null
    }
    const payload = JSON.parse(raw)
    if (!payload || !payload.secret || !payload.ciphertext || !payload.iv || !payload.salt) {
      localStorage.removeItem(AI_STORAGE_KEY)
      return null
    }
    return payload
  } catch (err) {
    localStorage.removeItem(AI_STORAGE_KEY)
    return null
  }
}

async function storeEncryptedKey (apiKey) {
  if (!window.AIKeyUtils) {
    setKeyStatus('Encryption is unavailable in this browser.', 'error')
    return
  }

  try {
    const secret = AIKeyUtils.generateSecret()
    const payload = await AIKeyUtils.encryptApiKey(apiKey, secret)
    payload.secret = secret
    payload.scheme = 'local-obfuscation'
    localStorage.setItem(AI_STORAGE_KEY, JSON.stringify(payload))
    updateStoredKeyUi()
    setKeyStatus('Key stored locally (obfuscated).', 'success')
  } catch (err) {
    console.log(err)
    setKeyStatus('Unable to store key locally.', 'error')
  }
}

function forgetStoredKey () {
  clearStoredKey('Stored key removed.', 'muted')
}

function updateStoredKeyUi () {
  const payload = getStoredKeyPayload()
  if (payload) {
    aiElements.storedKeyContainer.hidden = false
    aiElements.rememberCheckbox.checked = true
  } else {
    aiElements.storedKeyContainer.hidden = true
    aiElements.rememberCheckbox.checked = false
  }
}

function clearStoredKey (message, tone, options) {
  localStorage.removeItem(AI_STORAGE_KEY)
  const opts = options || {}
  if (!opts.preserveMemory) {
    aiState.unlockedKey = ''
    aiState.validatedKey = ''
  }
  updateStoredKeyUi()
  if (message) {
    setKeyStatus(message, tone || 'muted')
  }
  updateGenerateButtonState()
}

function cleanupLegacyStoredKey () {
  try {
    localStorage.removeItem(LEGACY_STORAGE_KEY)
  } catch (err) {
    return
  }
}

async function autoLoadStoredKey () {
  const payload = getStoredKeyPayload()
  if (!payload) {
    return
  }

  if (!window.AIKeyUtils) {
    clearStoredKey('Stored key cleared because encryption is unavailable.', 'warning')
    return
  }

  try {
    aiState.unlockedKey = await AIKeyUtils.decryptApiKey(payload, payload.secret)
  } catch (err) {
    clearStoredKey('Stored key could not be decrypted and was cleared.', 'error')
    return
  }

  aiElements.keyInput.value = ''
  setKeyStatus('Validating stored key...', 'muted')
  await validateKey({ keyOverride: aiState.unlockedKey, isStoredKey: true, skipStore: true })
}

function getRateLimitState () {
  const now = Date.now()
  aiState.requestTimestamps = aiState.requestTimestamps.filter(ts => now - ts < AI_RATE_LIMIT_WINDOW_MS)
  if (aiState.requestTimestamps.length >= AI_RATE_LIMIT_MAX) {
    const oldest = aiState.requestTimestamps[0]
    return {
      limited: true,
      waitMs: AI_RATE_LIMIT_WINDOW_MS - (now - oldest)
    }
  }
  return {
    limited: false,
    waitMs: 0
  }
}

function startRateLimitCountdown (waitMs) {
  if (aiRateLimitTimer) {
    clearInterval(aiRateLimitTimer)
  }

  let timer = Math.ceil(waitMs / 1000)
  if (timer < 1) {
    timer = 1
  }

  aiElements.generateButton.setAttribute('disabled', 'disabled')
  aiElements.generateButton.innerText = 'Generate (' + timer + ')'

  aiRateLimitTimer = setInterval(() => {
    timer -= 1
    aiElements.generateButton.innerText = 'Generate (' + timer + ')'
    if (timer <= 0) {
      clearInterval(aiRateLimitTimer)
      aiRateLimitTimer = null
      aiElements.generateButton.innerText = 'Generate'
      updateGenerateButtonState()
    }
  }, 1000)
}

function updateGenerateButtonState () {
  if (!aiElements || !aiElements.generateButton) {
    return
  }

  const rateLimitState = getRateLimitState()
  const canGenerate =
    !aiState.isGenerating &&
    !rateLimitState.limited &&
    ((aiState.keySource === 'server' && enableServerAi) ||
      (aiState.keySource === 'user' && !!aiState.validatedKey))

  if (canGenerate) {
    aiElements.generateButton.disabled = false
    aiElements.generateButton.innerText = 'Generate'
  } else {
    aiElements.generateButton.setAttribute('disabled', 'disabled')
  }
}

initAiUi()

/**********************************************************************/
/* LIBRARY FUNCTIONALITY                                              */
/**********************************************************************/

// Library state
const libraryState = {
  currentSaveType: null, // 'rule' or 'function'
  currentDeleteId: null,
  currentDeleteType: null,
  pendingLoad: null, // { id, type } - item waiting to be loaded after confirmation
  dirtyEditors: {
    rule: false,
    function: false
  },
  lastSavedContent: {
    rule: '',
    function: ''
  },
  loadedItems: {
    rule: null,
    function: null
  }
}

/**
 * Initialize library functionality
 */
function initLibrary() {
  // Render initial library lists
  renderLibraryLists()

  // Setup event listeners
  setupLibraryEventListeners()

  // Setup dirty state tracking for editors
  setupDirtyTracking()

  // Listen for library events
  window.addEventListener('itemAdded', () => renderLibraryLists())
  window.addEventListener('itemDeleted', () => renderLibraryLists())
  window.addEventListener('itemUpdated', () => renderLibraryLists())

  console.log('Library initialized')
}

/**
 * Setup dirty state tracking for editors
 */
function setupDirtyTracking() {
  // Store initial content
  libraryState.lastSavedContent.rule = editors[0].getValue()
  libraryState.lastSavedContent.function = editors[1].getValue()

  // Listen for changes on rule editor (index 0)
  editors[0].on('change', () => {
    const currentContent = editors[0].getValue()
    libraryState.dirtyEditors.rule = currentContent !== libraryState.lastSavedContent.rule
  })

  // Listen for changes on function editor (index 1)
  editors[1].on('change', () => {
    const currentContent = editors[1].getValue()
    libraryState.dirtyEditors.function = currentContent !== libraryState.lastSavedContent.function
  })
}

/**
 * Setup event listeners for library UI
 */
function setupLibraryEventListeners() {
  // Collapse/Expand sidebar
  const collapseBtn = document.getElementById('collapseSidebarBtn')
  if (collapseBtn) {
    collapseBtn.addEventListener('click', toggleSidebar)
  }

  // Clicking collapsed indicator expands the sidebar
  const collapsedIndicator = document.querySelector('.library-collapsed-indicator')
  if (collapsedIndicator) {
    collapsedIndicator.addEventListener('click', toggleSidebar)
  }

  // Add Rule button
  const addRuleBtn = document.getElementById('addRuleBtn')
  if (addRuleBtn) {
    addRuleBtn.addEventListener('click', () => showSaveModal('rule'))
  }

  // Add Function button
  const addFunctionBtn = document.getElementById('addFunctionBtn')
  if (addFunctionBtn) {
    addFunctionBtn.addEventListener('click', () => showSaveModal('function'))
  }

  // Save button in modal
  const saveBtn = document.getElementById('saveLibraryItemBtn')
  if (saveBtn) {
    saveBtn.addEventListener('click', handleSaveItem)
  }

  // Delete confirmation button
  const confirmDeleteBtn = document.getElementById('confirmDeleteLibraryItemBtn')
  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', handleDeleteItem)
  }

  // Overwrite modal buttons
  const discardChangesBtn = document.getElementById('discardChangesBtn')
  if (discardChangesBtn) {
    discardChangesBtn.addEventListener('click', handleDiscardChanges)
  }

  const saveFirstBtn = document.getElementById('saveFirstBtn')
  if (saveFirstBtn) {
    saveFirstBtn.addEventListener('click', handleSaveFirst)
  }

  // Clear pending load state when overwrite modal is dismissed
  const overwriteModal = document.getElementById('overwriteConfirmModal')
  if (overwriteModal) {
    overwriteModal.addEventListener('hidden.bs.modal', () => {
      // Only clear if we didn't proceed with save first
      if (!libraryState.saveAndLoadPending) {
        libraryState.pendingLoad = null
      }
    })
  }

  // Clear pending state when save modal is dismissed without saving
  const saveModal = document.getElementById('saveLibraryItemModal')
  if (saveModal) {
    saveModal.addEventListener('hidden.bs.modal', () => {
      if (libraryState.saveAndLoadPending) {
        libraryState.saveAndLoadPending = false
        libraryState.pendingLoad = null
      }
    })
  }

  // Clear error on input
  const nameInput = document.getElementById('libraryItemName')
  if (nameInput) {
    nameInput.addEventListener('input', () => {
      nameInput.classList.remove('is-invalid')
      document.getElementById('libraryItemNameError').textContent = ''
    })
  }
}

/**
 * Toggle library sidebar collapsed state
 */
function toggleSidebar() {
  const sidebar = document.getElementById('librarySidebar')
  const collapseBtn = document.getElementById('collapseSidebarBtn')
  const collapseIcon = collapseBtn ? collapseBtn.querySelector('.collapse-icon') : null

  if (sidebar) {
    sidebar.classList.toggle('collapsed')
    if (collapseIcon) {
      collapseIcon.textContent = sidebar.classList.contains('collapsed') ? '→' : '←'
    }
    if (collapseBtn) {
      collapseBtn.setAttribute(
        'aria-label',
        sidebar.classList.contains('collapsed') ? 'Expand library sidebar' : 'Collapse library sidebar'
      )
    }
  }
}

/**
 * Render both library lists
 */
function renderLibraryLists() {
  renderLibraryList('rule')
  renderLibraryList('function')
}

/**
 * Render a library list (rules or functions)
 * @param {string} type - 'rule' or 'function'
 */
function renderLibraryList(type) {
  const listId = type === 'rule' ? 'rulesLibraryList' : 'functionsLibraryList'
  const listElement = document.getElementById(listId)
  if (!listElement) return

  const items = type === 'rule' ? LibraryManager.getRules() : LibraryManager.getFunctions()

  if (items.length === 0) {
    listElement.innerHTML = `<div class="library-empty">No saved ${type}s</div>`
    return
  }

  let html = ''
  items.forEach(item => {
    html += `
      <div class="library-item" data-id="${item.id}" data-type="${type}">
        <span class="library-item-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</span>
        <div class="library-item-actions">
          <button class="btn-load" onclick="loadLibraryItem('${item.id}', '${type}')" title="Load ${type}" aria-label="Load ${escapeHtml(item.name)}">
            ↓
          </button>
          <button class="btn-delete" onclick="showDeleteModal('${item.id}', '${type}', '${escapeHtml(item.name)}')" title="Delete ${type}" aria-label="Delete ${escapeHtml(item.name)}">
            ×
          </button>
        </div>
      </div>
    `
  })

  listElement.innerHTML = html
}

/**
 * Show save modal
 * @param {string} type - 'rule' or 'function'
 */
function showSaveModal(type) {
  libraryState.currentSaveType = type

  // Get current content from editors
  const content = type === 'rule' ? editors[0].getValue() : editors[1].getValue()

  if (!content || content.trim() === '') {
    alert(`Please enter some content in the ${type} editor before saving.`)
    return
  }

  // Update modal
  document.getElementById('libraryItemType').textContent = type
  document.getElementById('libraryItemName').value = ''
  document.getElementById('libraryItemName').classList.remove('is-invalid')
  document.getElementById('libraryItemNameError').textContent = ''

  // Show modal
  const modal = new bootstrap.Modal(document.getElementById('saveLibraryItemModal'))
  modal.show()

  // Focus on name input after modal is shown
  document.getElementById('saveLibraryItemModal').addEventListener('shown.bs.modal', () => {
    document.getElementById('libraryItemName').focus()
  }, { once: true })
}

/**
 * Handle save item from modal
 */
function handleSaveItem() {
  const name = document.getElementById('libraryItemName').value
  const type = libraryState.currentSaveType
  const nameInput = document.getElementById('libraryItemName')
  const errorElement = document.getElementById('libraryItemNameError')

  // Get content from appropriate editor
  const content = type === 'rule' ? editors[0].getValue() : editors[1].getValue()

  // Check if we're updating an existing loaded item with the same name
  const loadedItem = libraryState.loadedItems[type]
  const isUpdatingLoadedItem = loadedItem && loadedItem.name === name.trim()

  let result
  if (isUpdatingLoadedItem) {
    // Update the existing item
    result = type === 'rule'
      ? LibraryManager.updateRule(loadedItem.id, name, content)
      : LibraryManager.updateFunction(loadedItem.id, name, content)
  } else {
    // Save as new item
    result = type === 'rule'
      ? LibraryManager.saveRule(name, content)
      : LibraryManager.saveFunction(name, content)
  }

  if (result.success) {
    // Close modal
    const modalElement = document.getElementById('saveLibraryItemModal')
    const modal = bootstrap.Modal.getInstance(modalElement)
    modal.hide()

    // Update saved content and clear dirty state
    libraryState.lastSavedContent[type] = content
    libraryState.dirtyEditors[type] = false

    // Update loaded item reference
    libraryState.loadedItems[type] = { id: result.item.id, name: result.item.name }

    // Show success message
    const action = isUpdatingLoadedItem ? 'updated' : 'saved'
    showNotification(`${type.charAt(0).toUpperCase() + type.slice(1)} ${action} successfully!`, 'success')

    // If there's a pending load, perform it now
    if (libraryState.saveAndLoadPending && libraryState.pendingLoad) {
      const { id, type: loadType } = libraryState.pendingLoad
      libraryState.saveAndLoadPending = false
      libraryState.pendingLoad = null
      performLoad(id, loadType)
    }
  } else {
    // Show error
    nameInput.classList.add('is-invalid')
    errorElement.textContent = result.error
  }
}

/**
 * Load library item into editor
 * @param {string} id - Item ID
 * @param {string} type - 'rule' or 'function'
 */
function loadLibraryItem(id, type) {
  // Check if editor has unsaved changes
  if (libraryState.dirtyEditors[type]) {
    libraryState.pendingLoad = { id, type }
    showOverwriteModal(type)
    return
  }

  performLoad(id, type)
}

/**
 * Actually perform the load operation
 * @param {string} id - Item ID
 * @param {string} type - 'rule' or 'function'
 */
function performLoad(id, type) {
  const item = type === 'rule' ? LibraryManager.loadRule(id) : LibraryManager.loadFunction(id)

  if (!item) {
    showNotification(`${type.charAt(0).toUpperCase() + type.slice(1)} not found.`, 'error')
    return
  }

  // Load content into appropriate editor
  const editorIndex = type === 'rule' ? 0 : 1
  editors[editorIndex].setValue(item.content)
  editors[editorIndex].clearSelection()

  // Update saved content and clear dirty state
  libraryState.lastSavedContent[type] = item.content
  libraryState.dirtyEditors[type] = false

  // Track the loaded item for updates
  libraryState.loadedItems[type] = { id: item.id, name: item.name }

  // Highlight the loaded item
  highlightLibraryItem(id, type)

  showNotification(`Loaded "${item.name}"`, 'success')
}

/**
 * Show overwrite confirmation modal
 * @param {string} type - 'rule' or 'function'
 */
function showOverwriteModal(type) {
  document.getElementById('overwriteItemType').textContent = type
  const modal = new bootstrap.Modal(document.getElementById('overwriteConfirmModal'))
  modal.show()
}

/**
 * Handle discard changes - proceed with load without saving
 */
function handleDiscardChanges() {
  const { id, type } = libraryState.pendingLoad || {}

  // Close modal
  const modalElement = document.getElementById('overwriteConfirmModal')
  const modal = bootstrap.Modal.getInstance(modalElement)
  modal.hide()

  if (id && type) {
    // Clear dirty state and perform load
    libraryState.dirtyEditors[type] = false
    performLoad(id, type)
  }

  libraryState.pendingLoad = null
}

/**
 * Handle save first - show save modal, then load after saving
 */
function handleSaveFirst() {
  const { type } = libraryState.pendingLoad || {}

  // Close overwrite modal
  const overwriteModal = bootstrap.Modal.getInstance(document.getElementById('overwriteConfirmModal'))
  overwriteModal.hide()

  if (type) {
    // Show save modal for current content
    libraryState.currentSaveType = type
    libraryState.saveAndLoadPending = true

    // Get current content from editor
    const content = type === 'rule' ? editors[0].getValue() : editors[1].getValue()

    if (!content || content.trim() === '') {
      // No content to save, just discard and load
      handleDiscardChanges()
      return
    }

    // Update modal and show it
    document.getElementById('libraryItemType').textContent = type
    // Pre-fill with loaded item name if available
    const loadedItem = libraryState.loadedItems[type]
    document.getElementById('libraryItemName').value = loadedItem ? loadedItem.name : ''
    document.getElementById('libraryItemName').classList.remove('is-invalid')
    document.getElementById('libraryItemNameError').textContent = ''

    const saveModal = new bootstrap.Modal(document.getElementById('saveLibraryItemModal'))
    saveModal.show()

    document.getElementById('saveLibraryItemModal').addEventListener('shown.bs.modal', () => {
      document.getElementById('libraryItemName').focus()
    }, { once: true })
  }
}

/**
 * Highlight a library item temporarily
 * @param {string} id - Item ID
 * @param {string} type - 'rule' or 'function'
 */
function highlightLibraryItem(id, type) {
  // Remove any existing highlights
  document.querySelectorAll('.library-item.active').forEach(item => {
    item.classList.remove('active')
  })

  // Add highlight to this item
  const item = document.querySelector(`.library-item[data-id="${id}"][data-type="${type}"]`)
  if (item) {
    item.classList.add('active')

    // Remove highlight after 2 seconds
    setTimeout(() => {
      item.classList.remove('active')
    }, 2000)
  }
}

/**
 * Show delete confirmation modal
 * @param {string} id - Item ID
 * @param {string} type - 'rule' or 'function'
 * @param {string} name - Item name
 */
function showDeleteModal(id, type, name) {
  libraryState.currentDeleteId = id
  libraryState.currentDeleteType = type

  document.getElementById('deleteLibraryItemName').textContent = name

  const modal = new bootstrap.Modal(document.getElementById('deleteLibraryItemModal'))
  modal.show()
}

/**
 * Handle delete item
 */
function handleDeleteItem() {
  const { currentDeleteId, currentDeleteType } = libraryState

  const success = currentDeleteType === 'rule'
    ? LibraryManager.deleteRule(currentDeleteId)
    : LibraryManager.deleteFunction(currentDeleteId)

  if (success) {
    // Close modal
    const modalElement = document.getElementById('deleteLibraryItemModal')
    const modal = bootstrap.Modal.getInstance(modalElement)
    modal.hide()

    showNotification(`${currentDeleteType.charAt(0).toUpperCase() + currentDeleteType.slice(1)} deleted successfully.`, 'success')
  } else {
    showNotification('Failed to delete item.', 'error')
  }

  libraryState.currentDeleteId = null
  libraryState.currentDeleteType = null
}

/**
 * Show notification message
 * @param {string} message - Message to display
 * @param {string} type - 'success' or 'error'
 */
function showNotification(message, type = 'success') {
  // Create notification element
  const notification = document.createElement('div')
  notification.className = `alert alert-${type === 'success' ? 'success' : 'danger'} alert-dismissible fade show`
  notification.style.position = 'fixed'
  notification.style.top = '20px'
  notification.style.right = '20px'
  notification.style.zIndex = '9999'
  notification.style.minWidth = '300px'
  notification.innerHTML = `
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `

  document.body.appendChild(notification)

  // Auto-dismiss after 3 seconds
  setTimeout(() => {
    notification.classList.remove('show')
    setTimeout(() => notification.remove(), 150)
  }, 3000)
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

// Make functions available globally for onclick handlers
window.loadLibraryItem = loadLibraryItem
window.showDeleteModal = showDeleteModal

// Initialize library when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLibrary)
} else {
  initLibrary()
}

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
  //hide any errors
  document.getElementById('spectralResultsError').style.display = 'none'
  document.getElementById('spectralResultsTableBody').innerHTML = ''
  document.getElementById('spectralResultsTable').style.display = 'table'

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

      document.getElementById('jsonPathTableResultsBody').innerHTML = ''

      for (let jsonPathMatch of data.jsonPathMatches) {
        let tr = document.createElement('tr')

        let pathTd = document.createElement('td')
        pathTd.innerText = jsonPathMatch.path

        let matchesTd = document.createElement('td')
        if (jsonPathMatch.matches.length > 0) {
          const tree = jsonview.create(jsonPathMatch.matches)
          jsonview.render(tree, matchesTd)
          jsonview.expand(tree)
        } else {
          matchesTd.innerText = 'No matches found.'
        }

        tr.appendChild(pathTd)
        tr.appendChild(matchesTd)

        document.getElementById('jsonPathTableResultsBody').appendChild(tr)
      }

      if (!data.spectralResults || data.spectralResults.length == 0) {
        document.getElementById('spectralResultsError').innerHTML =
          'No issues found!'
        document.getElementById('spectralResultsError').style.display = 'block'
        document.getElementById('spectralResultsTable').style.display = 'none'
      } else {
        let message = `${data.spectralResults.length} issue found`
        if (data.spectralResults.length > 1) {
          message = `${data.spectralResults.length} issues found`
        }

        document.getElementById('spectralResultsTableBody').innerHTML = ''

        for (let spectralResult of data.spectralResults) {
          let tr = document.createElement('tr')

          let codeTd = document.createElement('td')
          codeTd.innerText = spectralResult.code

          let messageTd = document.createElement('td')
          messageTd.innerText = spectralResult.message

          let pathTd = document.createElement('td')
          pathTd.innerText = spectralResult.path.join('\r\n')

          let severityTd = document.createElement('td')
          switch (spectralResult.severity) {
            case 0:
              severityTd.innerText = 'error'
              break
            case 1:
              severityTd.innerText = 'warn'
              break
            case 2:
              severityTd.innerText = 'info'
              break
            case 3:
              severityTd.innerText = 'hint'
              break
            default:
              severityTd.innerText = 'n/a'
              break
          }

          let rangeTd = document.createElement('td')
          rangeTd.innerHTML = `<a href="javascript:goto(${
            parseInt(spectralResult.range.start.line) + 1
          })">${parseInt(spectralResult.range.start.line) + 1}</a>`

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
      document.getElementById('jsonPathTableResultsBody').innerHTML = ''
      document.getElementById('spectralResultsTableBody').innerHTML = ''
      document.getElementById('spectralResultsError').innerText = message

      //show the error
      document.getElementById('spectralResultsTable').style.display = 'none'
      document.getElementById('spectralResultsError').style.display = 'block'
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
  thisEditor.setTheme('ace/theme/monokai')
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

async function generate () {
  if (!aiElements) {
    return
  }

  let textarea = aiElements.promptInput
  let codeblock = aiElements.responseTextArea
  let valid = false

  if (!textarea || !textarea.value) {
    textarea.classList.add('is-invalid')
    if (codeblock) {
      codeblock.value = ''
    }
  } else {
    textarea.classList.remove('is-invalid')
    valid = true
    if (codeblock) {
      codeblock.value = 'Generating ruleset...'
    }
  }

  if (!valid) {
    updateGenerateButtonState()
    return
  }

  if (aiState.keySource === 'user' && !aiState.validatedKey) {
    setKeyStatus('Validate your key before generating.', 'warning')
    updateGenerateButtonState()
    return
  }

  if (aiState.keySource === 'server' && !enableServerAi) {
    if (codeblock) {
      codeblock.value = 'Server-side AI is disabled.'
    }
    updateGenerateButtonState()
    return
  }

  const rateLimitState = getRateLimitState()
  if (rateLimitState.limited) {
    if (codeblock) {
      codeblock.value =
        'Too many requests. You are allowed 5 requests per minute. Please wait a few seconds and try again.'
    }
    startRateLimitCountdown(rateLimitState.waitMs)
    return
  }

  aiState.requestTimestamps.push(Date.now())
  aiState.isGenerating = true
  updateGenerateButtonState()

  try {
    if (aiState.keySource === 'server') {
      await generateWithServer(textarea.value, codeblock)
    } else {
      await generateWithUserKey(textarea.value, codeblock)
    }
  } finally {
    aiState.isGenerating = false
    updateGenerateButtonState()
  }
}

async function generateWithUserKey (prompt, codeblock) {
  let systemPrompt = ''
  try {
    systemPrompt = await getSystemPrompt()
  } catch (err) {
    if (codeblock) {
      codeblock.value = 'System prompt is unavailable.'
    }
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
    if (codeblock) {
      codeblock.value = 'Invalid or unauthorized OpenAI key.'
    }
    return
  }

  if (response.status === 429) {
    if (codeblock) {
      codeblock.value =
        'Too many requests. You are allowed 5 requests per minute. Please wait a few seconds and try again.'
    }
    startRateLimitCountdown(10 * 1000)
    return
  }

  if (!response.ok) {
    if (codeblock) {
      codeblock.value =
        'An error occurred. Please raise an issue in the GitHub repository if this continues to occur.'
    }
    return
  }

  try {
    const data = await response.json()
    if (data && data.choices && data.choices.length > 0) {
      codeblock.value = data.choices[0].message.content
    } else {
      codeblock.value =
        'An error occurred. Please raise an issue in the GitHub repository if this continues to occur.'
    }
  } catch (err) {
    console.log(err)
    if (codeblock) {
      codeblock.value =
        'An error occurred. Please raise an issue in the GitHub repository if this continues to occur.'
    }
  }
}

async function generateWithServer (prompt, codeblock) {
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
    if (codeblock) {
      codeblock.value = 'Server-side AI is disabled.'
    }
    return
  }

  if (response && response.status == 200) {
    try {
      const data = await response.json()
      if (data && data.result && data.result.message) {
        codeblock.value = data.result.message.content
      } else {
        codeblock.value =
          'An error occurred. Please raise an issue in the GitHub repository if this continues to occur.'
      }
    } catch (err) {
      console.log(err)
      if (codeblock) {
        codeblock.value =
          'An error occurred. Please raise an issue in the GitHub repository if this continues to occur.'
      }
    }
    return
  }

  if (response && response.status == 429) {
    if (codeblock) {
      codeblock.value =
        'Too many requests. You are allowed 5 requests per minute. Please wait a few seconds and try again.'
    }
    startRateLimitCountdown(10 * 1000)
    return
  }

  if (codeblock) {
    codeblock.value =
      'An error occurred. Please raise an issue in the GitHub repository if this continues to occur.'
  }
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

  initializeTooltips()

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
    setKeyStatus('Key not validated.', 'muted')
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
  setKeyStatus('Key not validated.', 'muted')
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
    aiElements.userKeySection.classList.add('d-none')
    aiElements.serverKeySection.classList.remove('d-none')
  } else {
    aiElements.userKeySection.classList.remove('d-none')
    aiElements.serverKeySection.classList.add('d-none')
  }
  updateGenerateButtonState()
}

function setKeyStatus (message, tone) {
  if (!aiElements || !aiElements.keyStatus) {
    return
  }

  const status = aiElements.keyStatus
  status.textContent = message
  status.classList.remove('text-success', 'text-danger', 'text-warning', 'text-muted')

  switch (tone) {
    case 'success':
      status.classList.add('text-success')
      break
    case 'error':
      status.classList.add('text-danger')
      break
    case 'warning':
      status.classList.add('text-warning')
      break
    default:
      status.classList.add('text-muted')
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
    aiElements.storedKeyContainer.classList.remove('d-none')
    if (aiElements.storedKeyStatus) {
      aiElements.storedKeyStatus.value = 'Stored locally on this device.'
    }
    aiElements.rememberCheckbox.checked = true
  } else {
    aiElements.storedKeyContainer.classList.add('d-none')
    if (aiElements.storedKeyStatus) {
      aiElements.storedKeyStatus.value = ''
    }
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

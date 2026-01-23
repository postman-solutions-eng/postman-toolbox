(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory()
  } else {
    root.AIKeyUtils = factory()
  }
})(typeof self !== 'undefined' ? self : this, function () {
  const DEFAULT_ITERATIONS = 150000

  function supportsWebCrypto () {
    const cryptoRef = typeof globalThis !== 'undefined' ? globalThis.crypto : null
    return !!(cryptoRef && cryptoRef.subtle && cryptoRef.getRandomValues)
  }

  function getCrypto () {
    const cryptoRef = typeof globalThis !== 'undefined' ? globalThis.crypto : null
    if (!cryptoRef || !cryptoRef.subtle || !cryptoRef.getRandomValues) {
      throw new Error('WebCrypto is unavailable.')
    }
    return cryptoRef
  }

  function getTextEncoder () {
    if (typeof TextEncoder !== 'undefined') {
      return new TextEncoder()
    }
    if (typeof require === 'function') {
      const util = require('util')
      return new util.TextEncoder()
    }
    throw new Error('TextEncoder is unavailable.')
  }

  function getTextDecoder () {
    if (typeof TextDecoder !== 'undefined') {
      return new TextDecoder()
    }
    if (typeof require === 'function') {
      const util = require('util')
      return new util.TextDecoder()
    }
    throw new Error('TextDecoder is unavailable.')
  }

  function toBase64 (bytes) {
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(bytes).toString('base64')
    }
    let binary = ''
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  }

  function fromBase64 (value) {
    if (typeof Buffer !== 'undefined') {
      return new Uint8Array(Buffer.from(value, 'base64'))
    }
    const binary = atob(value)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return bytes
  }

  async function deriveKey (passphrase, salt, iterations) {
    const cryptoRef = getCrypto()
    const encoder = getTextEncoder()
    const baseKey = await cryptoRef.subtle.importKey(
      'raw',
      encoder.encode(passphrase),
      'PBKDF2',
      false,
      ['deriveKey']
    )

    return cryptoRef.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations,
        hash: 'SHA-256'
      },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    )
  }

  async function encryptApiKey (apiKey, passphrase, options) {
    const cryptoRef = getCrypto()
    const encoder = getTextEncoder()
    const iterations = options && options.iterations ? options.iterations : DEFAULT_ITERATIONS
    const salt = cryptoRef.getRandomValues(new Uint8Array(16))
    const iv = cryptoRef.getRandomValues(new Uint8Array(12))
    const key = await deriveKey(passphrase, salt, iterations)
    const ciphertext = await cryptoRef.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoder.encode(apiKey)
    )

    return {
      salt: toBase64(salt),
      iv: toBase64(iv),
      ciphertext: toBase64(new Uint8Array(ciphertext)),
      iterations
    }
  }

  async function decryptApiKey (payload, passphrase) {
    if (!payload || !payload.salt || !payload.iv || !payload.ciphertext) {
      throw new Error('Invalid payload.')
    }

    const cryptoRef = getCrypto()
    const decoder = getTextDecoder()
    const salt = fromBase64(payload.salt)
    const iv = fromBase64(payload.iv)
    const ciphertext = fromBase64(payload.ciphertext)
    const iterations = payload.iterations || DEFAULT_ITERATIONS
    const key = await deriveKey(passphrase, salt, iterations)
    const plaintext = await cryptoRef.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    )

    return decoder.decode(plaintext)
  }

  function generateSecret (length) {
    const cryptoRef = getCrypto()
    const bytes = cryptoRef.getRandomValues(new Uint8Array(length || 32))
    return toBase64(bytes)
  }

  return {
    supportsWebCrypto,
    encryptApiKey,
    decryptApiKey,
    generateSecret
  }
})

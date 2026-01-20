const { expect } = require('chai')

if (!globalThis.crypto) {
  globalThis.crypto = require('crypto').webcrypto
}

if (typeof TextEncoder === 'undefined') {
  const util = require('util')
  global.TextEncoder = util.TextEncoder
  global.TextDecoder = util.TextDecoder
}

const aiKeyUtils = require('../views/assets/js/aiKeyUtils')

describe('AIKeyUtils', () => {
  it('round-trips encryption and decryption with a generated secret', async () => {
    const secret = aiKeyUtils.generateSecret()
    const payload = await aiKeyUtils.encryptApiKey('sk-test', secret)
    const decrypted = await aiKeyUtils.decryptApiKey(payload, secret)
    expect(decrypted).to.equal('sk-test')
  })

  it('fails to decrypt with the wrong secret', async () => {
    const secret = aiKeyUtils.generateSecret()
    const payload = await aiKeyUtils.encryptApiKey('sk-test', secret)
    let error = null
    try {
      await aiKeyUtils.decryptApiKey(payload, 'wrong-secret')
    } catch (err) {
      error = err
    }
    expect(error).to.exist
    expect(error.name).to.be.a('string')
  })
})

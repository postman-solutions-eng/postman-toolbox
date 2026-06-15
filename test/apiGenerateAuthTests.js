const { expect } = require('chai')

// Force a fresh app instance with server-AI enabled so we exercise the auth path.
// The existing aiServerGatingTests.js loads the app with ENABLE_SERVER_AI=false;
// we drop it from the require cache so this file's enableServerAi=true sticks.
delete require.cache[require.resolve('../app')]
const previousEnableServerAi = process.env.ENABLE_SERVER_AI
process.env.ENABLE_SERVER_AI = 'true'

const app = require('../app')

describe('/api/generate Authorization handling', () => {
  let server, baseUrl

  before(() => {
    server = app.listen(0)
    baseUrl = `http://127.0.0.1:${server.address().port}`
  })

  after(() => {
    server.close()
    process.env.ENABLE_SERVER_AI = previousEnableServerAi
    delete require.cache[require.resolve('../app')]
  })

  it('returns 401 when Authorization header is missing', async () => {
    const res = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: 'hi' })
    })
    expect(res.status).to.equal(401)
    const body = await res.json()
    expect(body.error).to.match(/Authorization/i)
  })

  it('returns 401 when Authorization header has no Bearer scheme', async () => {
    const res = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'sk-this-is-not-bearer-prefixed'
      },
      body: JSON.stringify({ prompt: 'hi' })
    })
    expect(res.status).to.equal(401)
  })

  it('returns 401 when bearer token is empty/whitespace', async () => {
    const res = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer    '
      },
      body: JSON.stringify({ prompt: 'hi' })
    })
    expect(res.status).to.equal(401)
  })

  it('returns 400 when prompt is missing but Authorization is present', async () => {
    const res = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer sk-irrelevant'
      },
      body: JSON.stringify({})
    })
    expect(res.status).to.equal(400)
  })

  it('returns 413 when prompt exceeds the 4000 character cap', async () => {
    const res = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer sk-irrelevant'
      },
      body: JSON.stringify({ prompt: 'x'.repeat(4001) })
    })
    expect(res.status).to.equal(413)
  })
})

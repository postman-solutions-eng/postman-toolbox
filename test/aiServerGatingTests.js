const { expect } = require('chai')

process.env.ENABLE_SERVER_AI = 'false'

const app = require('../app')

describe('AI server gating', () => {
  let server
  let baseUrl

  before(() => {
    server = app.listen(0)
    const address = server.address()
    baseUrl = `http://127.0.0.1:${address.port}`
  })

  after(() => {
    server.close()
  })

  it('returns 501 when server AI is disabled', async () => {
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: 'test prompt'
      })
    })

    expect(response.status).to.equal(501)
    const data = await response.json()
    expect(data.error).to.match(/disabled/i)
  })
})

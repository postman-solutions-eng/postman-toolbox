const { expect } = require('chai')
const fs = require('fs')
const os = require('os')
const path = require('path')

process.env.ENABLE_SERVER_AI = 'false'

const { writeFunctions } = require('../lib/spectral')
const app = require('../app')

const VALID_FN_BODY = 'export default input => { if (input !== "x") return [{ message: "no" }]; };'

function makeWorkDir () {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'sec-test-'))
}

describe('Security: writeFunctions AST checks', () => {
  let workDir

  beforeEach(() => { workDir = makeWorkDir() })
  afterEach(() => { fs.rmSync(workDir, { recursive: true, force: true }) })

  const evilCases = [
    { name: 'require()', code: '//function: a\nconst x = require("fs");', match: /require/ },
    { name: 'process global', code: '//function: a\nexport default () => process.env;', match: /process/ },
    { name: 'globalThis', code: '//function: a\nexport default () => globalThis;', match: /globalThis/ },
    { name: 'eval', code: '//function: a\nexport default () => eval("1+1");', match: /eval/ },
    { name: 'Function constructor', code: '//function: a\nexport default () => new Function("return 1")();', match: /Function/ },
    { name: 'constructor member', code: '//function: a\nexport default () => "".constructor.constructor("return process")();', match: /constructor/ },
    { name: '__proto__ member', code: '//function: a\nexport default () => ({}).__proto__;', match: /__proto__/ },
    { name: 'prototype member', code: '//function: a\nexport default () => Object.prototype;', match: /prototype/ },
    { name: 'computed constructor', code: '//function: a\nexport default () => ""["constructor"];', match: /constructor/ },
    { name: 'import statement', code: '//function: a\nimport fs from "fs";\nexport default () => {};', match: /import/i },
    { name: 'dynamic import', code: '//function: a\nexport default () => import("fs");', match: /import/i },
    { name: 'child_process identifier', code: '//function: a\nexport default () => child_process;', match: /child_process/ },
    { name: '__dirname', code: '//function: a\nexport default () => __dirname;', match: /__dirname/ }
  ]

  evilCases.forEach(({ name, code, match }) => {
    it(`rejects ${name}`, async () => {
      let err
      try { await writeFunctions(code, workDir) } catch (ex) { err = ex }
      expect(err, 'expected rejection').to.exist
      expect(err.message).to.match(match)
      // file must not exist on disk
      expect(fs.existsSync(path.join(workDir, 'functions', 'a.js'))).to.equal(false)
    })
  })

  it('rejects path traversal in function name', async () => {
    let err
    try { await writeFunctions('//function: ../../etc/passwd\n' + VALID_FN_BODY, workDir) } catch (ex) { err = ex }
    expect(err).to.exist
    expect(err.message).to.match(/Invalid function name/)
  })

  it('rejects function name with slash', async () => {
    let err
    try { await writeFunctions('//function: foo/bar\n' + VALID_FN_BODY, workDir) } catch (ex) { err = ex }
    expect(err).to.exist
    expect(err.message).to.match(/Invalid function name/)
  })

  it('rejects unparseable JS', async () => {
    let err
    try { await writeFunctions('//function: a\nexport default () => {{{', workDir) } catch (ex) { err = ex }
    expect(err).to.exist
    expect(err.message).to.match(/Failed to parse/)
  })

  it('accepts a legitimate function and writes it to disk', async () => {
    const fileNames = await writeFunctions('//function: ok\n' + VALID_FN_BODY, workDir)
    expect(fileNames).to.have.lengthOf(1)
    const expectedPath = path.join(workDir, 'functions', 'ok.js')
    expect(fileNames[0]).to.equal(expectedPath)
    expect(fs.existsSync(expectedPath)).to.equal(true)
  })

  it('blocks a multi-function payload if any function is evil', async () => {
    const code = [
      '//function: ok',
      VALID_FN_BODY,
      '//function: evil',
      'export default () => process.env;'
    ].join('\n')
    let err
    try { await writeFunctions(code, workDir) } catch (ex) { err = ex }
    expect(err).to.exist
    // neither file should have been written
    expect(fs.existsSync(path.join(workDir, 'functions', 'ok.js'))).to.equal(false)
    expect(fs.existsSync(path.join(workDir, 'functions', 'evil.js'))).to.equal(false)
  })
})

describe('Security: HTTP layer', () => {
  let server, baseUrl

  before(() => {
    server = app.listen(0)
    baseUrl = `http://127.0.0.1:${server.address().port}`
  })

  after(() => { server.close() })

  it('sets a Content-Security-Policy header', async () => {
    const res = await fetch(`${baseUrl}/`)
    expect(res.headers.get('content-security-policy')).to.be.a('string')
    expect(res.headers.get('content-security-policy')).to.match(/default-src 'self'/)
  })

  it('sets X-Content-Type-Options: nosniff', async () => {
    const res = await fetch(`${baseUrl}/`)
    expect(res.headers.get('x-content-type-options')).to.equal('nosniff')
  })

  it('does not set Access-Control-Allow-Origin for unknown origin', async () => {
    const res = await fetch(`${baseUrl}/`, { headers: { Origin: 'https://evil.example' } })
    expect(res.headers.get('access-control-allow-origin')).to.equal(null)
  })

  it('rejects POST /validate from a foreign origin with 403', async () => {
    const res = await fetch(`${baseUrl}/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Origin: 'https://evil.example'
      },
      body: 'spectralRule=x&openApiSpec=y'
    })
    expect(res.status).to.equal(403)
    const body = await res.json()
    expect(body.error).to.match(/cross-origin/i)
  })

  it('rejects POST /api/generate from a foreign origin with 403', async () => {
    const res = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://evil.example'
      },
      body: JSON.stringify({ prompt: 'hi' })
    })
    expect(res.status).to.equal(403)
  })

  it('allows POST /validate with a same-origin Origin header', async () => {
    const res = await fetch(`${baseUrl}/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Origin: baseUrl
      },
      body: 'spectralRule=&openApiSpec='
    })
    // CSRF guard passes; the empty ruleset triggers a 500 from the validator.
    // The key thing is we did NOT get a 403.
    expect(res.status).to.not.equal(403)
  })

  it('allows POST /validate with no Origin header (non-browser caller)', async () => {
    const res = await fetch(`${baseUrl}/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'spectralRule=&openApiSpec='
    })
    expect(res.status).to.not.equal(403)
  })

  it('does not publicly serve prompts/system.json', async () => {
    const res = await fetch(`${baseUrl}/prompts/system.json`)
    expect(res.status).to.equal(404)
  })

  it('rejects bodies over the 5MB urlencoded cap with 413', async () => {
    const huge = 'x'.repeat(6 * 1024 * 1024) // 6 MB
    const res = await fetch(`${baseUrl}/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `spectralRule=${huge}`
    })
    expect(res.status).to.equal(413)
  })

  it('returns 500 and cleans up workDir when custom functions are malicious', async () => {
    const tmpBefore = new Set(fs.readdirSync(os.tmpdir()).filter(n => n.startsWith('spectral-')))

    const params = new URLSearchParams()
    params.set('spectralRule', 'functions: [evil]\nrules: {}')
    params.set('openApiSpec', 'openapi: 3.0.0')
    params.set('spectralCustomFunctions', '//function: evil\nrequire("fs");')

    const res = await fetch(`${baseUrl}/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    })
    expect(res.status).to.equal(500)
    const body = await res.json()
    expect(body.message).to.match(/forbidden identifier "require"/)

    // No leftover spectral-* dir from this request
    const tmpAfter = new Set(fs.readdirSync(os.tmpdir()).filter(n => n.startsWith('spectral-')))
    for (const dir of tmpAfter) {
      expect(tmpBefore.has(dir), `leftover workDir not cleaned up: ${dir}`).to.equal(true)
    }
  })
})

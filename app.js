const express = require('express')
const exphbs = require('express-handlebars')
const fs = require('fs')
const os = require('os')
const path = require('path')
const helmet = require('helmet')
const validate = require('./lib/spectral').validate
const writeFunctions = require('./lib/spectral').writeFunctions
const rateLimit = require('express-rate-limit')
const { OpenAI } = require('openai')
const { v4: uuidv4 } = require('uuid')

const MAX_PROMPT_LENGTH = 4000

// Comma-separated origin allowlist. Empty = same-origin only (no CORS header).
const corsAllowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean)

const apiLimiter = rateLimit({
	windowMs: 1 * 60 * 1000, // 1 minute
	max: 5, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
	standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
	legacyHeaders: false, // Disable the `X-RateLimit-*` headers
	message: async (request, response) => {
    console.log(new Date(), 'AI RateLimit - User hit the rate limit.')
		return 'You can only make 5 requests every minute.'
	},
})

const validateLimiter = rateLimit({
	windowMs: 1 * 60 * 1000,
	max: 20,
	standardHeaders: true,
	legacyHeaders: false,
	message: async (request, response) => {
    console.log(new Date(), 'Validate RateLimit - User hit the rate limit.')
		return 'You can only make 20 validate requests every minute.'
	},
})

const enableServerAi = /^true$/i.test(process.env.ENABLE_SERVER_AI || '')
const systemPromptPath = path.join(__dirname, 'prompts', 'system.json')
let systemPrompt = ''

try {
  const promptFile = fs.readFileSync(systemPromptPath, 'utf8')
  const parsedPrompt = JSON.parse(promptFile)
  systemPrompt = parsedPrompt && parsedPrompt.content ? parsedPrompt.content : ''
} catch (err) {
  console.log(new Date(), 'AI Error - Failed to load system prompt.', err)
}

let app = express()
let hbs = exphbs.create({
  defaultLayout: 'main',
  extname: '.hbs',
  layoutsDir: `${__dirname}/views/layouts`
})

// Trust proxy depth: integer (number of proxies in front). Default 0 (none).
// Set TRUST_PROXY_HOPS=1 if behind a single load balancer.
const trustProxyHops = parseInt(process.env.TRUST_PROXY_HOPS || '0', 10)
app.set('trust proxy', Number.isFinite(trustProxyHops) ? trustProxyHops : 0)

// Security headers. CSP allows the CDN script/style hosts the views currently load
// and 'unsafe-inline' for the existing inline scripts/handlers/styles.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      // 'unsafe-eval' is needed because Handlebars.compile() runs in the browser
      // (see views/assets/js/testComposer.js) and uses new Function() internally.
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https://cdn.jsdelivr.net', 'https://cdnjs.cloudflare.com'],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
      imgSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", 'https://cdn.jsdelivr.net', 'https://cdnjs.cloudflare.com', 'data:'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      frameAncestors: ["'self'"]
    }
  },
  crossOriginEmbedderPolicy: false
}))

//Set the static files directory
app.use(express.static(`${__dirname}/views/assets`))
app.use((req, res, next) => {
  res.locals.enableServerAi = enableServerAi
  next()
})


//Set the view engine
app.engine('hbs', hbs.engine)
app.set('view engine', 'hbs')

app.use((req, res, next) => {
  const origin = req.headers.origin
  if (origin && corsAllowedOrigins.includes(origin)) {
    res.append('Access-Control-Allow-Origin', origin)
    res.append('Vary', 'Origin')
  }
  next()
})

// CSRF guard for state-changing routes. Browsers always send an Origin header
// on cross-origin POSTs; if it's present and doesn't match this server or the
// allowlist, the request is from a third-party page acting on a user's behalf.
// Non-browser callers (curl, server-to-server) don't send Origin, so those pass.
function requireSameOrigin (req, res, next) {
  const origin = req.headers.origin
  if (!origin) return next()
  const selfOrigin = `${req.protocol}://${req.headers.host}`
  if (origin === selfOrigin || corsAllowedOrigins.includes(origin)) return next()
  console.log(new Date(), `Forbidden cross-origin POST to ${req.path} from ${origin}`)
  return res.status(403).json({ error: 'Forbidden: cross-origin request.' })
}

const validateBodyParser = express.urlencoded({ limit: '5mb', extended: true })

// render the main.hbs layout and the index.hbs file
app.get('/', (req, res) => {
  res.render('index');
  console.log(new Date(), 'Index - Page View.')
});

// redirect when there is a trailing slash - was causing issues with relative paths.
app.get('\\S+\/$', function (req, res) {
  return res.redirect(301, req.path.slice(0, -1) + req.url.slice(req.path.length));
});

app.get('/governance-playground', (req, res) => {
  res.render('governance-playground');
  console.log(new Date(), 'Governance Playground - Page View.')
});
app.get('/test-composer', (req, res) => {
  res.render('test-composer');
  console.log(new Date(), 'Test Composer - Page View.')
});
app.get('/test-reporter', (req, res) => {
  res.render('test-reporter');
  console.log(new Date(), 'Test Reporter - Page View.')
});

app.get('/ip', (request, response) => response.send(request.ip))

// render the main.hbs layout and the index.hbs file
app.post('/api/generate', requireSameOrigin, apiLimiter, express.json({ limit: '64kb' }), (req, res) => {
  if (!enableServerAi) {
    return res.status(501).json({
      error: 'Server-side AI is disabled.'
    })
  }

  if (!systemPrompt) {
    return res.status(500).json({
      error: 'System prompt is unavailable.'
    })
  }

  const authHeader = req.headers.authorization || ''
  const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i)
  if (!bearerMatch) {
    return res.status(401).json({
      error: 'Missing or malformed Authorization header. Expected: Bearer <api-key>.'
    })
  }
  const apiKey = bearerMatch[1].trim()
  if (!apiKey) {
    return res.status(401).json({
      error: 'Missing API key.'
    })
  }

  let body = req.body

  if (!body || typeof body.prompt !== 'string' || body.prompt.length === 0) {
    res.status(400).json({
      error: 'No prompt provided.'
    })
  } else if (body.prompt.length > MAX_PROMPT_LENGTH) {
    res.status(413).json({
      error: `Prompt too long. Maximum ${MAX_PROMPT_LENGTH} characters.`
    })
  } else {
    const openai = new OpenAI({ apiKey })
    openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            "role": "system",
            "content": systemPrompt
          },
          {
            role: 'user',
            content: body.prompt
          }
        ]
      })
      .then(aiResponse => {
        if(aiResponse && aiResponse.choices && aiResponse.choices.length > 0) {

          let unknownResponse = "Sorry I do not know the answer.";

          if(aiResponse.choices[0].message.content == unknownResponse) {
            console.log(new Date(), 'AI Unknown - AI returned the unknown response.')
          } else {
            console.log(new Date(), 'AI Success - Prompt worked as expected.')
          }

          //We have a choice for the response
          res.status(200).json({
            result: aiResponse.choices[0]
          })
        } else {
          console.log(new Date(), 'AI Error - No choices provided in the response.')
          throw "No choices provided in the response."
        }
      })
      .catch(err => {
        console.log(err)
        if (err && err.status === 401) {
          console.log(new Date(), 'AI Error - OpenAI rejected the API key.')
          return res.status(401).json({
            error: 'Invalid OpenAI API key.'
          })
        }
        console.log(new Date(), 'AI Error - Generic Error thrown.')
        res.status(400).json({
          error: 'Error with prompt provided.'
        })
      })
  }
})

app.post('/validate', requireSameOrigin, validateLimiter, validateBodyParser, (req, res) => {
  let spectralRule = req.body.spectralRule
  let openApiSpec = req.body.openApiSpec
  let customFunctions = req.body.spectralCustomFunctions

  const workDir = path.join(os.tmpdir(), `spectral-${uuidv4()}`)

  return writeFunctions(customFunctions, workDir)
    .then(() => validate(spectralRule, openApiSpec, workDir))
    .then(result => {
      console.log(new Date(), 'Validation Status: 200')
      res.status(200).json(result)
    })
    .catch(err => {
      console.log(new Date(), 'Validation Status: 500')
      res.status(500).json({
        error: 500,
        message: err.toString()
      })
    })
    .finally(() => {
      try {
        fs.rmSync(workDir, { recursive: true, force: true })
      } catch (ex) {
        console.log(new Date(), 'Validation - workDir cleanup failed:', ex.message)
      }
    })
})

if (require.main === module) {
  app.listen(3001, () => {
    console.log(new Date(), 'Postman Toolbox listening on port 3001!')
  })
}

module.exports = app;

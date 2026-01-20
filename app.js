const express = require('express')
const exphbs = require('express-handlebars')
const fs = require('fs')
const path = require('path')
const validate = require('./lib/spectral').validate
const writeFunctions = require('./lib/spectral').writeFunctions
const rateLimit = require('express-rate-limit')
const { OpenAI } = require('openai')

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

const enableServerAi = /^true$/i.test(process.env.ENABLE_SERVER_AI || '')
const systemPromptPath = path.join(__dirname, 'views', 'assets', 'prompts', 'system.json')
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

//Set the static files directory
app.use(express.static(`${__dirname}/views/assets`))
app.use((req, res, next) => {
  res.locals.enableServerAi = enableServerAi
  next()
})

// Apply the rate limiting middleware to API calls only
app.use('/api', apiLimiter)

//Set the view engine
app.engine('hbs', hbs.engine)
app.set('view engine', 'hbs')

app.use(
  express.urlencoded({
    limit: '50mb',
    extended: true
  })
)

app.use((req, res, next) => {
  res.append('Access-Control-Allow-Origin', ['*'])
  next()
})

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

app.set('trust proxy', 1)
app.get('/ip', (request, response) => response.send(request.ip))

// render the main.hbs layout and the index.hbs file
app.post('/api/generate', express.json(), (req, res) => {
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

  let body = req.body

  if (!body || !body.prompt) {
    res.status(400).json({
      error: 'No prompt provided.'
    })
  } else {
    const openai = new OpenAI()
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
        console.log(new Date(), 'AI Error - Generic Error thrown.')
        res.status(400).json({
          error: 'Error with prompt provided.'
        })
      })
  }
})

app.post('/validate', (req, res) => {
  let spectralRule = req.body.spectralRule
  let openApiSpec = req.body.openApiSpec
  let customFunctions = req.body.spectralCustomFunctions

  let filesToDelete = []

  return writeFunctions(customFunctions)
    .then(fileNames => {
      filesToDelete = fileNames
      return validate(spectralRule, openApiSpec)
    })
    .then(result => {
      for (let file of filesToDelete) {
        fs.unlinkSync(file)
      }
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
})

if (require.main === module) {
  app.listen(3001, () => {
    console.log(new Date(), 'Postman Toolbox listening on port 3001!')
  })
}

module.exports = app;

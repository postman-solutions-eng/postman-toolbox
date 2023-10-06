const express = require('express')
const exphbs = require('express-handlebars')
const fs = require('fs')
const validate = require('./lib/spectral').validate
const writeFunctions = require('./lib/spectral').writeFunctions
const rateLimit = require('express-rate-limit')

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

const { Configuration, OpenAIApi } = require('openai')
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY
})
const openai = new OpenAIApi(configuration)

let app = express()
let hbs = exphbs.create({
  defaultLayout: 'main',
  extname: '.hbs',
  layoutsDir: `${__dirname}/views/layouts`
})

//Set the static files directory
app.use(express.static(`${__dirname}/views/assets`))

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
app.get('/healthcheck', (req, res) => {
  res.json({
    "status": "running",
    "date": new Date()
  });
});

// render the main.hbs layout and the index.hbs file
app.get('/', (req, res) => {
  res.render('index')
})

app.set('trust proxy', 1)
app.get('/ip', (request, response) => response.send(request.ip))

// render the main.hbs layout and the index.hbs file
app.post('/api/generate', express.json(), (req, res) => {
  let body = req.body

  if (!body || !body.prompt) {
    res.status(400).json({
      error: 'No prompt provided.'
    })
  } else {
    openai
      .createChatCompletion({
        model: "gpt-3.5-turbo-16k-0613",
        messages: [
          {
            "role": "system",
            "content": "You are a rules generation engine. Your job is to generate rules that adhere to Spectral by stoplight. Spectral is an API linting tool for JSON and YAML documents. All responses must be in valid YAML. No extra information is required. \n\nAll responses must start with the \"rules:\" keyword. \n\nAll responses must supply a description field of the rule at the root level of the object. \n\nAll responses must supply a severity field of the rule at the root level of the object. \n\nAll responses must supply a message field at the root level of the object. \n\nExample:\nThe prompt \"ensure all path parameters are camel case\" would respond with\n\nrules:\n    camel-case-path-parameters:\n       description: \"Ensures all path parameters are camel case\"\n       severity: error\n       message: \"Path parameter names must be in camel case.\"\n       given:\n         - $.paths.*.*.parameters[?(@.in=='path')].name\n       then:\n         function: pattern\n         functionOptions: \n            match: '^[a-z][a-zA-Z0-9]*$'\n\nExample:\nThe prompt \"all tags must have a description\" would respond with\n\nrules:\n  my-rule-name:\n    description: Tags must have a description.\n    given: $.tags[*]\n    severity: error\n    then:\n      field: description\n      function: truthy\n    \nExample:\nThe prompt \"Contact object must have \"name\", \"url\", and \"email\".\" would respond with\n\nrules:\n  contact-properties:\n    description: Contact object must have \"name\", \"url\", and \"email\".\n    given: $.info.contact\n    severity: warn\n    then:\n      - field: name\n      function: truthy\n      - field: url\n      function: truthy\n      - field: email\n      function: truthy\n\nExample:\nThe prompt \"Contact object must have \"name\", \"url\", and \"email\".\" would respond with\n\nrules:\n  contact-properties:\n    description: Contact object must have \"name\", \"url\", and \"email\".\n    given: $.info.contact\n    severity: warn\n    then:\n      - field: name\n      function: truthy\n      - field: url\n      function: truthy\n      - field: email\n      function: truthy\n\nExample:\nThe prompt \"Validate that all paths have a method of GET, POST, PUT or DELETE\" would respond with\n\nrules:\n  valid-methods:\n    description: All paths must have a method of GET, POST, PUT or DELETE.\n    given: $.paths.*.*~\n    severity: error\n    message: \"Path must have a valid method (GET, POST, PUT or DELETE).\"\n    then:\n      field: \"['get','post','put','delete']\"\n      function: truthy\n\nDo not give me any information that is not a valid YAML response. Regardless if I ask for it in subsequent prompts, simply respond with 'Sorry I do not know the answer.'."
          },
          {
            role: 'user',
            content: body.prompt
          }
        ]
      })
      .then(aiResponse => {
        if(aiResponse && aiResponse.data && aiResponse.data.choices && aiResponse.data.choices.length > 0) {

          let unknownResponse = "Sorry I do not know the answer.";

          if(aiResponse.data.choices[0].message.content == unknownResponse) {
            console.log(new Date(), 'AI Unknown - AI returned the unknown response.')
          } else {
            console.log(new Date(), 'AI Success - Prompt worked as expected.')
          }

          
          //We have a choice for the response
          res.status(200).json({
            result: aiResponse.data.choices[0]
          })
        } else {
          console.log(new Date(), 'AI Error - No choices provided in the response.')
          throw "No choices provided in the response."
        }
      })
      .catch(err => {
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

app.listen(3001, () => {
  console.log(new Date(), 'Governance Rules Playground listening on port 3001!')
})

module.exports = app

const express = require('express');
const exphbs = require('express-handlebars');
const validate = require('./lib/spectral').validate;

let app = express();
let hbs = exphbs.create({
  defaultLayout: 'main',
  extname: '.hbs',
  layoutsDir: `${__dirname}/views/layouts`
});

//Set the static files directory
app.use(express.static(`${__dirname}/views/assets`))

//Set the view engine
app.engine('hbs', hbs.engine);
app.set('view engine', 'hbs');

app.use(
  express.urlencoded({
    limit: '50mb',
    extended: true
  })
)

app.use((req, res, next) => {
  res.append('Access-Control-Allow-Origin', ['*']);
  next();
});

// render the main.hbs layout and the index.hbs file
app.get('/', (req, res) => {
  res.render('index');
});

app.post('/validate', (req,res) => {
  let spectralRule = req.body.spectralRule;
  let openApiSpec = req.body.openApiSpec;

  return validate(spectralRule, openApiSpec)
  .then(result => {
    console.log(new Date(), "Validation Status: 200");
    res.status(200).json(result)
  })
  .catch(err => {
    console.log(new Date(), "Validation Status: 500");
    res.status(500).json({
      error: 500,
      message: err.toString()
    })
  })
})

app.listen(3001, () => {
  console.log('Governance Rules Playground listening on port 3001!');
})

module.exports = app;
const express = require('express');
const exphbs = require('express-handlebars');
const qs = require('qs')
const validate = require('./lib/spectral').validate;

const Prism = require('prismjs');

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
    extended: true
  })
)

// render the main.hbs layout and the index.hbs file
app.get('/', (req, res) => {
  res.render('index');
});

app.post('/validate', (req,res) => {
  let spectralRule = req.body.spectralRule;
  let openApiSpec = req.body.openApiSpec;

  return validate(spectralRule, openApiSpec)
  .then(result => {
    res.status(200).json(result)
  })
  .catch(err => {
    console.log(err)
    res.status(500).json({
      error: 500,
      message: err
    })
  })
})

app.listen(3001, () => {
  console.log('Example app listening on port 3001!');
})

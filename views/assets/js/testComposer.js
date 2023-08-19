
//data containers referenced across this entire component
let testFormData = [];

//invoke initial call handleJSONInput to put meaningful data on the user's screen
handleJSONInput();

// This function is the initial entry point of functionality for the Test Composer.   Upon a user entering valid JSON,
// this function generates data structure upon which this entire page is reliant (testFormData array), generates the test
// composition form, registers event listeners upon the various fields within that form, and invokes the generation
// of the chai assertions.

function handleJSONInput() {
  //zero out testFormData field in case user uses this tool multiple times in a row
  testFormData = []
  let json;
  try {

    json = JSON.parse(jsonEditor.getValue())
    //temporarily remove event handler so we can modify the json (aka beautify it)
    jsonEditor.getSession().off('change', debouncedHandleJSONInput)
    //beautify input
    let cursorPos = jsonEditor.getCursorPosition()
    jsonEditor.setValue(JSON.stringify(json, null, 2))
    jsonEditor.clearSelection()
    jsonEditor.moveCursorTo(cursorPos.row, cursorPos.column)
    //restore listener
    jsonEditor.getSession().on('change', debouncedHandleJSONInput)

    generateForm(json)

    //load template
    let template = Handlebars.compile("<ul>{{> list}}</ul>")

    //render template
    document.getElementById('testFormContainer').innerHTML = template({items: testFormData});

    //register listeners for each input field
    _.forEach(testFormData, function(formEntry, index) {

      let conditionSelect = document.getElementById('conditionSelect' + index)
      let propertyNameTextBox = document.getElementById('propertyName' + index)

      conditionSelect.addEventListener('input', event => {
        testFormData[index].condition = conditionSelect.options[conditionSelect.selectedIndex].value;
        generateChaiAssertions()
      })
      propertyNameTextBox.addEventListener('input', event => {
        testFormData[index].value = propertyNameTextBox.value;
        generateChaiAssertions()
      })
    })
    //generate initial set of assertions
    generateChaiAssertions()
  }
  catch (e) {
    document.getElementById('testFormContainer').innerHTML = "Invalid JSON.   Please provide a valid JSON document";
  }
}

//recursive function that generates form entries based on the JSON payload provided by the user
function generateForm(obj, path) {
  if (!path) {path = ""}
  _.each(obj, function (value, key) {

    // object keys in json must ALWAYS be strings.  Consequently, if you see a numeric key, it means you are in an array
    // or have a key in the form of:
    // testObject: {
    //    "name": "Grey"
    //      "10": "the key for this value is 10"
    // }
    // In both cases, the appropriate way to index to this value is with bracket notation i.e. testObject[10]
    if (_.isNumber(key) && path !== "") {
      key = "[" + key + "]"
    }
    //if key has spaces
    else if (_.isString(key) && _.includes(key, ' ')) {
      key = "[\"" + key + "\"]"
    }
    else if (path !== "") {
      key = "." + key
    }

    //note that due to Handlebars' comparatively primitive templating logic, one cannot easily do comparisons for the purposes
    //of displaying a template.  AKA I can not test for the value of the "type" property without writing a hacky "helper function".
    // Consequently, I had to add a seemingly superfluous field called 'formValueFieldEnabled' to give the templating logic
    // something to test for to determine whether the value field should be enabled (or not) in the form
    if (_.isObject(value)) {
      testFormData.push({propertyName: path === "" ? key : path + key, formValueFieldEnabled: false, condition: '.to.exist', type: 'object'});
      generateForm(value, path === "" ? key : path + key)
    } else {
      if (_.isNumber(value)) {
        testFormData.push({propertyName: path === "" ? key : path + key, formValueFieldEnabled: true, condition: '.to.equal', type: 'number', value: value});
      }
      if (_.isString(value)) {
        testFormData.push({propertyName: path === "" ? key : path + key, formValueFieldEnabled: true, condition: '.to.equal', type: 'string', value: value});
      }
    }
  });
}

//generate assertions based on data in the form
function generateChaiAssertions () {
  let chaiAssertions = _.map(testFormData, function (formEntry) {
    if (formEntry.type === 'object') {
      return 'expect(' + formEntry.propertyName + ')' + formEntry.condition + '();';
    }
    if (formEntry.type === 'string') {
      return 'expect(' + formEntry.propertyName + ')' + formEntry.condition + '("' + formEntry.value + '");';
    }
    if (formEntry.type === 'number') {
      return 'expect(' + formEntry.propertyName + ')' + formEntry.condition + '(' + formEntry.value + ');';
    }
  })
  testJSEditor.setValue(_.join(chaiAssertions, '\n\n'))
}

//////////////////////////////////////
// Initialization and Setup Section //
//////////////////////////////////////

//Initialize/Config Editors
ace.require('ace/ext/language_tools')
let jsonEditor = ace.edit('testComposerJSONPayload')
jsonEditor.setTheme('ace/theme/monokai')
jsonEditor.session.setMode('ace/mode/json')
jsonEditor.session.setTabSize(2)
jsonEditor.session.setUseSoftTabs(true)
jsonEditor.setOptions({
  enableBasicAutocompletion: true,
  enableSnippets: true,
  enableLiveAutocompletion: false
})
let testJSEditor = ace.edit('testJS')
testJSEditor.setTheme('ace/theme/monokai')
testJSEditor.session.setMode('ace/mode/javascript')
testJSEditor.session.setTabSize(2)
testJSEditor.session.setUseSoftTabs(true)
testJSEditor.setOptions({
  enableBasicAutocompletion: true,
  enableSnippets: true,
  enableLiveAutocompletion: false
})



//Debounce handleJSONInput so that we aren't regenerating the form on every single keystroke
let debouncedHandleJSONInput = debounceAFunction(handleJSONInput, 300)

//Register Event Listeners for JSON Editor
jsonEditor.getSession().on('change', debouncedHandleJSONInput)

//Debouncer
function debounceAFunction(functionToDebounce, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      functionToDebounce(...args);
    }, delay);
  };
}

//Register partial template for use in form
Handlebars.registerPartial('list', "                                                                        \
      {{#each items}}                                                                                                     \
        <div class='row'>                                                                                                 \
          <div class='form-group col-sm-5\'>                                                                              \
            <input type='text' class='form-control form-control-sm' id='propertyName' readonly='true' value={{propertyName}}> \
          </div>                                                                                                          \
          <div class=\"form-group col-sm-3\">                                                                             \
            <select class=\"form-control-sm\" id=\"conditionSelect{{@index}}\">                                           \
              {{#if formValueFieldEnabled}}                                                                                           \
              <option value = '.to.equal'>=</option>                                                                          \
              <option value = '.to.be.above'>&gt;</option>                                                                       \
              <option value = '.to.be.below'>&lt;</option>                                                                       \
              {{else}}                                                                                                    \
                <option value = '.to.exist'>Exists</option>                                                                   \
                <option value = '.to.not.exist'>!Exists</option>                                                              \
              {{/if}}                                                                                                     \
            </select>                                                                                                     \
          </div>                                                                                                          \
          <div class=\"form-group col-sm-4\">                                                                             \
            {{#if value}}                                                                                                 \
            <input type=\"text\" class=\"form-control form-control-sm\" id=\"propertyName{{@index}}\" value='{{value}}'> \
            {{else}}                                                                                                      \
            <input type=\"text\" class=\"form-control form-control-sm\" id=\"propertyName{{@index}}\" disabled=\"true\">  \
            {{/if}}                                                                                                       \
          </div>                                                                                                          \                                                                                                      \
        </div>                                                                                                            \                                                                                                      \
      {{/each}}                                                                                                           \
    ")


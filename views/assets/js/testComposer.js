//data containers referenced across this entire component
let testFormData = [];
let tooltips = [];

// This function is the initial entry point of functionality for the Test Composer.   Upon a user entering valid JSON,
// this function populates the data structure upon which this entire page is reliant (testFormData array), generates the test
// composition form, registers event listeners and tooltips upon the various fields within that form, and invokes the generation
// of the chai assertions.
function handleJSONInput() {
  //reset  testFormData field in case user uses this tool multiple times in a row
  testFormData = []
  let json;
  try {

    json = JSON.parse(jsonEditor.getValue())
    //temporarily remove event handler so we can modify the json (aka beautify it) without reinvoking this function
    //and causing an infinite loop
    jsonEditor.getSession().off('change', debouncedHandleJSONInput)
    //beautify input
    let cursorPos = jsonEditor.getCursorPosition()
    jsonEditor.setValue(JSON.stringify(json, null, 2))
    jsonEditor.clearSelection()
    jsonEditor.moveCursorTo(cursorPos.row, cursorPos.column)
    //restore event handler
    jsonEditor.getSession().on('change', debouncedHandleJSONInput)

    generateTestForm(json)

    //load template
    let template = Handlebars.compile("{{> list}}")
    //render template
    document.getElementById('testFormContainer').innerHTML = template({items: testFormData});

    //create tooltips on elements where the property length is longer than the textbox displaying it
    registerTooltips();

    //register listeners for each input field
    _.forEach(testFormData, function(formEntry, index) {

      let conditionSelect = document.getElementById('conditionSelect' + index)
      let propertyValueTextBox = document.getElementById('propertyValue' + index)

      conditionSelect.addEventListener('input', event => {
        testFormData[index].condition = conditionSelect.options[conditionSelect.selectedIndex].value;
        debouncedGenerateChaiAssertions()
      })
      propertyValueTextBox.addEventListener('input', event => {
        testFormData[index].value = propertyValueTextBox.value;
        debouncedGenerateChaiAssertions()
      })
    })
    //generate initial set of assertions for current JSON
    generateChaiAssertions()
  }
  catch (e) {
    document.getElementById('testFormContainer').innerHTML = "Invalid JSON.   Please provide a valid JSON document";
  }
}

//recursive function that generates form entries based on the JSON payload provided by the user
function generateTestForm(obj, path) {
  if (!path) {path = ""}
  _.each(obj, function (value, key) {

    // object keys in json must ALWAYS be strings.  Consequently, if you see a numeric key, it means you are in an array
    // or have a key in the form of:
    // testObject: {
    //    "name": "Grey"
    //      "10": "the key for this value is 10"
    // }
    // In both cases i.e. array or object, the appropriate way to index to this value is with bracket notation i.e. testObject[10]
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

    //populate testFormData array with relevant data so that the testForm and chai assertions can be rendered to the screen
    //
    //note that due to Handlebars' comparatively primitive templating logic, one cannot easily do comparisons for the purposes
    //of displaying a template.  AKA I can not test for the value of the "type" property without writing a hacky "helper function".
    // Consequently, I had to add a seemingly superfluous field called 'formValueFieldEnabled' to give the templating logic
    // something to test for to determine whether the value field should be enabled (or not) in the form
    if (_.isObject(value)) {   //note that _.isObject will pass for both arrays and objects by design, and we rely on that behavior here:
      testFormData.push({propertyName: path === "" ? key : path + key, formValueFieldEnabled: false, condition: '.to.exist', type: 'object'});
      generateTestForm(value, path === "" ? key : path + key)
    }
    else if (_.isString(value)) {
        testFormData.push({propertyName: path === "" ? key : path + key, formValueFieldEnabled: true, condition: '.to.equal', type: 'string', value: value});
    }
    //might need to eventually add clauses for all Javascript primitives.   remaining ones to be accounted for are Null, bool, undefined, Symbol, and Number.
    //for the time being I can't think of a reason to need to account for these individually, so we catch them all in this else statement.  It was originally
    //authored to address the _.isNumber usecase, but realized afterwards that this case applies to all the remaining primitives.
    else {
      testFormData.push({propertyName: path === "" ? key : path + key, formValueFieldEnabled: true, condition: '.to.equal', type: 'other', value: value});
    }
  });
}

//generate chai assertions based on data in the form
function generateChaiAssertions () {
  let chaiAssertions = _.map(testFormData, function (formEntry) {
    if (formEntry.type === 'object') {
      return 'pm.test(\'' + 'expect(' + formEntry.propertyName + ')' + formEntry.condition + '();' + '\', () => {\n  pm.expect(pm.response.' + formEntry.propertyName + ')' + formEntry.condition + '();' + '\n});';
    }
    if (formEntry.type === 'string') {
      return 'pm.test(\'' + 'expect(' + formEntry.propertyName + ')' + formEntry.condition + '("' + formEntry.value + '");' + '\', () => {\n  pm.expect(pm.response.' + formEntry.propertyName + ')' + formEntry.condition + '("' + formEntry.value + '");' + '\n});';
    }
    if (formEntry.type === 'other') {
      return 'pm.test(\'' + 'expect(' + formEntry.propertyName + ')' + formEntry.condition + '(' + formEntry.value + ');' + '\', () => {\n  pm.expect(pm.response.' + formEntry.propertyName + ')' + formEntry.condition + '(' + formEntry.value + ');' + '\n});';
    }
  })
  testJSEditor.setValue(_.join(chaiAssertions, '\n\n'))
  testJSEditor.clearSelection()
}

//////////////////////////////////////
// Initialization and Setup Section //
//////////////////////////////////////

//Initialize/Config Editors
ace.require('ace/ext/language_tools')
let jsonEditor = ace.edit('jsonEditor')
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

//Debounce functions that react to user input so we aren't running them unnecessarily (e.g. on every single keystroke)
let debouncedHandleJSONInput = debounceAFunction(handleJSONInput, 300)
let debouncedGenerateChaiAssertions = debounceAFunction(generateChaiAssertions, 300)
let debouncedRegisterTooltips = debounceAFunction(registerTooltips, 300)

//Register Event Listeners for JSON Editor
jsonEditor.getSession().on('change', debouncedHandleJSONInput)

//invoke handleJSONinput on document load
document.addEventListener('DOMContentLoaded', function() {
  handleJSONInput()
});

//watch for resizes of the testForm, so that we can recalculate tooltips
let elementToObserve = document.getElementById('testFormContainer');
let resizeObserver = new ResizeObserver(debouncedRegisterTooltips);
resizeObserver.observe(elementToObserve);


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

//create tooltips in cases where property names in the testform are cut off.
function registerTooltips () {
  //garbage collect existing tooltips - doing it this way because I believe registering a tooltip associates it with
  //the JS representation of the DOM (such that just setting the tooltips array to [] would NOT cause the garbage collector
  //to destroy them).  I have not confirmed this, but I'm doing it this way regardless because its safer
  _.each(tooltips, function(tooltip) {
    tooltip.dispose()
  })

  //resize tooltips array back to zero.
  tooltips = []

  //lookup elements with tooltip flag and register JS tooltips for them.  Specifically, we want to pop up a tooltip
  //if the property name length exceeds the length of the textbox that is displaying it
  //
  //Note that we have the textbox (input) element disabled to prevent userinput.  When an input is disabled,
  //it is noninteractive preventing us from putting tooltips on it (per bootstrap documentation).
  //Consequently, we must put the tooltip on the parent <td> element, which is indeed what I did
  //in the template (see testComposer.hbs)
  let elementsThatMightNeedToolTips = document.querySelectorAll("[data-bs-toggle='tooltip']")
  _.each(elementsThatMightNeedToolTips, function (singleElement) {
    let childInput = singleElement.querySelector('input')

    //check if they actually need tooltips
    if (childInput.scrollWidth > childInput.offsetWidth) {
      tooltips.push(new bootstrap.Tooltip(singleElement))
    }
  })
}

//Register partial template for use in form
Handlebars.registerPartial('list', "\
  <table class='table table-dark table-sm'>\
    <thead>\
      <tr>\
        <th scope='col'>Property</th>\
        <th scope='col'>Condition</th>\
        <th scope='col'>Value</th>\
      </tr>\
    </thead>\
    <tbody class='table-group-divider'>\
    {{#each items}}\
      <tr>\
      <td data-bs-toggle='tooltip' data-bs-placement=\"bottom\" data-bs-title=\"{{propertyName}}\">\
        <input type='text' class='form-control-greyedits form-control-sm-greyedits bg-dark text-white' id='propertyName{{@index}}' value='{{propertyName}}' disabled=''true>\
      </td>\
      <td>\
        <select class=\"form-control-sm-greyedits bg-dark text-white\" id=\"conditionSelect{{@index}}\">\
          {{#if formValueFieldEnabled}}\
            <option value = '.to.equal'>=</option>\
            <option value = '.to.be.above'>&gt;</option>\
            <option value = '.to.be.at.least'>&gt;=</option>\
            <option value = '.to.be.below'>&lt;</option>\
            <option value = '.to.be.at.most'>&lt;=</option>\
          {{else}}\
            <option value = '.to.exist'>Exists</option>\
            <option value = '.to.not.exist'>!Exists</option>\
          {{/if}}\
        </select>\
      </td>\
      <td>\
        {{#if value}}\
          <input type=\"text\" class=\"form-control-greyedits form-control-sm-greyedits bg-dark text-white\" id=\"propertyValue{{@index}}\" value='{{value}}'>\
        {{else}}\
          <div class=\"form-control-sm-greyedits\" id=\"propertyValue{{@index}}\">N/A</div>\
        {{/if}}\
      </td>\
      </tr>\
    {{/each}}\
  </table>\
")


//data containers referenced across this entire component
let testFormData = [];
let tooltips = {};

// This function is the initial entry point of functionality for the Test Composer.   Upon a user entering valid JSON,
// this function populates the data structure upon which this entire page is reliant (testFormData array), generates the test
// composition form, registers event listeners and tooltips upon the various fields within that form, and invokes the generation
// of the chai assertions.
function handleJSONInput() {
  //reset testFormData field in case user uses this tool multiple times in a row
  testFormData = []
  let json;
  try {
    json = JSON.parse(jsonEditor.getValue())
  }
  catch (e) {
    document.getElementById('testFormContainer').innerHTML = "Invalid JSON.   Please provide a valid JSON document";
    return
  }

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

  //register listeners for each input field
  _.forEach(testFormData, function(formEntry, index) {

    let conditionSelect = document.getElementById('conditionSelect' + index)
    let propertyValueTextBox = document.getElementById('propertyValue' + index)
    let enabledSlider = document.getElementById('enabledSlider' + index)

    //create tooltips on elements where the property length is longer than the textbox displaying it
    registerTooltips()

    conditionSelect.addEventListener('input', event => {
      testFormData[index].condition = conditionSelect.options[conditionSelect.selectedIndex].value;
      debouncedGenerateChaiAssertions();
    })
    propertyValueTextBox.addEventListener('input', event => {
      testFormData[index].propertyValue = propertyValueTextBox.value;
      debouncedGenerateChaiAssertions();
      //re-create tooltips if necessary on userinput
      propertyValueTextBox.parentNode.setAttribute('data-bs-title', propertyValueTextBox.value);
      debouncedRegisterTooltip('propertyValue' + index);
    })
    enabledSlider.addEventListener('click', event => {
      if (enabledSlider.checked) {
        testFormData[index].enabled = true;
      } else {
        testFormData[index].enabled = false;
      }
      debouncedGenerateChaiAssertions()
    })

  })
  //generate initial set of assertions for current JSON
  generateChaiAssertions()
}

//recursive function that generates form entries based on the JSON payload provided by the user
function generateTestForm(obj, path) {
  _.each(obj, function (value, key) {
    // Javascript allows you to index to entries in javascript objects and arrays (where the keys are explicitly strings or
    // integers respectively - note: technically a Javascript object can have keys that ARE NOT strings (symbols), but for the purposes
    // of a javascript object created from parsing a JSON object, all keys will be strings) using bracket notation
    // where the key is passed in EITHER as a number or a string.
    // e.g:
    // in the below object, both testObject[10] and testObject["10"] will return "the key for this value is 10" despite the fact that the
    // key is technically a string.
    //
    //  let testObject = {
    //      "name": "Grey",
    //      "10": "the key for this value is 10"
    //  }
    //
    //  Arrays function the same... myArray[10] and myArray["10"] will both return the value at index 10.
    //  However, coding conventions dictate that generally you index to properties of an object
    //  using dot notation, or bracket notation with a string value passed in... depending on whether the key/index to the value
    //  is a valid identifier or not.  (e.g. testObject.name = "grey"   or testObject["10"] = "the key for this value is 10").
    //  With arrays, you must index using bracket notation as all keys are numbers (and therefore not valid identifers,
    //  so bracket notation becomes a requirement).  By convention, this number is passed in as number, and not a string
    //  e.g. myArray[10] is generally used, not myArray["10"].
    //
    //  The code below is generating chai assertions (aka javascript code), so we are trying to account for the above
    //  conventions when generating these assertions.  The logic that is trying to account for this is below

    // account for case where the key is a number (and therefore parent object is an array)
    if (_.isNumber(key) && path) {
      key = "[" + key + "]"
    }
    // parent must be an object.... test to see if we have an invalid identifier  and if so use bracket notation with quotes
    else if (!isValidIdentifier(key)) {
      key = "[\"" + key + "\"]"
    }
    // otherwise use dot notation.
    else if (path) {
      key = "." + key
    }

    // populate testFormData array with relevant data so that the testForm and chai assertions can be rendered to the screen
    //
    // note that due to Handlebars' comparatively primitive templating logic, one cannot easily do comparisons for the purposes
    // of displaying a template.  AKA I can not test for the value of the "type" property without writing a hacky "helper function".
    // Consequently, I had to add a seemingly superfluous field called 'formValueFieldEnabled' to give the templating logic
    // something to test for to determine whether the value field should be enabled (or not) in the form
    if (_.isObject(value)) {   //note that _.isObject will pass for both arrays and objects by design, and we rely on that behavior here:
      testFormData.push({propertyName: !path ? key : path + key, formValueFieldEnabled: false, condition: '.to.exist', type: 'object', enabled: true});
      generateTestForm(value, !path ? key : path + key)
    }
    else if (_.isString(value)) {
        testFormData.push({propertyName: !path ? key : path + key, formValueFieldEnabled: true, condition: '.to.equal', type: 'string', enabled: true, propertyValue: value});
    }
    //might need to eventually add clauses for all Javascript primitives.   remaining ones to be accounted for are Null, bool, undefined, Symbol, and Number.
    //for the time being I can't think of a reason to need to account for these individually, so we catch them all in this else statement.  It was originally
    //authored to address the _.isNumber usecase, but realized afterwards that this case applies to all the remaining primitives.
    else {
      testFormData.push({propertyName: !path ? key : path + key, formValueFieldEnabled: true, condition: '.to.equal', type: 'other', enabled: true, propertyValue: value});
    }
  });
}

//generate chai assertions based on data in the form
function generateChaiAssertions () {
  let chaiAssertions = _.map(testFormData, function (formEntry) {
    if (formEntry.enabled === true) {
      if (formEntry.type === 'object') {
        return 'pm.test(\'' + 'expect(' + formEntry.propertyName + ')' + formEntry.condition + ';' + '\', () => {\n  pm.expect(pm.response' + (formEntry.propertyName.startsWith('[') ? '' : '.') + formEntry.propertyName + ')' + formEntry.condition + ';' + '\n});';
      }
      if (formEntry.type === 'string') {
        return 'pm.test(\'' + 'expect(' + formEntry.propertyName + ')' + formEntry.condition + '("' + formEntry.propertyValue + '");' + '\', () => {\n  pm.expect(pm.response' + (formEntry.propertyName.startsWith('[') ? '' : '.') + formEntry.propertyName + ')' + formEntry.condition + '("' + formEntry.propertyValue + '");' + '\n});';
      }
      if (formEntry.type === 'other') {
        return 'pm.test(\'' + 'expect(' + formEntry.propertyName + ')' + formEntry.condition + '(' + formEntry.propertyValue + ');' + '\', () => {\n  pm.expect(pm.response' + (formEntry.propertyName.startsWith('[') ? '' : '.') + formEntry.propertyName + ')' + formEntry.condition + '(' + formEntry.propertyValue + ');' + '\n});';
      }
    }
  })
  testJSEditor.setValue(_.join(_.without(chaiAssertions, undefined), '\n\n'))
  testJSEditor.clearSelection()
}

//this function recreates tooltips for all elements that require it.   Intended to be
//executed on window resize and on loading new json
function registerTooltips () {
  //cleanly destroy tooltips
  _.each(tooltips, function(tooltip) {
    tooltip.dispose()
  })

  tooltips = {}

  _.forEach(testFormData, function (formEntry, index) {
    //create tooltips (where applicable)
    registerTooltip('propertyValue' + index)
    registerTooltip('propertyName' + index)
  })
}

//this function registers (or re-registers) a single tooltip when provided the id of the tooltip
function registerTooltip(id) {
  //cleanly destroy existing tooltip
  if (tooltips[id]) {
    tooltips[id].dispose()
    delete tooltips[id]
  }

  let elementThatNeedsToolTip = document.getElementById(id)
  // the parent div is the element to which we actually assign the tooltip due to disabled elements being non-interactive
  // and therefore "untooltip-able" (according to tooltip/bootstrap documentation).   In our case the Property/PropertyName
  // textbox is disabled to prevent user input, and rather than implement logic to selectively define if we put the tooltip
  // on the textbox or on the containing element, I just decided to ALWAYS put it on the containing element
  let parentElement = elementThatNeedsToolTip.parentNode;
  //check if node actually needs a tooltip
  if (elementThatNeedsToolTip.scrollWidth > elementThatNeedsToolTip.offsetWidth) {
    tooltips[id] = new bootstrap.Tooltip(parentElement)
  }
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
let testJSEditor = ace.edit('testJSEditor')
testJSEditor.setTheme('ace/theme/monokai')
testJSEditor.session.setMode('ace/mode/javascript')
testJSEditor.session.setTabSize(2)
testJSEditor.session.setUseSoftTabs(true)
testJSEditor.setOptions({
  enableBasicAutocompletion: true,
  enableSnippets: true,
  enableLiveAutocompletion: false
})

// Create debounced versions of functions that react to user input
// so we can call them in a way that doesn't result in a repeated invocation. (e.g. on every single keystroke)
let debouncedHandleJSONInput = debounceAFunction(handleJSONInput, 300)
let debouncedGenerateChaiAssertions = debounceAFunction(generateChaiAssertions, 300)
let debouncedRegisterTooltips = debounceAFunction(registerTooltips, 300)
let debouncedRegisterTooltip = debounceAFunction(registerTooltip, 300)

//Register Event Listeners for JSON Editor
jsonEditor.getSession().on('change', debouncedHandleJSONInput)

//invoke  handleJSONinput on document load
document.addEventListener('DOMContentLoaded', function() {
  handleJSONInput()
});

//watch for resizes of the testForm, so that we can recalculate tooltips
let elementToObserve = document.getElementById('testFormContainer');
let resizeObserver = new ResizeObserver(debouncedRegisterTooltips);
resizeObserver.observe(elementToObserve);

//function to test keys in JSON object so we can know if out chai assertions can reference them via . notation, or we
//must resort to [] notation.  JS documentation says that . notation must use valid identifiers the characteristics of which
//are comprehended in this regex.
function isValidIdentifier(key) {
  let identifierRegex = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;
  return identifierRegex.test(key);
}

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

//change left panel button styles
document.getElementById('testComposerButton').classList.replace('btn-outline-light', 'btn-light');

Handlebars.registerPartial('list', "\
  <div class='row'>\
    <div class='col-5 ps-0' style='font-size: 0.8rem;'>\
      Property Name\
    </div>\
    <div class='col-3 ps-0' style='font-size: 0.8rem;'>\
      Condition\
    </div>\
    <div class='col-3 ps-0' style='font-size: 0.8rem;'>\
      Value\
    </div>\
    <div class='col-1 ps-0' style='font-size: 0.8rem;'>\
      Enable\
    </div>\
  </div>\
  {{#each items}}\
    <div class='row'>\
      <div class='col-5 ps-0'>\
        <div data-bs-toggle='tooltip' data-bs-placement='bottom' data-bs-title='{{propertyName}}'>\
          <input type='text' class='form-control form-control-sm custom-smaller-input ps-1' id='propertyName{{@index}}' value='{{propertyName}}' disabled=true>\
        </div>\
      </div>\
      <div class='col-3 ps-0'>\
        <select class='form-select form-select-sm custom-smaller-input ps-1' id='conditionSelect{{@index}}'>\
        {{#if formValueFieldEnabled}}\
          <option value = '.to.equal'>=</option>\
          <option value = '.to.not.equal'>!=</option>\
          <option value = '.to.be.above'>&gt;</option>\
          <option value = '.to.be.at.least'>&gt;=</option>\
          <option value = '.to.be.below'>&lt;</option>\
          <option value = '.to.be.at.most'>&lt;=</option>\
        {{else}}\
          <option value = '.to.exist'>Exists</option>\
          <option value = '.to.not.exist'>!Exists</option>\
        {{/if}}\
        </select>\
      </div>\
      <div class='col-3 ps-0'>\
      {{#if formValueFieldEnabled}}\
        <div data-bs-toggle='tooltip' data-bs-placement='bottom' data-bs-title='{{propertyValue}}'>\
          <input type='text' class='form-control form-control-sm custom-smaller-input ps-1' id='propertyValue{{@index}}' value='{{propertyValue}}'>\
        </div>\
      {{else}}\
        <input type='text' class='form-control form-control-sm custom-smaller-input ps-1' id='propertyValue{{@index}}' value='N/A' disabled=true>\
      {{/if}}\
      </div>\
      <div class='col-1 ps-0'>\
        <div class='form-check form-switch'>\
          <input class='form-check-input' type='checkbox' id='enabledSlider{{@index}}' checked>\
        </div>\
      </div>\
    </div>\
  {{/each}}\
")

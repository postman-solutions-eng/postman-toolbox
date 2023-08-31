//data containers referenced across this entire component
let testFormData = [];
let tooltips = {};
let currentJSON = {};

// This function is the initial entry point of functionality for the Test Composer.   Upon a user entering valid JSON,
// this function populates the data structure upon which this entire page is reliant (testFormData array), generates the test
// composition form, registers event listeners and tooltips upon the various fields within that form, and invokes the generation
// of the chai assertions.
function handleJSONInput() {
  //reset testFormData field in case user uses this tool multiple times in a row
  testFormData = []
  try {
    currentJSON = JSON.parse(jsonEditor.getValue())
  }
  catch (e) {
    document.getElementById('testFormContainer').innerHTML = "Invalid JSON.   Please provide a valid JSON document";
    return
  }

  //temporarily remove event handler that invokes handleJSONInput() (aka the function we are in right now)
  // on any change to the json payload so we can modify the json (aka beautify it) without reinvoking this function
  //and causing an infinite loop
  jsonEditor.getSession().off('change', debouncedHandleJSONInput)
  //beautify input
  let cursorPos = jsonEditor.getCursorPosition()
  jsonEditor.setValue(JSON.stringify(currentJSON, null, 2))
  jsonEditor.clearSelection()
  jsonEditor.moveCursorTo(cursorPos.row, cursorPos.column)
  //restore event handler
  jsonEditor.getSession().on('change', debouncedHandleJSONInput)

  generateTestForm(currentJSON)

  //load template
  let template = Handlebars.compile("{{> list}}")
  //render template
  document.getElementById('testFormContainer').innerHTML = template({items: testFormData});

  //register listeners for each input field
  _.forEach(testFormData, function(formEntry, index) {

    let conditionSelect = document.getElementById('conditionSelect' + index)
    let propertyValueTextBox = document.getElementById('propertyValue' + index)
    let enabledSlider = document.getElementById('enabledSlider' + index)
    let typeSelect = document.getElementById('typeSelect' + index)

    //create tooltips on elements where the property length is longer than the textbox displaying it
    registerTooltips()
    //add event handlers to the form fields.  These will reinvoke the generation of the chai assertions on any change to the form:

    //add event handlers to the dropdown menus for the condition field
    conditionSelect.addEventListener('input', event => {
      let selectedValue = conditionSelect.options[conditionSelect.selectedIndex].value;

      testFormData[index].condition = selectedValue;

      //if they select any operators that don't accept a value, then disable the value input box, and store whatever was there
      //for future restoration if they change the condition back to something that would expect a value
      if (selectedValue === '.to.exist' || selectedValue === '.to.not.exist' || selectedValue === '.to.be.true' || selectedValue === '.to.be.false' || selectedValue === '.to.be.null' || selectedValue === '.to.not.be.null') {
        if (!testFormData[index].oldValue) {
          testFormData[index].oldValue = propertyValueTextBox.value;
        }
        propertyValueTextBox.value = 'N/A';
        propertyValueTextBox.setAttribute('disabled', true)
      }
      //if they select the some other than !exist or exists operators, then enab;e  value input box, and restore
      //the old value if there was one
      else {
        propertyValueTextBox.removeAttribute('disabled')
        if (testFormData[index].oldValue) {
          propertyValueTextBox.value = testFormData[index].oldValue;
          delete testFormData[index].oldValue;
        }
      }
      debouncedGenerateChaiAssertions();
    })

    //add event handlers to the value textbox
    propertyValueTextBox.addEventListener('input', event => {
      testFormData[index].propertyValue = propertyValueTextBox.value;
      debouncedGenerateChaiAssertions();
      //re-create tooltips if necessary on userinput
      propertyValueTextBox.parentNode.setAttribute('data-bs-title', propertyValueTextBox.value);
      debouncedRegisterTooltip('propertyValue' + index);
    })

    //add event handlers to the enabled/disabled slider
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
    // integers respectively) using bracket notation where the key is passed in EITHER as a number or a string
    // For example:
    // in the below object, both testObject[10] and testObject["10"] will return "the key for this value is 10" despite the fact that the
    // key is technically a string and (in theory anyway) only testObject["10"] should work.
    //  let testObject = {
    //      "name": "Grey",
    //      "10": "the key for this value is 10"
    //  }
    //  Note: technically a Javascript object can have keys that ARE NOT strings (symbols), but for the purposes
    //  of a javascript object created from parsing a JSON object, all keys will be strings
    //
    //  Arrays function the same... myArray[10] and myArray["10"] will both return the value at index 10.
    //
    //  However, coding conventions dictate that generally you index to properties of an object
    //  using dot notation, or bracket notation with a string value passed in... depending on whether the key/index to the value
    //  is a so-called valid identifier or not.  (e.g. testObject.name = "grey"   or testObject["10"] = "the key for this value is 10").
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

    //in this series of if-elseif, we account for all the compound and primitive types available in a JSON object: array,object (compound),
    //and string,bool,number,null (primitive).
    if (_.isObject(value)) {   //note that _.isObject will pass for both arrays and objects by design, and we rely on that behavior here:
      testFormData.push({propertyName: !path ? key : path + key, condition: '.to.exist', type: 'object', enabled: true});
      generateTestForm(value, !path ? key : path + key)
    }
    else if (_.isString(value)) {
      testFormData.push({propertyName: !path ? key : path + key, condition: '.to.equal', type: 'string', enabled: true, propertyValue: value});
    }
    else if (_.isBoolean(value)) {
      testFormData.push({propertyName: !path ? key : path + key, condition: '.to.be.' + value, type: 'bool', enabled: true});
    }
    else if (_.isNumber(value)) {
      testFormData.push({propertyName: !path ? key : path + key, condition: '.to.equal', type: 'number', enabled: true, propertyValue: value});
    }
    else if (_.isNull(value)) {
      testFormData.push({propertyName: !path ? key : path + key, condition: '.to.be.null', type: 'null', enabled: true});
    }
  });
}

//generate chai assertions based on data in the form
function generateChaiAssertions () {
  let chaiAssertions = _.map(testFormData, function (formEntry) {
    if (formEntry.enabled === true) {
      if (formEntry.type === 'object' || formEntry.type === 'bool' || formEntry.type === 'null' ||  _.includes(['.to.exist','.to.not.exist'], formEntry.condition)) {
        return 'pm.test(\'' + 'expect(' + formEntry.propertyName + ')' + formEntry.condition + ';' + '\', () => {\n  pm.expect(pm.response' + (formEntry.propertyName.startsWith('[') ? '' : '.') + formEntry.propertyName + ')' + formEntry.condition + ';' + '\n});';
      }
      else if (formEntry.type === 'string') {
        return 'pm.test(\'' + 'expect(' + formEntry.propertyName + ')' + formEntry.condition + '("' + formEntry.propertyValue + '");' + '\', () => {\n  pm.expect(pm.response' + (formEntry.propertyName.startsWith('[') ? '' : '.') + formEntry.propertyName + ')' + formEntry.condition + '("' + formEntry.propertyValue + '");' + '\n});';
      }
      //account for number
      else {
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
  //cleanly destroy existing tooltips
  _.each(tooltips, function(tooltip) {
    tooltip.dispose()
  })

  tooltips = {}

  //create new tooltips (where applicable)
  _.forEach(testFormData, function (formEntry, index) {
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

//Initialize/Config ACE Editors
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

//watch for resizes of the testForm (will only happen on a resize of the browser window), so that we can recalculate tooltips
let elementToObserve = document.getElementById('testFormContainer');
let resizeObserver = new ResizeObserver(debouncedRegisterTooltips);
resizeObserver.observe(elementToObserve);

//Register Event Listeners for JSONEditor so that we can regenerate the testform
jsonEditor.getSession().on('change', debouncedHandleJSONInput)

//invoke handleJSONinput on document load
document.addEventListener('DOMContentLoaded', function() {
  handleJSONInput()
});

//change left panel button styles to indicate active page
document.getElementById('testComposerButton').classList.replace('btn-outline-light', 'btn-light');

Handlebars.registerHelper('conditionalRender', function(...args) {
  //first parameter is the value we are checking
  let contextValue = args[0];
  //second through second-to-last parmater are the valid possible values for the value we are checking
  let validValues = args.slice(1,-1);
  //last paramter is the handlebars-passed options object that we rely upon
  let options = args[args.length - 1]

  if (_.includes(validValues, contextValue)) {
    return options.fn(this); // Render the enclosed template block
  }
  else {
    return options.inverse(this); // Render the else block if present
  }
});

//This partial is responsible for rendering the initial state of the form upon a call to handleJSONInput().   Subsequent
//changes to the form (by manipulating the input fields) are handled by eventlisteners created in the handleJSONInput() function
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
      <div class='col-5 ps-0 input-group'>\
          {{#conditionalRender type 'number'}}\
          <button type='button' class='btn btn-sm btn-outline-primary custom-btn dropdown-toggle' data-bs-toggle='dropdown' id='typeSelect{{@index}}'>\
            n\
          {{/conditionalRender}}\
          {{#conditionalRender type 'string'}}\
          <button type='button' class='btn btn-sm btn-outline-success custom-btn dropdown-toggle' data-bs-toggle='dropdown' id='typeSelect{{@index}}'>\
            s\
          {{/conditionalRender}}\
          {{#conditionalRender type 'bool'}}\
          <button type='button' class='btn btn-sm btn-outline-info custom-btn dropdown-toggle' data-bs-toggle='dropdown' id='typeSelect{{@index}}'>\
            b\
          {{/conditionalRender}}\
          {{#conditionalRender type 'null'}}\
          <button type='button' class='btn btn-sm btn-outline-warning custom-btn dropdown-toggle' data-bs-toggle='dropdown' id='typeSelect{{@index}}'>\
            n\
          {{/conditionalRender}}\
          {{#conditionalRender type 'object'}}\
          <button type='button' class='btn btn-sm btn-outline-danger custom-btn dropdown-toggle' data-bs-toggle='dropdown' id='typeSelect{{@index}}'>\
            o\
          {{/conditionalRender}}\
          </button>\
          <ul class='dropdown-menu'>\
            <li><button class='dropdown-item' type='button'>Number</button></li>\
            <li><button class='dropdown-item' type='button'>String</button></li>\
            <li><button class='dropdown-item' type='button'>Bool</button></li>\
            <li><button class='dropdown-item' type='button'>Object/Array</button></li>\
          </ul>\
        <div data-bs-toggle='tooltip' data-bs-placement='bottom' data-bs-title='{{propertyName}}'>\
          <input type='text' class='form-control form-control-sm custom-smaller-textbox ps-1' id='propertyName{{@index}}' value='{{propertyName}}' disabled=true>\
        </div>\
      </div>\
      <div class='col-3 ps-0'>\
        <select class='form-select form-select-sm custom-smaller-textbox ps-1' id='conditionSelect{{@index}}'>\
        {{#conditionalRender type 'object'}}\
          <option value = '.to.exist'>Exists</option>\
          <option value = '.to.not.exist'>!Exists</option>\
        {{/conditionalRender}}\
        {{#conditionalRender type 'string'}}\
          <option value = '.to.equal'>=</option>\
          <option value = '.to.not.equal'>!=</option>\
          <option value = '.to.contain'>Contains</option>\
          <option value = '.to.not.contain'>!Contains</option>\
          <option value = '.to.exist'>Exists</option>\
          <option value = '.to.not.exist'>!Exists</option>\
        {{/conditionalRender}}\
        {{#conditionalRender type 'bool'}}\
          <option value = '.to.be.true'>isTrue</option>\
          <option value = '.to.be.false'>isFalse</option>\
          <option value = '.to.exist'>Exists</option>\
          <option value = '.to.not.exist'>!Exists</option>\
        {{/conditionalRender}}\
        \{{#conditionalRender type 'null'}}\
          <option value = '.to.be.null'>isNull</option>\
          <option value = '.to.not.be.null'>isNotNull</option>\
          <option value = '.to.exist'>Exists</option>\
          <option value = '.to.not.exist'>!Exists</option>\
        {{/conditionalRender}}\
        {{#conditionalRender type 'number'}}\
          <option value = '.to.equal'>=</option>\
          <option value = '.to.not.equal'>!=</option>\
          <option value = '.to.be.above'>&gt;</option>\
          <option value = '.to.be.at.least'>&gt;=</option>\
          <option value = '.to.be.below'>&lt;</option>\
          <option value = '.to.be.at.most'>&lt;=</option>\
          <option value = '.to.exist'>Exists</option>\
          <option value = '.to.not.exist'>!Exists</option>\
        {{/conditionalRender}}\
        </select>\
      </div>\
      <div class='col-3 ps-0'>\
      {{#conditionalRender type 'number' 'string'}}\
        <div data-bs-toggle='tooltip' data-bs-placement='bottom' data-bs-title='{{propertyValue}}'>\
          <input type='text' class='form-control form-control-sm custom-smaller-textbox ps-1' id='propertyValue{{@index}}' value='{{propertyValue}}'>\
        </div>\
      {{else}}\
        <input type='text' class='form-control form-control-sm custom-smaller-textbox ps-1' id='propertyValue{{@index}}' value='N/A' disabled=true>\
      {{/conditionalRender}}\
      </div>\
      <div class='col-1 ps-0'>\
        <div class='form-check form-switch'>\
          <input class='form-check-input' type='checkbox' id='enabledSlider{{@index}}' checked>\
        </div>\
      </div>\
    </div>\
  {{/each}}\
")



//////////////////////////////
// Utility Function Section //
//////////////////////////////

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

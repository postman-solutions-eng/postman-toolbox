//data containers referenced across this entire component
let testFormData = [];
let tooltips = {};
let validationErrors = {};

// This function is the entry point of functionality for the Test Composer.   Upon a user entering valid JSON,
// this function populates the data structure upon which this entire page is reliant (testFormData array), generates the initial state of the
// test composition form GUI, registers event listeners and tooltips upon the various fields within that form, and invokes the generation
// of the chai assertions.
function handleJSONInput() {
  //reset testFormData field in case user uses this tool multiple times in a row
  testFormData = []
  let currentJSON = {}
  try {
    currentJSON = JSON.parse(jsonEditor.getValue())
  }
  catch (e) {
    document.getElementById('testFormContainer').innerHTML = "Invalid JSON.   Please provide a valid JSON document";
    return
  }

  //temporarily remove event handler that invokes handleJSONInput() (aka the function we are in right now)
  //on any change to the json payload, so we can modify the json (aka beautify it) without reinvoking this function
  //and causing an infinite loop
  jsonEditor.getSession().off('change', debouncedHandleJSONInput)
  //beautify input
  let cursorPos = jsonEditor.getCursorPosition()
  jsonEditor.setValue(JSON.stringify(currentJSON, null, 2))
  jsonEditor.clearSelection()
  jsonEditor.moveCursorTo(cursorPos.row, cursorPos.column)
  //restore event handler
  jsonEditor.getSession().on('change', debouncedHandleJSONInput)

  //read the JSON and populate our data structure (testFormData) from which the form will be generated and from which
  //the tests will be generated
  populateTestFormData(currentJSON);

  //render template that contains initial state of the form.
  document.getElementById('testFormContainer').innerHTML = mainTemplate({items: testFormData});


  //The following section adds eventlisteners to the various DOM elements that make up the form and additionally sets
  //an initial tooltip on the text fields where the initial value is longer than the textbox containing it.
  //Each one of the aforementioned event listeners manipulates the testFormData data structure
  //and then relies on a call to renderFormEntry() to change the DOM elements to reflect the changes made to the
  //datastructure

  //setup master enable button handler
  let masterEnableSlider = document.getElementById('masterEnable')
  masterEnableSlider.addEventListener('click', (event) => {

    if (masterEnableSlider.checked) {
      _.forEach(testFormData, (formEntry, index) => {
        formEntry.currentFormData.enabled = true
        document.getElementById('enabledSlider' + index).checked = true;
      })
    }
    else {
      _.forEach(testFormData, (formEntry, index)  => {
        formEntry.currentFormData.enabled = false
        document.getElementById('enabledSlider' + index).checked = false;
      })
    }
    debouncedGenerateChaiAssertions()
  })

  //for each testForm row/entry
  _.forEach(testFormData, function(formEntry, index) {

    //locate the formEntry's DOM elements to which we need to add event listeners
    let typeSelectOptions = document.getElementById('typeSelect' + index + 'Options').children;
    let conditionSelect = document.getElementById('conditionSelect' + index)
    let propertyValueTextBox = document.getElementById('propertyValue' + index)
    let enabledSlider = document.getElementById('enabledSlider' + index)

    //Define a function that validates the input of the propertyValueTextbox for use in event listeners.
    //todo: in the future, it might be worth considering debouncing this validation logic.  Tabling for now though.
    //todo: keep in mind that if you do debounce it, you will have to ensure that it finishes executing before subsequent
    //todo: calls to debouncedGenerateChaiAssertions as these are both async calls.   (in all the event handlers, you invoke
    //todo: the validation calls immediately before you call debouncedGenerateChaiAssertions)
    function validatePropertyValueTextBoxInput(){
      if (formEntry.currentFormData.validationRegex &&   // validation regex is defined
        !_.includes(conditionsThatDoNotAcceptAProperty, formEntry.currentFormData.condition) && //condition is one that actually takes a property to validate
        !formEntry.currentFormData.validationRegex.test(propertyValueTextBox.value)) //and the property fails the regex
      {
        propertyValueTextBox.classList.add('is-invalid')

        validationErrors[propertyValueTextBox.id] = true;
        return 0;
      }
      else {
        if (validationErrors[propertyValueTextBox.id]) { delete validationErrors[propertyValueTextBox.id] };
        propertyValueTextBox.classList.remove('is-invalid')
        return 1
      }
    }

    // Define a function that validates the selected value in the conditionSelect for use in event handlers.
    // We check if the condition specified in the formEntry actually exists in the menu of options for that formEntry.
    // It should only NOT exist when a user switches types (e.g. number to string) and had previously selected a condition
    // that is not valid for the new type (e.g. 'greater than' to continue the previous example)
    //todo: in the future, it might be worth considering debouncing this validation logic.  Tabling for now though.
    //todo: keep in mind that if you do debounce it, you will have to ensure that it finishes executing before subsequent
    //todo: calls to debouncedGenerateChaiAssertions as these are both async calls.   (in all the event handlers, you invoke
    //todo: the validation calls immediately before you call debouncedGenerateChaiAssertions)
    function validateConditionSelect () {
      let optionFound = _.find(conditionSelect.options, function (option) {
        return option.value === formEntry.currentFormData.condition
      })
      if (!optionFound) {
        validationErrors[conditionSelect.id] = true;
        conditionSelect.classList.add('is-invalid');
        return 0;
      }
      else {
        if (validationErrors[conditionSelect.id]) { delete validationErrors[conditionSelect.id] };
        conditionSelect.classList.remove('is-invalid')
        return 1;
      }
    }

    //ADD EVENT LISTENERS TO THE TYPESELECT.  This select is not a true select, but rather uses bootstrap's dropdown classes
    //to implement a "pseudo-select".   Every option in this "pseudo-select" is its own unique bootstrap "button" on which we
    //must setup event listeners.  I did it this way to take advantage of better formatting/styles available on buttons than on selects:

    //for each button (aka option in the pseudo-select.  e.g. bool, string, number, object/array)
    _.each(typeSelectOptions, function(option) {

      //add a click listener and invoke the enclosed function
      option.addEventListener('click', event => {
        //remove styles that may have been applied elsewhere in code
        propertyValueTextBox.classList.remove('is-invalid')

        //copy old data for reference
        let oldFormData = _.cloneDeep(formEntry.currentFormData)

        //populate with new data (from defaults constants)
        formEntry.currentFormData = _.cloneDeep(defaultFormData[option.value])

        //override defaults with values from the old data where applicable
        formEntry.currentFormData.propertyValue = oldFormData.propertyValue
        formEntry.currentFormData.condition = oldFormData.condition
        formEntry.currentFormData.propertyName = oldFormData.propertyName
        formEntry.currentFormData.enabled = oldFormData.enabled

        //render the new form data to the screen
        renderFormEntry(index, formEntry)

        //validate the form fields since the type has been re-selected
        validatePropertyValueTextBoxInput();
        validateConditionSelect();

        //generate chai assertions based on current state
        debouncedGenerateChaiAssertions();
      })
    })

    //ADD EVENT LISTENERS TO THE CONDITION SELECT.  In contrast to the above, this select is a true select
    conditionSelect.addEventListener('change', event => {
      //update testformdata data structure with newly selected value
      formEntry.currentFormData.condition = conditionSelect.options[conditionSelect.selectedIndex].value;

      //render the new form data to the screen
      renderFormEntry(index, formEntry)

      //validate the fields since the condition has been re-selected
      validatePropertyValueTextBoxInput();
      validateConditionSelect();

      //generate chai assertions based on current state
      debouncedGenerateChaiAssertions();
    })

    //ADD EVENT LISTENERS TO THE VALUE INPUT BOX
    propertyValueTextBox.addEventListener('input', event => {

      //update testformdata data structure with newly input value
      formEntry.currentFormData.propertyValue = propertyValueTextBox.value;

      //validate input and generate appropriate tooltip:
      //check if input is valid
      if (validatePropertyValueTextBoxInput()) {
        //update tooltiptext
        propertyValueTextBox.parentNode.setAttribute('data-bs-title', propertyValueTextBox.value);
        //register tooltip
        debouncedRegisterTooltip('propertyValue' + index);
      }
      //input is not valid
      else {
        //generate an appropriate tooltip reflecting the reason for the validation error
        if (formEntry.currentFormData.validationErrorMessage) {
          propertyValueTextBox.parentNode.setAttribute('data-bs-title', formEntry.currentFormData.validationErrorMessage);
          debouncedRegisterTooltip('propertyValue' + index, true);
        }
        else {
          throw 'Encountered type without Validation Error Message.  This block of code should never be reached.  Code encountered a case that the developers did not account for.  Fix the code Postman!';
        }
      }
      // generate chai assertions based on current state
      debouncedGenerateChaiAssertions();
    })

    //ADD EVENT LISTENERS TO THE ENABLED/DISABLED SLIDER
    enabledSlider.addEventListener('click', event => {
      if (enabledSlider.checked) {
        formEntry.currentFormData.enabled = true;
      } else {
        formEntry.currentFormData.enabled = false;
      }
      debouncedGenerateChaiAssertions()
    })

    //Render initial validation status of propertyValue
    validatePropertyValueTextBoxInput()

    //create tooltips on elements where the value length is longer than the textbox displaying it
    registerTooltip('propertyValue' + index)
    registerTooltip('propertyName' + index)

  })

  //generate initial set of assertions for current JSON
  generateChaiAssertions()
}

//recursive function that generates the initial state of the form based on the JSON payload provided by the user.  This
//function is intended to be run only when the JSON input is changed.
function populateTestFormData(obj, path) {
  _.forEach(obj, function (value, key) {
    // Javascript allows you to index to entries in both javascript objects and arrays (where the keys are explicitly strings or
    // integers respectively) using bracket notation where the key is passed in EITHER as a number or a string.  JS does thos
    // via type coercion.
    // For example:
    // in the below object, both testObject[10] and testObject["10"] will return "the key for this value is 10" despite the fact that the
    // key is technically a string and only testObject["10"] should work.   Again type coercion allows either to work
    //  let testObject = {
    //      "name": "Grey",
    //      "10": "the key for this value is 10"
    //  }
    //  Note: technically a Javascript object can have keys that ARE NOT strings (symbols), but for the purposes
    //  of a javascript object created from parsing a JSON payload, all keys will be strings
    //
    //  Arrays function the same... myArray[10] and myArray["10"] will both return the value at index 10.
    //
    //  However, coding conventions dictate that generally you index to properties of an object
    //  using dot notation, or bracket notation with a string value passed in... depending on whether the key/index to the value
    //  is a so-called valid identifier or not.  (e.g. testObject.name = "grey"   or testObject["10"] = "the key for this value is 10").
    //  With arrays, you must index using bracket notation as all keys are numbers (and therefore not valid identifers,
    //  so bracket notation becomes a requirement).  Similarly, coding convention dictates that this number is passed in as number,
    //  and not a string e.g. myArray[10] is generally used, not myArray["10"].
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
    //and string,bool,number,null (primitive), and generate the initial testFormData entries.
    if (_.isObject(value)) {   //note that _.isObject will pass for both arrays and objects by design, and we rely on that behavior here:
      let newFormEntry = { currentFormData: _.cloneDeep(defaultFormData.object) };
      newFormEntry.currentFormData.propertyName = !path ? key : path + key;
      testFormData.push(newFormEntry);
      //make recursive call to do the same for child entities of this array/object
      populateTestFormData(value, !path ? key : path + key)
    }
    else if (_.isString(value)) {
      let newFormEntry = { currentFormData: _.cloneDeep(defaultFormData.string) };
      newFormEntry.currentFormData.propertyName = !path ? key : path + key;
      newFormEntry.currentFormData.propertyValue = value;
      testFormData.push(newFormEntry);
    }
    else if (_.isBoolean(value)) {
      let newFormEntry = { currentFormData: _.cloneDeep(defaultFormData.bool) };
      newFormEntry.currentFormData.propertyName = !path ? key : path + key;
      newFormEntry.currentFormData.condition = '.to.be.' + value;
      testFormData.push(newFormEntry);
    }
    else if (_.isNumber(value)) {
      let newFormEntry = { currentFormData: _.cloneDeep(defaultFormData.number) };
      newFormEntry.currentFormData.propertyName = !path ? key : path + key;
      newFormEntry.currentFormData.propertyValue = value;
      testFormData.push(newFormEntry);
    }
    //account for case where JSON contains a property with value 'null', in which case type cannot be inferred.
    else if (_.isNull(value)) {
      let newFormEntry = { currentFormData: _.cloneDeep(defaultFormData.null) };
      newFormEntry.currentFormData.propertyName = !path ? key : path + key;
      newFormEntry.currentFormData.condition = '.to.be.null';
      testFormData.push(newFormEntry);
    }
    else {
      throw 'Unexpected type encountered.  This block of code should never be reached.  Code encountered a case that the developers did not account for.  Fix the code Postman!';
    }
  });
}



//generate chai assertions based on data in testFormData.  Generally this should not be called directly, but instead the debounced version should be called
function generateChaiAssertions () {
  if (_.isEmpty(validationErrors)) {
    let chaiAssertions = _.map(testFormData, function (formEntry) {
      //change formEntry var to point to relevant data
      let formEntryData = formEntry.currentFormData

      if (formEntryData.enabled === true) {
        if (_.includes(conditionsThatDoNotAcceptAProperty, formEntryData.condition)) {
          return 'pm.test(\'' + 'expect(' + formEntryData.propertyName + ')' + formEntryData.condition + ';' + '\', () => {\n  pm.expect(apiResponse' + (formEntryData.propertyName.startsWith('[') ? '' : '.') + formEntryData.propertyName + ')' + formEntryData.condition + ';' + '\n});';
        } else if (formEntryData.type === 'string') {
          return 'pm.test(\'' + 'expect(' + formEntryData.propertyName + ')' + formEntryData.condition + '("' + formEntryData.propertyValue + '");' + '\', () => {\n  pm.expect(apiResponse' + (formEntryData.propertyName.startsWith('[') ? '' : '.') + formEntryData.propertyName + ')' + formEntryData.condition + '("' + formEntryData.propertyValue + '");' + '\n});';
        }
        //account for number
        else if (formEntryData.type === 'number') {
          return 'pm.test(\'' + 'expect(' + formEntryData.propertyName + ')' + formEntryData.condition + '(' + formEntryData.propertyValue + ');' + '\', () => {\n  pm.expect(apiResponse' + (formEntryData.propertyName.startsWith('[') ? '' : '.') + formEntryData.propertyName + ')' + formEntryData.condition + '(' + formEntryData.propertyValue + ');' + '\n});';
        } else {
          throw 'Assertion not generated.  This block of code should never be reached.  Code encountered a case that the developers did not account for.  Fix the code Postman!';
        }
      }
    })
    testJSEditor.setValue('let apiResponse = pm.response.json();\n\n' + _.join(_.without(chaiAssertions, undefined), '\n\n'))
    testJSEditor.clearSelection()
  }
  else {
    testJSEditor.setValue('//Please rectify all validation \n//errors present in the form \n//to the left')
    testJSEditor.clearSelection()
  }
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
function registerTooltip(id, force) {
  //cleanly destroy existing tooltip
  if (tooltips[id]) {
    tooltips[id].dispose()
    delete tooltips[id]
  }

  let elementThatNeedsToolTip = document.getElementById(id)
  // the parent div is the element to which we actually assign the tooltip due to disabled elements being non-interactive
  // and therefore "untooltip-able" (according to tooltip/bootstrap documentation).   In our case the Property/PropertyName
  // textbox is disabled to prevent user input, and rather than implement logic to selectively define if we put the tooltip
  // on the textbox or on the containing element, I just decided to ALWAYS put it on the containing/parent element
  let parentElement = elementThatNeedsToolTip.parentNode;

  //if force = true, then always create tooltip
  if (force) {
    tooltips[id] = new bootstrap.Tooltip(parentElement)
  }
  //otherwise check if node actually needs a tooltip (aka value in textbox is longer than textbox itself)
  else {
    if (elementThatNeedsToolTip.scrollWidth > elementThatNeedsToolTip.offsetWidth) {
      tooltips[id] = new bootstrap.Tooltip(parentElement)
    }
  }
}

function renderFormEntry(index, formEntry) {
  let typeSelect = document.getElementById('typeSelect' + index)
  let conditionSelect = document.getElementById('conditionSelect' + index)
  let propertyValueTextBox = document.getElementById('propertyValue' + index)

  let buttonColorClass = _.filter(typeSelect.classList, function(singleClass) {
    return _.includes(singleClass, 'btn-outline-');
  })
  if (buttonColorClass.length !== 1) {
    throw 'Expecting a single CSS class with prefix "btn-outline-".  This block of code should never be reached.  Code encountered a case that the developers did not account for.  Fix the code Postman!';
  }
  else {
    buttonColorClass = buttonColorClass[0]
  }

  typeSelect.innerHTML = ' ' + formEntry.currentFormData.type.substring(0, 1) + ' ';
  let newButtonColorStyle = '';
  switch (formEntry.currentFormData.type) {
    case 'number':
      newButtonColorStyle = 'primary'
      break;
    case 'string':
      newButtonColorStyle = 'success'
      break;
    case 'bool':
      newButtonColorStyle = 'info'
      break;
    case 'object':
      newButtonColorStyle = 'danger'
      break;
    case 'null':
      newButtonColorStyle = 'warning'
      break;
  }
  typeSelect.classList.replace(buttonColorClass, 'btn-outline-' + newButtonColorStyle);
  conditionSelect.innerHTML=templates[formEntry.currentFormData.type + 'ConditionOptions']();
  conditionSelect.value = formEntry.currentFormData.condition;

  if (!_.includes(conditionsThatDoNotAcceptAProperty, formEntry.currentFormData.condition)) {
    propertyValueTextBox.value = formEntry.currentFormData.propertyValue
    propertyValueTextBox.removeAttribute('disabled')
  }
  else {
    propertyValueTextBox.value = 'N/A'
    propertyValueTextBox.setAttribute('disabled', 'true')
  }
}



///////////////////////////////////////////
// Initialization - Setup/Config Section //
///////////////////////////////////////////



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
let resizeObserver = new ResizeObserver(debouncedRegisterTooltips);
resizeObserver.observe(document.getElementById('testFormContainer'));

//Register Event Listeners for JSONEditor so that we can regenerate the testform when user inputs new JSON
jsonEditor.getSession().on('change', debouncedHandleJSONInput)


//invoke initial functionality once the page loads
document.addEventListener('DOMContentLoaded', function() {
  handleJSONInput()
  //change left panel button styles to indicate active page
  document.getElementById('testComposerButton').classList.replace('btn-outline-light', 'btn-light');

  //setup master enable button
  let masterEnableSlider = document.getElementById('masterEnable')
  masterEnableSlider.addEventListener('click', (event) => {

    if (masterEnableSlider.checked) {
      _.forEach(testFormData, (formEntry, index) => {
        formEntry.currentFormData.enabled = true
        document.getElementById('enabledSlider' + index).checked = true;
      })
    }
    else {
      _.forEach(testFormData, (formEntry, index)  => {
        formEntry.currentFormData.enabled = false
        document.getElementById('enabledSlider' + index).checked = false;
      })
    }
    debouncedGenerateChaiAssertions()
  })
});



///////////////////////////////////////////////////
// Initialization - Templates/Handlebars Section //
///////////////////////////////////////////////////



//Register several partial templates so that they can be referenced in other templates.  Similarly, compile them so they
//can be invoked/called from JS code.
let templates = {}
Handlebars.registerPartial('numberConditionOptions', "\
  <option selected value = '.to.equal'>=</option>\
  <option value = '.to.not.equal'>!=</option>\
  <option value = '.to.be.above'>&gt;</option>\
  <option value = '.to.be.at.least'>&gt;=</option>\
  <option value = '.to.be.below'>&lt;</option>\
  <option value = '.to.be.at.most'>&lt;=</option>\
  <option value = '.to.be.null'>isNull</option>\
  <option value = '.to.not.be.null'>isNotNull</option>\
  <option value = '.to.exist'>Exists</option>\
  <option value = '.to.not.exist'>!Exists</option>\
");
templates.numberConditionOptions = Handlebars.compile("{{> numberConditionOptions}}");

Handlebars.registerPartial('stringConditionOptions', "\
  <option selected value = '.to.equal'>=</option>\
  <option value = '.to.not.equal'>!=</option>\
  <option value = '.to.contain'>Contains</option>\
  <option value = '.to.not.contain'>!Contains</option>\
  <option value = '.to.be.null'>isNull</option>\
  <option value = '.to.not.be.null'>isNotNull</option>\
  <option value = '.to.exist'>Exists</option>\
  <option value = '.to.not.exist'>!Exists</option>\
");
templates.stringConditionOptions = Handlebars.compile("{{> stringConditionOptions}}");

Handlebars.registerPartial('boolConditionOptions', "\
  <option selected value = '.to.be.true'>isTrue</option>\
  <option value = '.to.be.false'>isFalse</option>\
  <option value = '.to.be.null'>isNull</option>\
  <option value = '.to.not.be.null'>isNotNull</option>\
  <option value = '.to.exist'>Exists</option>\
  <option value = '.to.not.exist'>!Exists</option>\
");
templates.boolConditionOptions = Handlebars.compile("{{> boolConditionOptions}}");

Handlebars.registerPartial('nullConditionOptions', "\
  <option selected value = '.to.be.null'>isNull</option>\
  <option value = '.to.not.be.null'>isNotNull</option>\
  <option value = '.to.exist'>Exists</option>\
  <option value = '.to.not.exist'>!Exists</option>\
");
templates.nullConditionOptions = Handlebars.compile("{{> nullConditionOptions}}");

Handlebars.registerPartial('objectConditionOptions', "\
  <option value = '.to.be.null'>isNull</option>\
  <option value = '.to.not.be.null'>isNotNull</option>\
  <option selected value = '.to.exist'>Exists</option>\
  <option value = '.to.not.exist'>!Exists</option>\
");
templates.objectConditionOptions = Handlebars.compile("{{> objectConditionOptions}}");

//Create "conditional render" Handlebars 'helper' thats a little more robust than the built-in #if helper.   Helps us
//to conditionally render partial templates
Handlebars.registerHelper('conditionalRender', function(...args) {
  //first parameter is the value we are checking
  let contextValue = args[0];
  //second through second-to-last parmater are the valid possible values for the value we are checking
  let validValues = args.slice(1,-1);
  //last paramter is the handlebars-passed 'options' object that we rely upon
  let options = args[args.length - 1]

  if (_.includes(validValues, contextValue)) {
    return options.fn(this); // Render the enclosed template block
  }
  else {
    return options.inverse(this); // Render the else block if present
  }
});

//This template is responsible for rendering the initial state of the form upon a call to handleJSONInput().   Subsequent
//changes to the form (by manipulating the input fields) are handled by eventlisteners created in the handleJSONInput() function
let mainTemplate = Handlebars.compile("\
  <div class='row mb-2'>\
    <div class='col-1 ps-0' style='font-size: 0.8rem;'>\
      Type\
    </div>\
    <div class='col-4 ps-0' style='font-size: 0.8rem;'>\
      Property Name\
    </div>\
    <div class='col-2 ps-0' style='font-size: 0.8rem;'>\
      Condition\
    </div>\
    <div class='col-4 ps-0' style='font-size: 0.8rem;'>\
      Value\
    </div>\
    <div class='col-1 ps-0'>\
      <div class='form-switch'>\
        <input class='form-check-input' type='checkbox' id='masterEnable' checked>\
      </div>\
    </div>\
  </div>\
  {{#each items}}\
    <div class='row mb-1'>\
      <div class='col-1 ps-0 pe-0'>\
        {{#conditionalRender currentFormData.type 'number'}}\
        <button type='button' class='btn btn-sm btn-outline-primary custom-btn dropdown-toggle custom-form-styling rounded-0 rounded-start' data-bs-toggle='dropdown' id='typeSelect{{@index}}'>\
          n\
        {{/conditionalRender}}\
        {{#conditionalRender currentFormData.type 'string'}}\
        <button type='button' class='btn btn-sm btn-outline-success custom-btn dropdown-toggle custom-form-styling rounded-0 rounded-start' data-bs-toggle='dropdown' id='typeSelect{{@index}}'>\
          s\
        {{/conditionalRender}}\
        {{#conditionalRender currentFormData.type 'bool'}}\
        <button type='button' class='btn btn-sm btn-outline-info custom-btn dropdown-toggle custom-form-styling rounded-0 rounded-start' data-bs-toggle='dropdown' id='typeSelect{{@index}}'>\
          b\
        {{/conditionalRender}}\
        {{#conditionalRender currentFormData.type 'null'}}\
        <button type='button' class='btn btn-sm btn-outline-warning custom-btn dropdown-toggle custom-form-styling rounded-0 rounded-start' data-bs-toggle='dropdown' id='typeSelect{{@index}}'>\
          n\
        {{/conditionalRender}}\
        {{#conditionalRender currentFormData.type 'object'}}\
        <button type='button' class='btn btn-sm btn-outline-danger custom-btn dropdown-toggle custom-form-styling rounded-0 rounded-start' data-bs-toggle='dropdown' id='typeSelect{{@index}}'>\
          o\
        {{/conditionalRender}}\
        </button>\
        <ul class='dropdown-menu pt-0 pb-0' id='typeSelect{{@index}}Options'>\
          <button class='dropdown-item mb-0 custom-form-styling' type='button' id='typeSelect{{@index}}Option-Number' value='number'>Number</button>\
          <button class='dropdown-item mb-0 custom-form-styling' type='button' id='typeSelect{{@index}}Option-String' value='string'>String</button>\
          <button class='dropdown-item mb-0 custom-form-styling' type='button' id='typeSelect{{@index}}Option-Bool' value='bool'>Bool</button>\
          <button class='dropdown-item mb-0 custom-form-styling' type='button' id='typeSelect{{@index}}Option-Object' value='object'>Object/Array</button>\
        </ul>\
      </div>\
      <div class='col-4 ps-0 pe-0'>\
        <div data-bs-toggle='tooltip' data-bs-placement='bottom' data-bs-title='{{currentFormData.propertyName}}'>\
          <input type='text' class='form-control form-control-sm custom-form-styling ps-1 pe-1 rounded-0' id='propertyName{{@index}}' value='{{currentFormData.propertyName}}' disabled=true>\
        </div>\
      </div>\
      <div class='col-2 ps-0 pe-0'>\
        <select class='form-select form-select-sm custom-form-styling ps-1 pe-1 rounded-0' id='conditionSelect{{@index}}'>\
        {{#conditionalRender currentFormData.type 'object'}}\
          {{> objectConditionOptions}}\
        {{/conditionalRender}}\
        {{#conditionalRender currentFormData.type 'string'}}\
          {{> stringConditionOptions}}\
        {{/conditionalRender}}\
        {{#conditionalRender currentFormData.type 'bool'}}\
          {{> boolConditionOptions}}\
        {{/conditionalRender}}\
        {{#conditionalRender currentFormData.type 'null'}}\
          {{> nullConditionOptions}}\
        {{/conditionalRender}}\
        {{#conditionalRender currentFormData.type 'number'}}\
          {{> numberConditionOptions}}\
        {{/conditionalRender}}\
        </select>\
      </div>\
      <div class='col-4 ps-0'>\
      {{#conditionalRender currentFormData.type 'number' 'string'}}\
        <div data-bs-toggle='tooltip' data-bs-placement='bottom' data-bs-title='{{currentFormData.propertyValue}}'>\
          <input type='text' class='form-control form-control-sm custom-form-styling ps-1 rounded-0 rounded-end' id='propertyValue{{@index}}' value='{{currentFormData.propertyValue}}'>\
        </div>\
      {{else}}\
        <input type='text' class='form-control form-control-sm custom-form-styling ps-1 rounded-0 rounded-end' id='propertyValue{{@index}}' value='N/A' disabled=true>\
      {{/conditionalRender}}\
      </div>\
      <div class='col-1 ps-0'>\
        <div class='form-switch'>\
          <input class='form-check-input' type='checkbox' id='enabledSlider{{@index}}' checked>\
        </div>\
      </div>\
    </div>\
  {{/each}}\
");



///////////////////////////////////////
// Utility Functions/Objects Section //
///////////////////////////////////////



const conditionsThatDoNotAcceptAProperty = [
  '.to.exist',
  '.to.not.exist',
  '.to.be.true',
  '.to.be.false',
  '.to.be.null',
  '.to.not.be.null',
]

const defaultFormData = {
  string: {
    type: 'string',
    propertyName: '',
    condition: '.to.equal',
    propertyValue: 'sample string',
    enabled: true,
    //regex to ensure all user-input quotation marks (") are escaped and that regex does not end in a lone \.
    validationRegex: /^(?:[^\\'"]|\\.)*$/,
    validationErrorMessage: 'Not a valid string.  The characters ", \', \\ must be escaped with a \'\\\'.'
  },
  number: {
    type: 'number',
    propertyName: '',
    condition: '.to.equal',
    propertyValue: 12345,
    enabled: true,
    //regex to ensure user-input is a valid number:
    validationRegex: /^[-+]?(?:\d*\.\d+|\d+\.\d*|\d+)(?:[eE][-+]?\d+)?$/,
    validationErrorMessage: 'Not a valid number.'
  },
  bool: {
    type: 'bool',
    propertyName: '',
    condition: '.to.be.true',
    enabled: true,
  },
  null: {
    type: 'null',
    propertyName: '',
    condition: '.to.be.null',
    enabled: true,
  },
  object: {
    type: 'object',
    propertyName: '',
    condition: '.to.exist',
    enabled: true
  }
}

//function to test keys in JSON object so we can know if our chai assertions can reference them via . notation, or we
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

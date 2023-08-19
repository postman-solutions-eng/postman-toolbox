/**
 * Script.js
 * Author: Jordan Walsh and Grey Schober
 *
 */

//////////////////////////////
//  BEGIN SHARED JAVASCRIPT //
//////////////////////////////
let editorNames = [
  { name: 'spectralRule', type: 'ace/mode/yaml' },
  { name: 'spectralCustomFunctions', type: 'ace/mode/javascript' },
  { name: 'openApiSpec', type: 'ace/mode/yaml' },
  // { name: 'testComposerJSONPayload', type: 'ace/mode/json' },
  // { name: 'testJS', type: 'ace/mode/javascript' }
]
let editors = []

for (let editor of editorNames) {
  ace.require('ace/ext/language_tools')
  if (document.getElementById(editor.name)) {
    var thisEditor = ace.edit(editor.name)
    thisEditor.setTheme('ace/theme/monokai')
    thisEditor.session.setMode(editor.type)
    thisEditor.session.setTabSize(2)
    thisEditor.session.setUseSoftTabs(true)
    thisEditor.setOptions({
      enableBasicAutocompletion: true,
      enableSnippets: true,
      enableLiveAutocompletion: false
    })
    // thisEditor.container.addEventListener('keydown', function() {console.log('2')})
    editors.push(thisEditor)
  }
}

//////////////////////////////
//  END SHARED JAVASCRIPT   //
//////////////////////////////



/////////////////////////////////////////////
// BEGIN GOVERNANCE PLAYGROUND JAVASCRIPT  //
/////////////////////////////////////////////

async function validate () {

  //hide any errors
  document.getElementById('spectralResultsError').style.display = "none";
  document.getElementById('spectralResultsTableBody').innerHTML = "";
  document.getElementById('spectralResultsTable').style.display = "table";

  let spectralRule = editors[0].getValue()
  let spectralCustomFunctions = editors[1].getValue()
  let openApiSpec = editors[2].getValue()

  let formBody = [
    `spectralRule=${encodeURIComponent(spectralRule)}`,
    `spectralCustomFunctions=${encodeURIComponent(spectralCustomFunctions)}`,
    `openApiSpec=${encodeURIComponent(openApiSpec)}`
  ]

  formBody = formBody.join('&')

  await fetch(`/validate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
    },
    body: formBody
  })
    .then(response => response.json())
    .then(data => {
      if (data.error && data.error == 500) {
        throw data.message
      }

      document.getElementById("jsonPathTableResultsBody").innerHTML = "";

      for(let jsonPathMatch of data.jsonPathMatches) {
        let tr = document.createElement("tr");

        let pathTd = document.createElement("td")
        pathTd.innerText = jsonPathMatch.path;

        let matchesTd = document.createElement("td")
        matchesTd.innerText = jsonPathMatch.matches.join('\r\n');

        tr.appendChild(pathTd);
        tr.appendChild(matchesTd);

        document.getElementById("jsonPathTableResultsBody").appendChild(tr);
      }

      if (!data.spectralResults || data.spectralResults.length == 0) {
        document.getElementById('spectralResultsError').innerHTML = 'No issues found!'
        document.getElementById('spectralResultsError').style.display = "block";
        document.getElementById('spectralResultsTable').style.display = "none";
      } else {
        let message = `${data.spectralResults.length} issue found`
        if (data.spectralResults.length > 1) {
          message = `${data.spectralResults.length} issues found`
        }

        document.getElementById("spectralResultsTableBody").innerHTML = "";

        for(let spectralResult of data.spectralResults) {
          let tr = document.createElement("tr");

          let codeTd = document.createElement("td")
          codeTd.innerText = spectralResult.code;

          let messageTd = document.createElement("td")
          messageTd.innerText = spectralResult.message;

          let pathTd = document.createElement("td")
          pathTd.innerText = spectralResult.path.join('\r\n');

          let severityTd = document.createElement("td")
          switch(spectralResult.severity) {
            case 0:
              severityTd.innerText = "error";
              break;
            case 1:
              severityTd.innerText = "warn";
              break;
            case 2:
              severityTd.innerText = "info";
              break;
            case 3:
              severityTd.innerText = "hint";
              break;
            default:
              severityTd.innerText = "n/a";
              break;
          }

          let rangeTd = document.createElement("td")
          rangeTd.innerHTML = `${parseInt(spectralResult.range.start.line)+1}`

          //add nodes to table
          tr.appendChild(codeTd);
          tr.appendChild(messageTd);
          tr.appendChild(pathTd);
          tr.appendChild(severityTd);
          tr.appendChild(rangeTd);

          document.getElementById("spectralResultsTableBody").appendChild(tr);
        }
      }
    })
    .catch(message => {
      document.getElementById("jsonPathTableResultsBody").innerHTML = "";
      document.getElementById("spectralResultsTableBody").innerHTML = "";
      document.getElementById('spectralResultsError').innerText = message;

      //show the error
      document.getElementById('spectralResultsTable').style.display = "none";
      document.getElementById('spectralResultsError').style.display = "block";
    })
}

/////////////////////////////////////////////
// END GOVERNANCE PLAYGROUND JAVASCRIPT    //
/////////////////////////////////////////////




// ////////////////////////////////////
// // BEGIN TEST COMPOSER JAVASCRIPT //
// ////////////////////////////////////
//
// //data containers referenced across this entire component
// let testFormData = [];
//
// //invoke initial call handleJSONInput to put meaningful data on the user's screen
// handleJSONInput();
//
// // This function is the initial entry point of functionality for the Test Composer.   Upon a user entering valid JSON,
// // this function generates data structure upon which this entire page is reliant (testFormData array), generates the test
// // composition form, registers event listeners upon the various fields within that form, and invokes the generation
// // of the chai assertions.
// function handleJSONInput() {
//   //zero out testFormData field in case user uses this tool multiple times in a row
//   testFormData = []
//   let json;
//   try {
//     //on this page (testComposer page), editors[0] will be the JSON input window
//     json = JSON.parse(editors[0].getValue())
//     generateForm(json)
//
//     //load template
//     let template = Handlebars.compile("<ul>{{> list}}</ul>")
//
//     //render template
//     document.getElementById('ruleFormContainer').innerHTML = template({items: testFormData});
//
//     //register listeners for each input field
//     _.forEach(testFormData, function(formEntry, index) {
//
//       let conditionSelect = document.getElementById('conditionSelect' + index)
//       let propertyNameTextBox = document.getElementById('propertyName' + index)
//
//       conditionSelect.addEventListener('input', event => {
//         testFormData[index].condition = conditionSelect.options[conditionSelect.selectedIndex].value;
//         generateChaiAssertions()
//       })
//       propertyNameTextBox.addEventListener('input', event => {
//         testFormData[index].value = propertyNameTextBox.value;
//         generateChaiAssertions()
//       })
//     })
//     //generate initial set of assertions
//     generateChaiAssertions()
//   }
//   catch {
//     document.getElementById('ruleFormContainer').innerHTML = "Invalid JSON.   Please provide a valid JSON document";
//   }
// }
//
// //recursive function that generates form entries based on the JSON payload provided by the user
// function generateForm(obj, path) {
//   if (!path) {path = ""}
//   _.each(obj, function (value, key) {
//
//     // object keys in json must ALWAYS be strings.  Consequently, if you see a numeric key, it means you are in an array
//     // or have a key in the form of:
//     // testObject: {
//     //    "name": "Grey"
//     //      "10": "the key for this value is 10"
//     // }
//     // In both cases, the appropriate way to index to this value is with bracket notation i.e. testObject[10]
//     if (_.isNumber(key) && path !== "") {
//       key = "[" + key + "]"
//     }
//     else if (path !== "") {
//       key = "." + key
//     }
//
//     //note that due to Handlebars' comparatively primitive templating logic, one cannot easily do comparisons for the purposes
//     //of displaying a template.  AKA I can not test for the value of the "type" property without writing a hacky "helper function".
//     // Consequently, I had to add a seemingly superfluous field called 'formValueFieldEnabled' to give the templating logic
//     // something to test for to determine whether the value field should be enabled (or not) in the form
//     if (_.isObject(value)) {
//       testFormData.push({propertyName: path === "" ? key : path + key, formValueFieldEnabled: false, condition: '.to.exist', type: 'object'});
//       generateForm(value, path === "" ? key : path + key)
//     } else {
//       if (_.isNumber(value)) {
//         testFormData.push({propertyName: path === "" ? key : path + key, formValueFieldEnabled: true, condition: '.to.equal', type: 'number', value: value});
//       }
//       if (_.isString(value)) {
//         testFormData.push({propertyName: path === "" ? key : path + key, formValueFieldEnabled: true, condition: '.to.equal', type: 'string', value: value});
//       }
//       // if (_.isBoolean(value)) {
//       // }
//       // if (_.isNull()){
//       // }
//     }
//   });
// }
//
// //generate assertions based on data in the form
// function generateChaiAssertions () {
//   let chaiAssertions = _.map(testFormData, function (formEntry) {
//     // if (formEntry.condition === '.to.exist' || formEntry.condition === '.to.not.exist') {
//     if (formEntry.type === 'object') {
//       return 'expect(' + formEntry.propertyName + ')' + formEntry.condition + '();';
//     }
//     if (formEntry.type === 'string') {
//       return 'expect(' + formEntry.propertyName + ')' + formEntry.condition + '("' + formEntry.value + '");';
//     }
//     if (formEntry.type === 'number') {
//       return 'expect(' + formEntry.propertyName + ')' + formEntry.condition + '(' + formEntry.value + ');';
//     }
//   })
//   editors[1].setValue(_.join(chaiAssertions, '\n\n'))
// }
//
//
//
// if (document.getElementById('testComposerJSONPayload')) {
//   //used keypress/cut/paste events here (instead of "input" event) because ace editor would not register backspace/deletions/pastes as a change of input
//   document.getElementById('testComposerJSONPayload').addEventListener('keydown', event => {
//     console.log('1')
//     debouncedHandleJSONInput();
//   });
//   document.getElementById('testComposerJSONPayload').addEventListener('change', event => {
//     console.log('3')
//     debouncedHandleJSONInput();
//   });
//   document.getElementById('testComposerJSONPayload').addEventListener('cut', event => {
//     debouncedHandleJSONInput();
//   });
//   document.getElementById('testComposerJSONPayload').addEventListener('paste', event => {
//     debouncedHandleJSONInput();
//   });
// }
//
// let debouncedHandleJSONInput = debounceAFunction(handleJSONInput, 300)
//
// function debounceAFunction(functionToDebounce, delay) {
//   let timeoutId;
//   return function (...args) {
//     clearTimeout(timeoutId);
//     timeoutId = setTimeout(() => {
//       functionToDebounce(...args);
//     }, delay);
//   };
// }
//
// Handlebars.registerPartial('list', "                                                                        \
//       {{#each items}}                                                                                                     \
//         <div class='row'>                                                                                                 \
//           <div class='form-group col-sm-5\'>                                                                              \
//             <input type='text' class='form-control form-control-sm' id='propertyName' disabled='true' value={{propertyName}}> \
//           </div>                                                                                                          \
//           <div class=\"form-group col-sm-2\">                                                                             \
//             <select class=\"form-control-sm\" id=\"conditionSelect{{@index}}\">                                           \
//               {{#if formValueFieldEnabled}}                                                                                           \
//               <option value = '.to.equal'>=</option>                                                                          \
//               <option value = '.to.be.above'>&gt;</option>                                                                       \
//               <option value = '.to.be.below'>&lt;</option>                                                                       \
//               {{else}}                                                                                                    \
//                 <option value = '.to.exist'>Exists</option>                                                                   \
//                 <option value = '.to.not.exist'>!Exists</option>                                                              \
//               {{/if}}                                                                                                     \
//             </select>                                                                                                     \
//           </div>                                                                                                          \
//           <div class=\"form-group col-sm-5\">                                                                             \
//             {{#if value}}                                                                                                 \
//             <input type=\"text\" class=\"form-control form-control-sm\" id=\"propertyName{{@index}}\" value='{{value}}'> \
//             {{else}}                                                                                                      \
//             <input type=\"text\" class=\"form-control form-control-sm\" id=\"propertyName{{@index}}\" disabled=\"true\">  \
//             {{/if}}                                                                                                       \
//           </div>                                                                                                          \                                                                                                      \
//         </div>                                                                                                            \                                                                                                      \
//       {{/each}}                                                                                                           \
//     ")
//

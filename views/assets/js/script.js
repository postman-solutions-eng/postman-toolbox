/**
 * Script.js
 * Author: Jordan Walsh
 *
 */

async function validate () {

  //Hide copy buttons
  document.getElementById("jsonSchemaCopy").style.display = "none";
  document.getElementById("spectralResultCopy").style.display = "none";

  document.getElementById("jsonPathResult").innerHTML = "Validating...";
  document.getElementById("spectralResult").innerHTML = "Validating...";

  let spectralRule = spectralRuleEditor.getValue(); 
  let openApiSpec = openApiSpecEditor.getValue(); 

  let formBody = [
    `spectralRule=${encodeURIComponent(spectralRule)}`,
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

      if(data.error && data.error == 500) {
        throw data.message;
      }

      document.getElementById("jsonPathResult").innerHTML = JSON.stringify(data.jsonPathMatches, null, 2);

      if(!data.spectralResults || data.spectralResults.length == 0) {
        document.getElementById("spectralResult").innerHTML = "No issues found!";
        document.getElementById("jsonSchemaCopy").style.display = "block";

      } else {
        //Show copy buttons
        document.getElementById("jsonSchemaCopy").style.display = "block";
        document.getElementById("spectralResultCopy").style.display = "block";

        let message = `${data.spectralResults.length} issue found`;
        if(data.spectralResults.length > 1) {
          message = `${data.spectralResults.length} issues found`;
        }

        let results = {
          "summary" : message,
          "results" : data.spectralResults
        }

        //document.getElementById("spectralResult").parentNode.innerText = `${message}`;
        document.getElementById("spectralResult").innerHTML = JSON.stringify(results, null, 2);
      }

    })
    .catch(message => {
      document.getElementById("jsonPathResult").innerHTML = message;
      document.getElementById("spectralResult").innerHTML = message;
    })
}

//Set up the editors.
var spectralRuleEditor = ace.edit("spectralRule");
spectralRuleEditor.setTheme("ace/theme/twilight");
spectralRuleEditor.session.setMode("ace/mode/yaml");
spectralRuleEditor.session.setTabSize(2);
spectralRuleEditor.session.setUseSoftTabs(true);

var openApiSpecEditor = ace.edit("openApiSpec");
openApiSpecEditor.setTheme("ace/theme/twilight");
openApiSpecEditor.session.setMode("ace/mode/yaml");
openApiSpecEditor.session.setTabSize(2);
openApiSpecEditor.session.setUseSoftTabs(true);

//Attach a listener to the copy buttons
for(let element of document.getElementsByClassName("copy")) {
  element.addEventListener("click", function(evt) {

    // Copy the text inside the text field
    navigator.clipboard.writeText(evt.target.nextSibling.innerText);
    
    evt.target.innerText = "Copied"
    
    setTimeout(() => {
      evt.target.innerText = "Copy"
    },3000)

  })
}
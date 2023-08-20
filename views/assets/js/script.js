/**
 * Script.js
 * Author: Jordan Walsh
 *
 */

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

let editorNames = [
  { name: 'spectralRule', type: 'ace/mode/yaml' },
  { name: 'spectralCustomFunctions', type: 'ace/mode/javascript' },
  { name: 'openApiSpec', type: 'ace/mode/yaml' }
]
let editors = []

for (let editor of editorNames) {
  ace.require('ace/ext/language_tools')
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
  editors.push(thisEditor)
}

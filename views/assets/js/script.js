/**
 * Script.js
 * Author: Jordan Walsh
 *
 */

async function validate () {
  //hide any errors
  document.getElementById('spectralResultsError').style.display = 'none'
  document.getElementById('spectralResultsTableBody').innerHTML = ''
  document.getElementById('spectralResultsTable').style.display = 'table'

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

      document.getElementById('jsonPathTableResultsBody').innerHTML = ''

      for (let jsonPathMatch of data.jsonPathMatches) {
        let tr = document.createElement('tr')

        let pathTd = document.createElement('td')
        pathTd.innerText = jsonPathMatch.path

        let matchesTd = document.createElement('td')
        matchesTd.innerText = jsonPathMatch.matches.join('\r\n')

        tr.appendChild(pathTd)
        tr.appendChild(matchesTd)

        document.getElementById('jsonPathTableResultsBody').appendChild(tr)
      }

      if (!data.spectralResults || data.spectralResults.length == 0) {
        document.getElementById('spectralResultsError').innerHTML =
          'No issues found!'
        document.getElementById('spectralResultsError').style.display = 'block'
        document.getElementById('spectralResultsTable').style.display = 'none'
      } else {
        let message = `${data.spectralResults.length} issue found`
        if (data.spectralResults.length > 1) {
          message = `${data.spectralResults.length} issues found`
        }

        document.getElementById('spectralResultsTableBody').innerHTML = ''

        for (let spectralResult of data.spectralResults) {
          let tr = document.createElement('tr')

          let codeTd = document.createElement('td')
          codeTd.innerText = spectralResult.code

          let messageTd = document.createElement('td')
          messageTd.innerText = spectralResult.message

          let pathTd = document.createElement('td')
          pathTd.innerText = spectralResult.path.join('\r\n')

          let severityTd = document.createElement('td')
          switch (spectralResult.severity) {
            case 0:
              severityTd.innerText = 'error'
              break
            case 1:
              severityTd.innerText = 'warn'
              break
            case 2:
              severityTd.innerText = 'info'
              break
            case 3:
              severityTd.innerText = 'hint'
              break
            default:
              severityTd.innerText = 'n/a'
              break
          }

          let rangeTd = document.createElement('td')
          rangeTd.innerHTML = `${parseInt(spectralResult.range.start.line) + 1}`

          //add nodes to table
          tr.appendChild(codeTd)
          tr.appendChild(messageTd)
          tr.appendChild(pathTd)
          tr.appendChild(severityTd)
          tr.appendChild(rangeTd)

          document.getElementById('spectralResultsTableBody').appendChild(tr)
        }
      }
    })
    .catch(message => {
      document.getElementById('jsonPathTableResultsBody').innerHTML = ''
      document.getElementById('spectralResultsTableBody').innerHTML = ''
      document.getElementById('spectralResultsError').innerText = message

      //show the error
      document.getElementById('spectralResultsTable').style.display = 'none'
      document.getElementById('spectralResultsError').style.display = 'block'
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

async function generate () {
  //Disable the generate button
  document.getElementById("generateRule").setAttribute("disabled", "disabled");

  let textarea = document.getElementById('promptTextArea')
  let valid = false

  if (!textarea || !textarea.value) {
    textarea.classList.add('is-invalid')
    document.getElementById('responseTextArea').value = ''
  } else {
    textarea.classList.remove('is-invalid')
    valid = true
    document.getElementById('responseTextArea').value = 'Generating ruleset...'
  }

  if (valid) {
    const response = await fetch('/api/generate', {
      method: 'POST',
      mode: 'cors',
      cache: 'no-cache',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: textarea.value
      })
    })

    let codeblock = document.getElementById('responseTextArea')

    if (response && response.status == 200) {
      response
        .json()
        .then(data => {
          codeblock.value = data.result.message.content;
        })
        .catch(err => {
          console.log(err);
          codeblock.value = "An error occurred. Please raise an issue in the GitHub repository if this continues to occur."
        })

        //reenable the button
        document.getElementById("generateRule").disabled = false;
    } else if (response && response.status == 429) {
      codeblock.value = "Too many requests. You are allowed 5 requests per minute. Please wait a few seconds and try again."
      let timer = 9;
      let interval = setInterval(() => {
        let button = document.getElementById("generateRule");
        button.setAttribute("disabled", "disabled");

        button.innerText = "Generate (" + timer-- + ")";

        if(timer < 0) {
          button.disabled = false;
          button.innerText = "Generate";
          clearInterval(interval);
        }
      }, 1000)
    } else {
      //Some other error
      codeblock.value = "An error occurred. Please raise an issue in the GitHub repository if this continues to occur."
      //reenable the button
      document.getElementById("generateRule").disabled = false;
    }
  }
}

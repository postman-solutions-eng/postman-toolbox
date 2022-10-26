/**
 * Script.js
 * Author: Jordan Walsh
 *
 */

async function validate () {

  document.getElementById("jsonPathResult").innerHTML = "Validating...";
  document.getElementById("spectralResult").innerHTML = "Validating...";


  let spectralRule = document.getElementById('spectralRule').value;
  let openApiSpec = document.getElementById('openApiSpec').value;

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
      document.getElementById("jsonPathResult").innerHTML = JSON.stringify(data.jsonPathMatches, null, 2);

      console.log(data.spectralResults);

      if(!data.spectralResults || data.spectralResults.length == 0) {
        document.getElementById("spectralResult").innerHTML = "No issues found!";
      } else {
        let message = " issue found.<br/><br/>";
        if(data.spectralResults.length > 1) {
          message = " issues found.<br/><br/>";
        }

        document.getElementById("spectralResult").innerHTML = `${data.spectralResults.length}${message}` + JSON.stringify(data.spectralResults, null, 2);
      }

    })
}

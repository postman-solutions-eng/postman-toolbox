const spectralCore = require('@stoplight/spectral-core')
const { Spectral, Document } = spectralCore

const Parsers = require('@stoplight/spectral-parsers')
const { truthy, pattern, xor } = require('@stoplight/spectral-functions')

const {
  bundleAndLoadRuleset
} = require('@stoplight/spectral-ruleset-bundler/with-loader')
const spectralRuntime = require('@stoplight/spectral-runtime')
const { fetch } = spectralRuntime

const fs = require('fs')
const path = require('path')

const { JSONPath } = require('jsonpath-plus')
const yaml = require('js-yaml')

const { v4: uuidv4 } = require('uuid')

const retrieveRuleset = async filePath => {
  try {
    return await bundleAndLoadRuleset(path.resolve(filePath), { fs, fetch })
  } catch (ex) {
    let errTraceId = uuidv4()
    let errorMessage = ex.toString();
    let errorPath = "Not specified.";

    if(ex && ex.errors && ex.errors.length > 0) {
      errorMessage = ex.errors.toString()

      if(ex.errors[0].path) {
        errorPath = ex.errors[0].path.join(" -> ")
      }
    }

    console.log(errTraceId, ex)
    throw new Error(
      'Invalid Spectral rule supplied.\nPlease check your syntax and try again.\n\nError Details:\n\n' +
        errorMessage +
        '\nLocation: ' + errorPath +
        '\nTrace ID: ' +
        errTraceId +
        '\n\nIf you need further investigation, please create a Github issue with the Trace ID.\n\nBe sure to include the Spectral rule you are trying to validate in your issue description.'
    )
  }
}

/**
 *
 * @param {*} ruleset
 * @param {*} openapi
 * @returns Object
 */
async function validate (ruleset, openapi) {
  if (!ruleset || ruleset == '' || !openapi || openapi == '') {
    throw new Error('Ruleset and API spec are required for validation.')
  } else {
    const spectral = new Spectral()

    /**
     * For some reason, spectral will only validate the YAML
     * rules if they are in a file.
     *
     * So we write a temp file to the fs and then use it to
     * read the ruleset into the Spectral object.
     *
     * Then we delete the file.
     */

    let uniqueFileId = uuidv4()

    fs.writeFileSync(`/tmp/.${uniqueFileId}.yaml`, ruleset)
    const rulesetFile = await retrieveRuleset(`/tmp/.${uniqueFileId}.yaml`)

    spectral.setRuleset(rulesetFile)
    try {
      fs.unlinkSync(`/tmp/.${uniqueFileId}.yaml`)
    } catch (e) {
      console.log("Error deleting file - doesn't exist.")
    }

    //Now the spectral object is populated, we can extract the JSONPath.
    let ruleNames = Object.keys(spectral.ruleset.rules)
    const doc = yaml.load(openapi, 'utf8')

    let ruleMatches = []

    for (let rule of ruleNames) {
      let givenPaths = spectral.ruleset.rules[rule].definition.given

      //Given field can be a string or an array
      if (typeof givenPaths == 'string') {
        givenPaths = [givenPaths]
      }

      for (let path of givenPaths) {
        //First we need to check whether this is a JSONPath or an Alias
        switch (path.charAt(0)) {
          case '$':
            let results = JSONPath({ path: path, json: doc })
            ruleMatches.push({
              path: path,
              matches: results
            })
            break
          case '#':
            ruleMatches.push({
              path: path,
              matches: ['JSON Path targeting is not supported with aliases.']
            })
            break
          default:
            console.log('This is neither')
            break
        }
      }
    }

    const myDocument = new Document(openapi, Parsers.Yaml)

    return spectral.run(myDocument).then(results => {
      return {
        jsonPathMatches: ruleMatches,
        spectralResults: results
      }
    })
  }
}

async function writeFunctions (customFunctions) {
  let lines = customFunctions.split(/\r?\n/)
  let commentRegexp = /^\/\/function:\s?(.+)/i
  let fileNames = []
  let currentFile = ''

  if (!fs.existsSync(`/tmp/functions`)) {
    fs.mkdirSync(`/tmp/functions`)
  }

  lines.forEach(line => {
    let isComment = line.match(commentRegexp)

    if (isComment) {
      currentFile = `/tmp/functions/${isComment[1]}.js`

      try {
        //delete it if already exists
        fs.unlinkSync(currentFile)
      } catch (ex) {
        //error is thrown because the file was not found to delete.
      }
      
      //Add it to the list
      fileNames.push(currentFile)
    } else {
      try {
        fs.appendFileSync(currentFile, line)
      } catch(ex) {
        console.log(ex)
      }
    }
  })

  return Promise.resolve(fileNames)
}

module.exports = {
  validate: validate,
  writeFunctions: writeFunctions
}

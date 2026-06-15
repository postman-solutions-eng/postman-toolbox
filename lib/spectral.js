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
const os = require('os')
const path = require('path')

const { JSONPath } = require('jsonpath-plus')
const yaml = require('js-yaml')

const { v4: uuidv4 } = require('uuid')
const acorn = require('acorn')
const acornWalk = require('acorn-walk')

// Defense-in-depth static check for user-supplied function bodies.
// Not a true sandbox — spectral still requires the file in this process — but
// blocks the obvious escape hatches. Real isolation needs an out-of-process or
// vm-based runner.
const FORBIDDEN_IDENTIFIERS = new Set([
  'require', 'process', 'global', 'globalThis',
  'eval', 'Function', '__dirname', '__filename',
  'Buffer', 'child_process'
])
const FORBIDDEN_MEMBER_NAMES = new Set([
  '__proto__', 'constructor', 'prototype'
])

function staticallyAnalyze (code, fnName) {
  let ast
  try {
    ast = acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'module', allowHashBang: false })
  } catch (ex) {
    throw new Error(`Failed to parse function "${fnName}": ${ex.message}`)
  }

  const reject = reason => { throw new Error(`Function "${fnName}" rejected: ${reason}`) }

  acornWalk.simple(ast, {
    Identifier (node) {
      if (FORBIDDEN_IDENTIFIERS.has(node.name)) reject(`uses forbidden identifier "${node.name}"`)
    },
    MemberExpression (node) {
      if (!node.computed && node.property.type === 'Identifier' && FORBIDDEN_MEMBER_NAMES.has(node.property.name)) {
        reject(`accesses forbidden property "${node.property.name}"`)
      }
      if (node.computed && node.property.type === 'Literal' && FORBIDDEN_MEMBER_NAMES.has(String(node.property.value))) {
        reject(`accesses forbidden property "${node.property.value}"`)
      }
    },
    ImportDeclaration () { reject('uses an import statement') },
    ImportExpression () { reject('uses a dynamic import') },
    ExportAllDeclaration () { reject('uses export * from ...') }
  })
}

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
async function validate (ruleset, openapi, workDir) {
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
    let rulesetDir = workDir || os.tmpdir()
    if (!fs.existsSync(rulesetDir)) {
      fs.mkdirSync(rulesetDir, { recursive: true })
    }
    let rulesetPath = path.join(rulesetDir, `.${uniqueFileId}.yaml`)

    fs.writeFileSync(rulesetPath, ruleset)
    const rulesetFile = await retrieveRuleset(rulesetPath)

    spectral.setRuleset(rulesetFile)
    try {
      fs.unlinkSync(rulesetPath)
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

    /**
     * JWalsh 20231013
     * Hardcoded a third parameter here is called 'source'. This is used in multi-file validations to help with
     * referencing between files.
     * As this is only a single file parser with no support for $ref, this should not be required. However not supplying it
     * can cause some issues, so we have hardcoded the value.
     */
    const myDocument = new Document(openapi, Parsers.Yaml, "This is the document I am parsing.")

    return spectral.run(myDocument).then(results => {
      return {
        jsonPathMatches: ruleMatches,
        spectralResults: results
      }
    })
  }
}

async function writeFunctions (customFunctions, workDir) {
  let lines = (customFunctions || '').split(/\r?\n/)
  let commentRegexp = /^\/\/function:\s?(.+)/i
  let safeNameRegexp = /^[A-Za-z0-9_-]+$/
  let functionsDir = path.resolve(workDir || os.tmpdir(), 'functions')
  let fileNames = []
  let buffers = new Map() // path -> string buffer, so we can analyze before writing
  let currentName = null

  fs.mkdirSync(functionsDir, { recursive: true })

  lines.forEach(line => {
    let isComment = line.match(commentRegexp)

    if (isComment) {
      let fnName = isComment[1].trim()
      if (!safeNameRegexp.test(fnName)) {
        throw new Error(`Invalid function name: "${fnName}". Allowed characters: letters, digits, _, -`)
      }
      let resolved = path.resolve(functionsDir, `${fnName}.js`)
      if (path.dirname(resolved) !== functionsDir) {
        throw new Error(`Invalid function name: "${fnName}".`)
      }
      currentName = resolved
      if (!buffers.has(currentName)) {
        buffers.set(currentName, '')
        fileNames.push(currentName)
      }
    } else if (currentName) {
      buffers.set(currentName, buffers.get(currentName) + line + '\n')
    }
  })

  for (let [filePath, code] of buffers) {
    staticallyAnalyze(code, path.basename(filePath, '.js'))
  }

  for (let [filePath, code] of buffers) {
    try {
      fs.unlinkSync(filePath)
    } catch (ex) {
      // file did not exist
    }
    fs.writeFileSync(filePath, code)
  }

  return fileNames
}

module.exports = {
  validate: validate,
  writeFunctions: writeFunctions
}

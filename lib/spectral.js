const spectralCore = require('@stoplight/spectral-core')
const { Spectral, Document } = spectralCore

const Parsers = require('@stoplight/spectral-parsers')
const { truthy, pattern } = require('@stoplight/spectral-functions')

const {bundleAndLoadRuleset} = require("@stoplight/spectral-ruleset-bundler/with-loader")
const spectralRuntime = require("@stoplight/spectral-runtime");
const { fetch } = spectralRuntime;

const fs = require('fs');
const path = require('path');

const {JSONPath} = require('jsonpath-plus');
const yaml = require('js-yaml');

const { v4: uuidv4 } = require('uuid')

const retrieveRuleset = async (filePath) => {
  return await bundleAndLoadRuleset(path.resolve(filePath), { fs, fetch })
}

/**
 * 
 * @param {*} ruleset 
 * @param {*} openapi 
 * @returns Object
 */
async function validate (ruleset, openapi) {

  if(!ruleset || !openapi) {
    return new Promise(null, "Ruleset and OpenAPI are required for validation.");
  }

  const spectral = new Spectral();

  /**
   * For some reason, spectral will only validate the YAML
   * rules if they are in a file.
   * 
   * So we write a temp file to the fs and then use it to 
   * read the ruleset into the Spectral object.
   * 
   * Then we delete the file.
   */

  let uniqueFileId = uuidv4();

  fs.writeFileSync(`/tmp/.${uniqueFileId}.yaml`, ruleset);
  const rulesetFile = await retrieveRuleset(`/tmp/.${uniqueFileId}.yaml`)

  spectral.setRuleset(rulesetFile);
  fs.unlinkSync(`/tmp/.${uniqueFileId}.yaml`);
  
  //Now the spectral object is populated, we can extract the JSONPath.
  let ruleNames = Object.keys(spectral.ruleset.rules);
  const doc = yaml.load(openapi, 'utf8');

  let ruleMatches = [];

  for(let rule of ruleNames) {
    let jsonPath = spectral.ruleset.rules[rule].definition.given;
    let results = JSONPath({path: jsonPath, json: doc});    
    ruleMatches.push({
      "jsonPath": jsonPath,
      "matches": results
    });
  };

  const myDocument = new Document(openapi, Parsers.Yaml);
  
  return spectral.run(myDocument)
  .then(results => {
    return {
      jsonPathMatches: ruleMatches,
      spectralResults: results
    }
  });
}

module.exports = {
  validate: validate
}

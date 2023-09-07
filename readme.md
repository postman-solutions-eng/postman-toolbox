# Postman Toolbox

<a href="https://project-types.github.io/#toy">
  <img src="https://img.shields.io/badge/project%20type-toy-blue" alt="Toy Badge"/>
</a> <a href="https://www.repostatus.org/#concept"><img src="https://www.repostatus.org/badges/latest/concept.svg" alt="Project Status: Concept – Minimal or no implementation has been done yet, or the repository is only intended to be a limited example, demo, or proof-of-concept." /></a>
<a href="https://app.fossa.com/projects/git%2Bgithub.com%2Fpostman-solutions-eng%2Fgovernance-rules-playground?ref=badge_shield" alt="FOSSA Status"><img src="https://app.fossa.com/api/projects/git%2Bgithub.com%2Fpostman-solutions-eng%2Fgovernance-rules-playground.svg?type=shield"/></a>

## Table of Contents
1. <a href="https://github.com/postman-solutions-eng/governance-rules-playground#governance-rules-playground">Governace Rules Playground Documentation</a>
2. <a href="https://github.com/postman-solutions-eng/governance-rules-playground#visual-test-composer">Visual Test Composer Documentation</a>

## Governance Rules Playground

### Sample App
The tool is available for use at https://governance-rules-playground.postmansolutions.com/

Use this tool to validate your API spec (OAS/AsyncAPI) against a series of Spectral rules.

Validation will return the elements in the API spec that are being validated (using JSONPath Plus) as well as the result of the Spectral validation.

### How do I use it?

Enter your Spectral rule in YAML (or quoted JSON) format and an associated API spec that you want to validate against and click the 'Validate' button.

The JSON Path that is identified by the `given` clause will be presented to you, along with the results of the spectral valiation.

### Contributing

Please raise an Issue if you find any bugs, or feel free to fork the code and submit a PR.

### Known limitations

#### Spectral Function Support
Currently the spectral parser only supports two functions: `pattern` and `truthy`.  If more are needed please raise an issue on the repo.

#### JSON Support
The JSON support is limited to fully quoted JSON e.g.

This works correctly.
```json
{
  "status": "OK"
}
```

This doesn't work correctly.
```
{
  status: "OK"
}
```
## Visual Test Composer
This tool is almost entirely self-explanatory and the documentation below is almost exactly what you will find when you click 
on the help button within the tool.  Nevertheless, it is also placed here for the sake of accessibility

### About the Visual Test Composer
Use the Visual Test Composer to generate tests via a handy GUI.  Just provide a valid JSON
response from the API you wish to test, and the tool will render a form to help you generate tests/chai assertions.  
As you edit the fields within the form, the tests/chai assertions will be dynamically updated.  Once you've settled upon
your testing logic, copy and paste the generated tests/chai assertions into Postman!

### What is Chai?
Chai or more correctly, the Chai Assertion Library is a javascript package focusing on enabling users to author
robust tests using Behavior-Driven-Development and/or Test-Driven-Development practices.  If you are not familiar
with Chai, it is quite ubiquitous within the world-wide API ecosystem and is natively included in the Postman testing
sandbox (no need to overcome difficulties with importing external libraries)

### How to use this tool?
1. Provide a response from the API you wish to test in the left-most pane.
2.  Watch as a graphical form and tests are generated before your eyes.
3.  Tweak the form to modify the generated tests.
4.  When finished, copy the chai assertions to Postman
        
### Bugs/Issues/Feedback
The source code for this project is available on
<a href='https://github.com/postman-solutions-eng/governance-rules-playground/issues' target='_blank'>Github</a>.  
Please raise an issue there or feel free to submit a PR.  Support for this tool is provided on a best-effort basis.  
**Importantly,** this tool is not officially supported by Postman Inc. and was written by members of our Solutions 
team to enable and support our customers as much as we are able, but does not have the weight of the entire Postman 
organization behind it

### Privacy (regarding the Visual Test Composer specifically)
All computation/generation for the Visual Test Composer is performed in client-side javascript and no JSON, form 
information, or chai assertions leave the web browser unless said action is explicitly performed by you.

### License

See <a href="./LICENSE">LICENSE</a>.

[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fpostman-solutions-eng%2Fgovernance-rules-playground.svg?type=large)](https://app.fossa.com/projects/git%2Bgithub.com%2Fpostman-solutions-eng%2Fgovernance-rules-playground?ref=badge_large)


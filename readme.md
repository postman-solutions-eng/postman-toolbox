
## Governance Rules Playground

<a href="https://project-types.github.io/#toy">
  <img src="https://img.shields.io/badge/project%20type-toy-blue" alt="Toy Badge"/>
</a> <a href="https://www.repostatus.org/#concept"><img src="https://www.repostatus.org/badges/latest/concept.svg" alt="Project Status: Concept – Minimal or no implementation has been done yet, or the repository is only intended to be a limited example, demo, or proof-of-concept." /></a>

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

### License

See <a href="./LICENSE">LICENSE</a>.

[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Fpostman-solutions-eng%2Fgovernance-rules-playground.svg?type=large)](https://app.fossa.com/projects/git%2Bgithub.com%2Fpostman-solutions-eng%2Fgovernance-rules-playground?ref=badge_large)
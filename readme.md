
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

#### Multiple JSON Path Support
The `given` block of a Spectral Rule can support more than one JSON Path expression.  Currently this tool will only work with a single JSON Path expression.

### License

Copyright 2022 - Jordan Walsh

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## Governance Rules Test Harness

Two goals to this project.
1. Identify which part of an OpenAPI spec will be targeted by a spectral rule (using JSON Schema.)
2. Validate the rule to determine a pass/fail.

### Getting Started
The tool is available at https://governance-rules-test-harness.postmansolutions.com/

Enter your Spectral rule in YAML format, and an associated OpenAPI spec that you want to validate against and click the 'Validate' button.

The JSON schema that is identified by the `given` clause will be presented to you, along with the results of the spectral valiation.

### Known limitations

Currently the spectral parser only supports two functions; `pattern` and `truthy`.  If more are needed please raise an issue on the repo.

### License

Copyright 2022 - Jordan Walsh

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
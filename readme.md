
## Governance Rules Playground

Two goals to this project.
1. Identify which part of an API spec will be targeted by a spectral rule (using JSON Path Plus.)
2. Verify the rule against the API Spec to determine a pass/fail.

### Getting Started
The tool is available at https://governance-rules-test-harness.postmansolutions.com/

Enter your Spectral rule in YAML (or quoted JSON) format, and an associated OpenAPI spec that you want to validate against and click the 'Validate' button.

The JSON Path that is identified by the `given` clause will be presented to you, along with the results of the spectral valiation.

### Known limitations

#### Spectral Function Support
Currently the spectral parser only supports two functions: `pattern` and `truthy`.  If more are needed please raise an issue on the repo.

#### JSON Support
The JSON support is limited to fully quoted JSON e.g.

```json
# This works
{
  "status": "OK"
}

# This doesn't
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
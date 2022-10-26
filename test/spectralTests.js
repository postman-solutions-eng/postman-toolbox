'use strict'
const validate = require('../lib/spectral').validate
const fs = require('fs')
const assert = require('chai').assert

describe('test suite', async () => {
  describe('validation tests', async () => {
    let ruleset, openapi

    before(() => {
      ruleset = fs.readFileSync(`${__dirname}/ruleset.yaml`)
      openapi = fs.readFileSync(`${__dirname}/openapi.yaml`)
    })

    it('Validate PetStore API', done => {
      validate(ruleset, openapi)
        .then(results => {
          assert(results.length > 0, 'Results is empty.')
          results.forEach(result => {
            assert(result.code == 'paths-kebab-case', 'Code is not correct.')
            assert(
              typeof result.severity == 'number',
              'Severity is not a number'
            )
          })
          done()
        })
        .catch(err => {
          console.log(err)
          done(err)
        })
    })
  })
})

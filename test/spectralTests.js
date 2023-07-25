'use strict'
const validate = require('../lib/spectral').validate
const fs = require('fs')
const { writeFunctions } = require('../lib/spectral')
const assert = require('chai').assert
const expect = require('chai').expect

describe('test suite', async () => {
  describe('Validation tests', async () => {
    let ruleset, openapi

    before(() => {
      ruleset = fs.readFileSync(`${__dirname}/resources/valid/ruleset.yaml`)
      openapi = fs.readFileSync(`${__dirname}/resources/valid/openapi.yaml`)
    })

    it('Passes a valid spectral ruleset to the validation function.', () => {
      return validate(ruleset, openapi)
        .then(results => {
          let spectralResults = results.spectralResults
          expect(spectralResults.length).to.be.greaterThan(0)
          spectralResults.forEach(result => {
            expect(result.code).to.equal('paths-kebab-case')
            expect(typeof result.severity).to.equal('number')
          })
        })
        .catch(err => {
          assert.fail('was not supposed to succeed: ' + err.toString())
        })
    })
  })

  describe('Validation tests', async () => {
    let ruleset, openapi, functions

    before(() => {
      functions = fs.readFileSync(`${__dirname}/resources/valid/functions.js`)
      ruleset = fs.readFileSync(`${__dirname}/resources/valid/functionRuleset.yaml`)
      openapi = fs.readFileSync(`${__dirname}/resources/valid/openapi.yaml`)
    })

    it('Tests a ruleset with a custom function', () => {
      return writeFunctions(functions.toString('utf8'))
        .then(() => validate(ruleset, openapi))
        .then(results => {
          let spectralResults = results.spectralResults
          expect(spectralResults.length).to.be.greaterThan(0)
          spectralResults.forEach(result => {
            expect(result.code).to.equal('paths-kebab-case')
            expect(typeof result.severity).to.equal('number')
          })
        })
        .catch(err => {
          assert.fail('was supposed to succeed: ' + err.toString())
        })
    })
  })

  describe('Invalid tests', async () => {
    let invalidRuleset, invalidApiSpec
    let validRuleset, validApiSpec

    before(() => {
      invalidRuleset = fs.readFileSync(
        `${__dirname}/resources/invalid/ruleset.yaml`
      )
      invalidApiSpec = fs.readFileSync(
        `${__dirname}/resources/invalid/garbage.yaml`
      )
      validRuleset = fs.readFileSync(
        `${__dirname}/resources/valid/ruleset.yaml`
      )
      validApiSpec = fs.readFileSync(
        `${__dirname}/resources/valid/openapi.yaml`
      )
    })

    it('Passes an empty spectral ruleset to the validation function.', () => {
      return validate('', validApiSpec)
        .then(() => {
          assert.fail('was not supposed to succeed')
        })
        .catch(error => {
          expect(error.toString()).to.equal(
            'Error: Ruleset and API spec are required for validation.'
          )
        })
    })

    it('Passes an empty api document to the validation function.', () => {
      return validate(validRuleset, '')
        .then(() => {
          assert.fail('was not supposed to succeed')
        })
        .catch(error => {
          expect(error.toString()).to.equal(
            'Error: Ruleset and API spec are required for validation.'
          )
        })
    })

    it('Passes an empty ruleset and empty api document to the validation function.', () => {
      return validate('', '')
        .then(() => {
          assert.fail('was not supposed to succeed')
        })
        .catch(error => {
          expect(error.toString()).to.equal(
            'Error: Ruleset and API spec are required for validation.'
          )
        })
    })

    it('Passes an invalid spectral ruleset to the validation function.', () => {
      return validate(invalidRuleset, validApiSpec)
        .then(() => {
          assert.fail('was not supposed to succeed')
        })
        .catch(err => {
          expect(err.toString()).to.contain(
            'Error: Invalid Spectral rule supplied.'
          )
        })
    })
  })
})

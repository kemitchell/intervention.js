var Intervention = require('./')
var assert = require('assert')
var memdb = require('memdb')

var receivedEvent = false

process.on('exit', function () {
  assert(receivedEvent, 'received event')
})

new Intervention(memdb())
.once('dependency', function (author, depending, dependency) {
  receivedEvent = true
  assert.equal(author, 'dominic.tarr@gmail.com')
  assert.deepEqual(depending, {name: 'couch-sync', semver: '0.0.1'})
  assert.deepEqual(dependency, {name: 'json-rest', range: '1'})
  this.stop()
})
.on('error', function (error) {
  assert.ifError(error)
})
.emitEventsFor('dominic.tarr@gmail.com', false, 1)
.start()

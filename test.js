var Intervention = require('./')
var tape = require('tape')
var memdb = require('memdb')

tape('Dominic Tarr\'s first', function (test) {
  new Intervention(memdb())
  .once('dependency', function (author, depending, dependency) {
    test.equal(
      author, 'dominic.tarr@gmail.com',
      'author is Dominic'
    )
    test.deepEqual(
      depending, {name: 'couch-sync', semver: '0.0.1'},
      'depending has name and semver'
    )
    test.deepEqual(
      dependency, {name: 'json-rest', range: '1'},
      'dependency has name and range'
    )
    test.equal(
      this.sequence(), 236,
      'sequence number is 236'
    )
    this.stop()
    test.end()
  })
  .on('error', function (error) {
    test.ifError(error)
  })
  .emitEventsFor('dominic.tarr@gmail.com', false, 1)
  .start()
})

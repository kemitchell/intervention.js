var Intervention = require('./')
var tape = require('tape')
var memdb = require('memdb')

tape('dominictarr\'s first', function (test) {
  new Intervention(memdb(), 160)
  .once('dependency', function (author, depending, dependency) {
    // Dominic published some before Couch started recording `_npmUser`
    // values. This is the first for a dependency with `_npmUser`.
    test.equal(
      author, 'dominictarr',
      'author is dominictarr'
    )
    test.deepEqual(
      depending, {name: 'asynct', semver: '1.0.0'},
      '`depending` has `.name` and `.semver`'
    )
    test.deepEqual(
      dependency, {name: 'ctrlflow', range: '>=0.0.3'},
      '`dependency` has `.name` and `.range`'
    )
    test.equal(
      this.sequence(), 3415,
      'sequence number is 3415'
    )
    this.stop()
    test.end()
  })
  .on('error', function (error) {
    test.ifError(error)
  })
  .emitEventsFor('dominictarr', false, 1)
  .start()
})

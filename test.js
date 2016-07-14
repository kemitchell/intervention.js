var Intervention = require('./')
var assert = require('assert')
var memdb = require('memdb')

new Intervention(memdb())
.on('dependency', function (author, depending, dependency) {
  console.log('%s is %j', 'author', author)
  console.log('%s is %j', 'depending', depending)
  console.log('%s is %j', 'dependency', dependency)
  this.stop()
})
.on('error', function (error) {
  assert.ifError(error)
})
.emitEventsFor('kyle@kemitchell.com', true, 1)
.start()

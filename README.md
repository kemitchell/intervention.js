```javascript
var Intervention = require('intervention')
var memdb = require('memdb')

var emitter = new Intervention(memdb())
.on('dependency', function (person, depending, dependency) {
  console.log(
    '%s depends on %s\'s %s',
    depending.name, person, dependency.name
  )
})
.on('devDependency', function (person, depending, dependency) {
  console.log(
    '%s depends on %s\'s %s',
    depending.name, person, dependency.name
  )
})
emitter.emitEventsFor('author@example.com') // deps and devDeps
emitter.emitEventsFor('another@example.com', false) // just deps
emitter.start()
```

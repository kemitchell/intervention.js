"We need to talk."

## Usage

```javascript
var Intervention = require('intervention')
var level = require('level')

var emitter = new Intervention(level('./intervention'))
// Emit events for new deps.
.emitEventsFor('npmusername')
// Emit events...
.emitEventsFor(
  'another',
  // for devDeps as well as deps...
  true,
  // from update 458344.
  458344
)
.on('dependency', function (user, depending, dependency) {
  console.log(
    '%s@%s depends on %s\'s %s@%s',
    depending.name, depending.semver,
    user, dependency.name, dependency.range
  )
})
.on('devDependency', function (user, depending, dependency) {
  console.log(
    '%s@%s depends on %s\'s %s@%s',
    depending.name, depending.semver,
    user, dependency.name, dependency.range
  )
})
emitter.start()
```

## Dedication

To the many generous souls  
and unrepentant addicts  
upon whom we so gravely depend  
but whose names we do not know  
this package is gratefully dedicated.  

## Special Thanks

To [Bryan English](https://github.com/bengl) for spreading the bug.

To [Ashley Williams](https://github.com/ashleygwilliams) for follower-fu.

// TODO: Index by npm user name, not e-mail

// EventEmitter Construction
var EventEmitter = require('events').EventEmitter
var inherits = require('util').inherits

// npm Public Registry
var changesStream = require('changes-stream')
var normalize = require('normalize-registry-metadata')
var semver = require('semver')

// Utilities
var pressureStream = require('pressure-stream')
var pump = require('pump')
var pick = require('object.pick')

// Flow Control
var asyncMap = require('async.map')
var mapSeries = require('async.mapSeries')
var runParallel = require('run-parallel')

module.exports = Intervention

function Intervention (levelup, fromSequence) {
  if (!(this instanceof Intervention)) {
    return new Intervention(levelup, fromSequence)
  }
  this._fromSequence = fromSequence || 0
  this._levelup = levelup
  // The last-processed change sequence number.
  this._sequence = 0
  // Data about authors for which to emit events.
  this._emittingEventsFor = {}
}

inherits(Intervention, EventEmitter)

var prototype = Intervention.prototype

// Public API

// Get the current change sequence number.
prototype.sequence = function () { return this._sequence }

// Emit events for an author.
prototype.emitEventsFor = function (author, devDependencies, from) {
  this._emittingEventsFor[author] = {
    // By default, emit events for dependencies, not devDependencies.
    events: devDependencies
      ? ['dependency', 'devDependency']
      : ['dependency'],
    // Emit events for changes after the current sequence number.
    from: from || (this.sequence() + 1)
  }
  return this
}

// Start streaming changes and emitting events.
prototype.start = function () {
  var self = this
  var pressure = self._pressure = pressureStream(function (change, next) {
    self._onChange(change, function (error, data) {
      if (error) return next(error)
      self._setSequence(change.seq, function (error) {
        next(error, data)
      })
    })
  }, {high: 1, max: 1, low: 1})
  .on('data', self._onChange)
  var changes = self._changes = changesStream({
    db: 'https://replicate.npmjs.com',
    include_docs: true,
    since: self._fromSequence
  })
  pump(changes, pressure)
}

// Private Prototype Functions

var EMPTY_VALUE = ''

prototype._onChange = function (change, done) {
  var self = this
  self._sequence = change.seq
  var doc = change.doc
  if (doc.name) { // Registry change.
    doc = normalize(doc)
    var name = doc.name
    // Extract relevant data for each version of the package described
    // by the change document.
    var versions = Object.keys(doc.versions)
    .map(function extractRelevantData (semver) {
      var data = doc.versions[semver]
      var returned = {
        semver: semver,
        author: null,
        contributors: [],
        dependencies: data.dependencies,
        devDependencies: data.devDependencies
      }
      if (data.author && data.author.email) returned.author = data.author.email
      data.contributors.forEach(function (contributor) {
        if (contributor.email) returned.contributors.push(contributor.email)
      })
      return returned
    })
    // Prepare a batch of LevelUP put operations.
    var batch = []
    versions.forEach(function (version) {
      var semver = version.semver
      // Put `name/semver` -> {dependencies, devDependencies}
      batch.push(putOperation(
        packageKey(name, semver),
        pick(version, ['dependencies', 'devDependencies'])
      ))
      // Put `user/package/semver` -> placeholder
      version.contributors
      .concat(version.author)
      .forEach(function (person) {
        var key = contributorKey(person, name, semver)
        batch.push(putOperation(key, EMPTY_VALUE))
      })
    })
    self._levelup.batch(batch, function (error) {
      if (error) self.emit('error', error)
      // Emit any events.
      mapSeries(versions, function (version, done) {
        self._emitEvents(version.dependencies, version.devDependencies, done)
      }, done)
    })
  } else { // CouchDB design doc.
    done()
  }
}

prototype._emitEvents = function (name, version, dependencies, devDependencies, callback) {
  // Emit `dependency` and `devDependency` events.
  var depending = {name: name, version: version}
  runParallel([
    this._emitEvent.bind(this, 'dependency', depending, dependencies),
    this._emitEvent.bind(this, 'devDependency', depending, devDependencies)
  ], callback)
}

prototype._emitEvent = function (event, depending, dependencies, callback) {
  var self = this
  var sequence = self.sequence()
  asyncMap(
    // Check each dependency of the new package version.
    Object.keys(dependencies).map(function (dependencyName) {
      return {name: dependencyName, range: dependencies[dependencyName]}
    }),
    function (dependency, done) {
      // List all known versions of the dependency.
      self._semversOf(dependency.name, function (error, versions) {
        if (error) return done(error)
        // Find the highest version that satisfies the dependency range.
        var maxSatisfying = semver.maxSatisfying(versions, dependency.range)
        // Find the author and contributors behind that dependency.
        self._peopleBehind(dependency.name, maxSatisfying, function (error, people) {
          if (error) return done(error)
          // For the author and each contributor...
          people.forEach(function (person) {
            var options = self._emittingEventsFor[person]
            // Not emitting events for this person.
            if (!options) return
            // Not emitting this kind of event for the person.
            if (options.events.indexOf(event) === -1) return
            // Not emitting notifications for this person at this sequence.
            if (options.from < sequence) return
            // It's a match. Emit an event.
            self.emit(event, person, depending, dependency)
          })
        })
      })
    }
  )
}

prototype._semversOf = function (name, callback) {
  var self = this
  var semvers = []
  // Scan keys from `package/semver/` through `package/semver/~`.
  // Keys are URI-encoded ASCII, therefore `~` is high.
  var stream = self._levelup.createReadStream({
    gte: packageKey(name, ''),
    lte: packageKey(name, '~'),
    keys: true,
    values: false
  })
  .on('error', function (error) {
    stream.destroy()
    callback(error)
  })
  .on('data', function (key) {
    semvers.push(semverFromPackageKey(key))
  })
  .on('end', function () {
    callback(null, semvers)
  })
}

prototype._peopleBehind = function (name, semver, callback) {
  var self = this
  self._levelup.get(packageKey(name, semver), function (error, data) {
    if (error) callback(error)
    else {
      var parsed = JSON.parse(data)
      var people = parsed.contributors.concat(parsed.author)
      callback(null, people)
    }
  })
}

var SEQUENCE_KEY = 'sequence'

prototype._setSequence = function (sequence, callback) {
  this._levelup.set(SEQUENCE_KEY, sequence, callback)
}

// LevelUP Helper Functions

function packageKey (name, semver) {
  return encodeLevelUPKey('packages', name, semver)
}

function semverFromPackageKey (key) {
  decodeLevelUPKey(key)[2]
}

function contributorKey (name) {
  return encodeLevelUPKey('people', name)
}

var encode = encodeURIComponent
var decode = decodeURIComponent

function encodeLevelUPKey (/* variadic */) {
  return Array.prototype.slice.call(arguments).map(encode).join('/')
}

function decodeLevelUPKey (key) {
  return key.split('/').map(decode)
}

function putOperation (key, value) {
  return {type: 'put', key: key, value: JSON.stringify(value)}
}

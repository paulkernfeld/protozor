var tape = require('tape')
var inherits = require('inherits')
var EventEmitter = require('events').EventEmitter
var helpers = require('./helpers')

// this only works when one side "has" and the other "wants"
// because it emit events to everyone at the same time
function Dc () {
  EventEmitter.call(this)
  this.has = {}
  this.wants = {}
}
inherits(Dc, EventEmitter)

Dc.prototype.add = function (x, port) {
  if (port) {
    this.has[x] = port
  } else {
    this.wants[x] = true
  }
  for (var y in this.wants) {
    if (this.has[y]) {
      this.emit(
        'peer',
        y,
        {'ip': 'localhost', 'port': this.has[y]}
      )
    }
  }
}

Dc.prototype.destroy = function (cb) { cb() }

tape('dummy dc feeds', helpers.makeHypercoreServerFeedTest({dc: new Dc()}))

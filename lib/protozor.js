var coreReadStream = require('hypercore/lib/read-stream')
var events = require('events')
var util = require('util')
var assert = require('assert')
var through2 = require('through2')
var debug = require('debug')('protozor')
var ReadWriteLock = require('rwlock')

module.exports = Protozor

function WriteFeed (id, protozor, core, opts) {
  if (!opts) opts = {}

  this.id = id
  this.protozor = protozor
  this.core = core
  this.coreFeed = core.add()

  this.lock = new ReadWriteLock()
}

WriteFeed.prototype.append = function (value, cb) {
  var self = this

  self.lock.writeLock(function (release) {
    // if the core feed already has an ID, make a new feed
    if (self.coreFeed.id) {
      var id = self.coreFeed.id

      self.coreFeed = self.core.add()

      // a writable stream that writes stuff into the new feed
      var write = function (chunk, enc, next) {
        self.coreFeed.append(chunk, next)
      }
      var flush = function (flushCb) {
        flushCb()
        self.coreFeed.append(value, function (err) {
          assert.ifError(err)
          release()
          cb()
        })
      }

      coreReadStream(self.core, id).pipe(through2(write, flush))
    } else {
      self.coreFeed.append(value, function (err) {
        assert.ifError(err)
        release()
        cb()
      })
    }
  })
}

WriteFeed.prototype.apply = function (cb) {
  var self = this

  self.lock.writeLock(function (release) {
    self.coreFeed.finalize(function (err) {
      assert.ifError(err)
      assert(self.coreFeed.id)

      self.protozor.db.put(self.id, self.coreFeed.id, function (err) {
        assert.ifError(err)
        release()
        cb(err, self.coreFeed.id)
      })
    })
  })
}

function ReadFeed (id, core) {
  events.EventEmitter.call(this)

  this.id = id
  this.core = core

  this.link = null
  this.feed = null

  this.lock = new ReadWriteLock()
}

util.inherits(ReadFeed, events.EventEmitter)

ReadFeed.prototype.update = function (link) {
  assert(link)

  var self = this

  // this doesn't need to be inside the lock b/c... uh, whatever
  if (self.link && link.equals(self.link)) return

  self.lock.writeLock(function (release) {
    // TODO check that the new feed is a superset of the old feed?
    debug('updating read feed', self.id.toString('hex'), link.toString('hex'))
    self.link = link
    self.coreFeed = self.core.get(link)
    self.emit('link', link)
    release()
  })
}

ReadFeed.prototype.get = function (blockIndex, cb) {
  var self = this

  self.lock.readLock(function (release) {
    if (self.coreFeed) {
      self.coreFeed.get(blockIndex, function (err, block) {
        release()
        cb(err, block)
      })
    } else {
      release()
      cb('Feed not loaded')
    }
  })
}

function Protozor (db, core, opts) {
  if (!(this instanceof Protozor)) return new Protozor(db, core, opts)
  if (!opts) opts = {}

  this.db = db
  this.core = core

  this.writes = {}
  this.reads = {}

  var self = this

  this.db.on('put', function (id, link) {
    if (self.reads[id]) {
      self.reads[id].update(link)
    }
  })
}

Protozor.prototype.add = function (id) {
  assert.ifError(this.writes[id])

  this.writes[id] = new WriteFeed(id, this, this.core)
  return this.writes[id]
}

Protozor.prototype.get = function (id) {
  if (!this.reads[id]) {
    this.reads[id] = new ReadFeed(id, this.core)
    this._check(id)
  }
  return this.reads[id]
}

Protozor.prototype._check = function (id) {
  var self = this
  this.db.get(id, function (err, link) {
    if (!err) {
      self.reads[id].emit('link', link)
    } else {
      self.reads[id].emit('absent')
    }
  })
}

var KP = require('bittorrent-dht-store-keypair')
var DHT = require('bittorrent-dht')
var Sublevel = require('level-sublevel')
var inherits = require('inherits')
var EventEmitter = require('events')
var assert = require('assert')
var timers = require('timers')
var crypto = require('crypto')
var debug = require('debug')('torrent-kv')

module.exports = TorrentKV

function TorrentKV (db) {
  if (!(this instanceof TorrentKV)) return new TorrentKV(db)

  EventEmitter.call(this)

  var self = this

  this.dht = DHT({ verify: KP.verify })

  debug('new torrentkv', this.dht.nodeId.toString('hex'))

  this.db = Sublevel(db)
  this._watches = this.db.sublevel('watches')
  this._what = {}

  var poll = function () {
    var nToGet = Object.keys(self._what).length + 1
    var pollAgain = function () {
      nToGet--
      if (nToGet === 0) {
        self._timer = timers.setTimeout(poll, 1000)
        self._timer.unref()
      }
    }

    pollAgain()

    for (var pubkey in self._what) {
      self.get(Buffer(pubkey, 'hex'), pollAgain)
    }
  }
  this.dht.once('ready', function () {
    self._timer = timers.setTimeout(poll, 1000)
    self._timer.unref()
  })
}

inherits(TorrentKV, EventEmitter)

TorrentKV.prototype.new = function () {
  return KP()
}

TorrentKV.prototype.put = function (keypair, value, cb) {
  var self = this

  // This only allows one put per pubkey per ms... FYI
  var seq = Date.now()
  var store = keypair.store(value, { seq: seq })
  self.dht.put(store, function (err, hash) {
    cb(err, {
      store: store,
      hash: hash
    })
  })
}

TorrentKV.prototype.get = function (pubkey, cb) {
  var self = this

  var hash = sha1(pubkey)
  self.dht.get(hash, function (err, value) {
    assert.ifError(err)
    if (value !== null) {
      self.emit('value', pubkey, value.v)
      cb(null, value.v)
    } else {
      cb('Not found')
    }
  })
}

TorrentKV.prototype.watch = function (pubkey) {
  this._what[pubkey.toString('hex')] = true
  this._watches.put(pubkey, true, function (err) {
    assert.ifError(err)
  })
}

TorrentKV.prototype.destroy = function (cb) {
  timers.clearTimeout(this._timer)
  this.dht.destroy(cb)
}

var sha1 = function (buf) {
  return crypto.createHash('sha1').update(buf).digest()
}

module.exports.sha1 = sha1

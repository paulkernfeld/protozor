var HypercoreServer = require('../lib/hypercore-server')
var Protozor = require('./protozor')
var TorrentKV = require('./torrent-kv')
var memdb = require('memdb')
var assert = require('assert')
var debug = require('debug')('bep44-protozor')
var through2 = require('through2')
var from2 = require('from2')
var timers = require('timers')

module.exports = Bep44Protozor

function Bep44Protozor (db) {
  if (!(this instanceof Bep44Protozor)) return new Bep44Protozor(db)

  var self = this

  // TODO real DBs
  this.server = HypercoreServer(memdb())
  this.protozor = Protozor(memdb(), this.server.core)
  this.kv = TorrentKV(memdb())

  this.kv.on('value', function (pubkey, link) {
    var pubkeyHex = pubkey.toString('hex')
    debug('feed update received', pubkey.toString('hex'), link.toString('hex'))
    if (self.getFeeds[pubkeyHex]) {
      self.getFeeds[pubkeyHex].update(link)

      // this is a little weird. we're calling this in order to make the server look
      // for the appropriate peer
      self.server.getFeed(link)
    }
  })

  this.getFeeds = {}
}

Bep44Protozor.prototype.new = function () {
  var keypair = this.kv.new()
  return {
    'keypair': keypair,
    'feed': this.protozor.add(keypair.publicKey)
  }
}

Bep44Protozor.prototype.apply = function (feedInfo, cb) {
  var self = this

  feedInfo.feed.apply(function (err, link) {
    assert.ifError(err)
    assert(link)

    // todo this overlaps with HypercoreServer.finalizeFeed in a weird way
    self.server.dc.add(link.slice(20), self.server.server.address().port)
    debug('have', link.toString('hex'))

    debug('sending feed update', feedInfo.keypair.publicKey.toString('hex'), link.toString('hex'))

    self.kv.put(feedInfo.keypair, link, cb)
  })
}

Bep44Protozor.prototype.get = function (pubkey) {
  this.kv.watch(pubkey)
  var pubkeyHex = pubkey.toString('hex')
  debug('feed requested', pubkeyHex)
  var feed = this.getFeeds[pubkeyHex] = this.protozor.get(pubkey)
  return feed
}

Bep44Protozor.prototype.destroy = function (cb) {
  var self = this

  this.kv.destroy(function (err) {
    assert(!err)

    self.server.destroy(cb)
  })
}

Bep44Protozor.prototype.createWriteStream = function (feedInfo) {
  var self = this
  var nAppended = 0
  var nApplied = 0

  // Only try to apply updates every so often because apply is slow
  var applyMaybe = function () {
    if (nAppended > nApplied) {
      self.apply(feedInfo, function (err, put) {
        nApplied = feedInfo.feed.coreFeed.blocks

        assert.ifError(err)
        assert(put)

        timers.setTimeout(applyMaybe, 1000).unref()
      })
    } else {
      timers.setTimeout(applyMaybe, 1000).unref()
    }
  }
  // Timeouts to avoid calling apply multiple times overlapping
  // TODO make apply lock properly
  timers.setTimeout(applyMaybe, 1000).unref()

  return through2(function (chunk, enc, next) {
    feedInfo.feed.append(chunk, function (err) {
      assert.ifError(err)
      nAppended++
      next()
    })
  })
}

Bep44Protozor.prototype.createReadStream = function (feed) {
  var currentBlock = 0

  // TODO respect size ideally
  var readStream = from2(function (size, next) {
    var onLink = function () {
      feed.get(currentBlock, function (err, chunk) {
        assert.ifError(err)

        if (chunk === null) {
          // the feed is out of blocks. we only get more when the link
          // is updated
          feed.once('link', onLink)
        } else {
          currentBlock++
          next(null, chunk)
        }
      })
    }

    if (feed.link === null) {
      // the feed doesn't yet have a link
      feed.once('link', onLink)
    } else {
      onLink()
    }
  })
  readStream.on('error', function (err) {
    debug('error in read stream', err)
  })
  return readStream
}

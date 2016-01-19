var disc = require('discovery-channel')
var net = require('net')
var debug = require('debug')('hypercore-server')
var hypercore = require('hypercore')
var assert = require('assert')
var memdb = require('memdb')

module.exports = HypercoreServer

function HypercoreServer (db, opts) {
  if (!(this instanceof HypercoreServer)) return new HypercoreServer(db, opts)

  var self = this

  if (opts && opts.dc) {
    this.dc = opts.dc
  } else {
    this.dc = disc()
  }
  // TODO dear lord what have i done. sublevel vs subleveldown incompatibility?
  // var subDb = sublevel(db)
  var core = this.core = hypercore(memdb()) // subDb.sublevel('core'))
  this.have = {}

  var onServerSocket = function (socket) {
    debug('accepted incoming connection')
    socket.pipe(core.createPeerStream()).pipe(socket)
    socket.on('error', function (err) {
      debug('error in server socket', err)
    })
  }
  this.server = net.createServer(onServerSocket)
  this.outSockets = {}

  this.dc.on('peer', function (hash, peer) {
    // TODO actually look at the hash i guess
    self._connect(peer)
  })
}

HypercoreServer.prototype.listen = function (cb) {
  var self = this

  this.server.listen(0, function (err) {
    assert.ifError(err)
    debug('listening on port', self.server.address().port)
    cb()
  })
}

HypercoreServer.prototype._connect = function (peer) {
  var remoteKey = peer.host + ':' + peer.port

  if (this.outSockets[remoteKey]) {
    // we already have a connection to this peer
    return
  }

  var socket = net.connect(peer.port, peer.host)
  socket.pipe(this.core.createPeerStream()).pipe(socket)
  socket.on('error', function (err) {
    debug('error in client socket', err)
  })

  debug('making client connection', peer.host, peer.port)

  this.outSockets[remoteKey] = socket
}

HypercoreServer.prototype.finalizeFeed = function (feed, cb) {
  var self = this

  feed.finalize(function (err) {
    assert.ifError(err)
    var link = feed.id
    self.dc.add(link.slice(20), self.server.address().port)
    debug('have', link.toString('hex'))
    cb(null, feed.id)
  })
}

HypercoreServer.prototype.getFeed = function (id) {
  this.dc.add(id.slice(20))
  debug('request', id.toString('hex'))

  return this.core.get(id)
}

HypercoreServer.prototype.endWriteStream = function (writeStream, cb) {
  var self = this

  writeStream.end(function (err) {
    assert.ifError(err)
    var link = writeStream.id
    self.dc.add(link.slice(20), self.server.address().port)
    debug('have', link.toString('hex'))
    cb(null, link)
  })
}

HypercoreServer.prototype.createReadStream = function (link) {
  var self = this

  this.dc.on('peer', function (hash, peer) {
    self._connect(peer)
  })

  this.dc.add(link.slice(20))
  debug('request', link.toString('hex'))

  return this.core.createReadStream(link)
}

var destroyHypercore = function (hypercore) {
  for (var link in hypercore._opened) {
    hypercore._close(Buffer(link, 'hex'))
  }
}

HypercoreServer.prototype.destroy = function (cb) {
  this.dc.destroy(function (err) {
    assert.ifError(err)
  })

  this.server.close(function (err) {
    assert.ifError(err)
  })

  for (var i in this.outSockets) {
    // TODO how do do this nicely?
    try {
      this.outSockets[ i ].end()
    } catch (e) {
      debug('error destroying', e)
      throw e
    }
  }

  destroyHypercore(this.core)

  // TODO verify destruction succeeds
  cb()
}

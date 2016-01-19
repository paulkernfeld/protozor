var tape = require('tape')
var memdb = require('memdb')
var TorrentKV = require('../../lib/torrent-kv')
var helpers = require('../helpers')

tape('write and read', function (t) {
  var kv1 = create()
  var kv2 = create()

  var keypair = kv1.new()
  var pubkey = keypair.publicKey
  t.ok(pubkey)

  kv1.put(keypair, 'myvalue', function (err, put) {
    t.error(err)
    t.ok(put)
    t.same(put.store.k, keypair.publicKey)
    t.same(put.hash, TorrentKV.sha1(keypair.publicKey))

    kv2.get(pubkey, function (err, value) {
      t.error(err)
      t.same(value.toString(), 'myvalue')

      helpers.destroyThingsAndEnd(t, [kv1, kv2])
    })
  })
})

tape('write and watch', function (t) {
  var kv1 = create()
  var kv2 = create()

  var keypair = kv1.new()
  var pubkey = keypair.publicKey
  t.ok(pubkey)

  kv1.put(keypair, 'myvalue', function (err, put) {
    t.error(err)
    t.ok(put)
    t.same(put.store.k, pubkey, 'put pubkey')
    t.same(put.hash, TorrentKV.sha1(pubkey), 'put hash')

    kv2.watch(pubkey)

    kv2.on('value', function (eventPubkey, value) {
      t.same(eventPubkey, pubkey, 'watched pubkey')
      t.same(value.toString(), 'myvalue', 'watched value')

      helpers.destroyThingsAndEnd(t, [kv1, kv2])
    })
  })
})

var create = function () {
  return TorrentKV(memdb())
}

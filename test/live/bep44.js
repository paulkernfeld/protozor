var memdb = require('memdb')
var Bep44Protozor = require('../../lib/bep44')
var tape = require('tape')
var helpers = require('../helpers')

tape('holistic feeds', function (t) {
  var bg1 = Bep44Protozor(memdb())
  var bg2 = Bep44Protozor(memdb())

  bg1.server.listen(t.error)
  bg2.server.listen(t.error)

  var feedInfo1 = bg1.new()
  t.ok(feedInfo1.keypair.publicKey, 'pubkey')

  feedInfo1.feed.append('hello', function (err) {
    t.error(err, 'append error')

    bg1.apply(feedInfo1, function (err, put) {
      t.error(err, 'put error')
      t.ok(put, 'put result')

      var feed2 = bg2.get(feedInfo1.keypair.publicKey)

      feed2.once('link', function (link) {
        t.ok(link, 'link')

        feed2.get(0, function (err, block) {
          t.error(err, 'get error')
          t.same(block.toString(), 'hello')

          helpers.destroyThingsAndEnd(t, [bg1, bg2])
        })
      })
    })
  })
})

tape('holistic streams', function (t) {
  var bg1 = Bep44Protozor(memdb())
  var bg2 = Bep44Protozor(memdb())

  bg1.server.listen(t.error)
  bg2.server.listen(t.error)

  var feedInfo1 = bg1.new()
  var ws = bg1.createWriteStream(feedInfo1)

  var feed2 = bg2.get(feedInfo1.keypair.publicKey)
  var rs = bg2.createReadStream(feed2)
  rs.once('data', function (data) {
    t.same(data.toString(), 'one', 'data one')

    rs.once('data', function (data) {
      t.same(data.toString(), 'two', 'data two')

      helpers.destroyThingsAndEnd(t, [bg1, bg2])
    })

    ws.write('two')
  })

  ws.write('one')
})

tape('holistic streams write at once', function (t) {
  var bg1 = Bep44Protozor(memdb())
  var bg2 = Bep44Protozor(memdb())

  bg1.server.listen(t.error)
  bg2.server.listen(t.error)

  var feedInfo1 = bg1.new()
  var ws = bg1.createWriteStream(feedInfo1)
  ws.write('one')
  ws.write('two')
  ws.write('three')

  var feed2 = bg2.get(feedInfo1.keypair.publicKey)
  var rs = bg2.createReadStream(feed2)

  var expected = ['one', 'two', 'three']
  rs.on('data', function (data) {
    t.same(data.toString(), expected.shift(), 'data equivalent')

    if (expected.length === 0) {
      helpers.destroyThingsAndEnd(t, [bg1, bg2])
    }
  })
})

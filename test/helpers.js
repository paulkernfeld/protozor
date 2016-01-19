var HypercoreServer = require('../lib/hypercore-server')
var memdb = require('memdb')
var assert = require('assert')

// This is here so that it can be reused between live and non-live tests
module.exports.makeHypercoreServerFeedTest = function (opts) {
  return function (t) {
    createHypercoreServer(opts, function (server1) {
      var core1 = server1.core

      createHypercoreServer(opts, function (server2) {
        var addFeed = core1.add()
        addFeed.append(['hello', 'world'])

        server1.finalizeFeed(addFeed, function (err, link) {
          t.same(addFeed.blocks, 2, 'two blocks')
          t.error(err, 'finalize error')
          t.ok(link, 'finalize link')

          var getFeed = server2.getFeed(link)

          getFeed.get(0, function (err, block) {
            t.error(err, 'get error')
            t.same(block, new Buffer('hello'), 'get block')

            module.exports.destroyThingsAndEnd(t, [server1, server2])
          })
        })
      })
    })
  }
}

var createHypercoreServer = function (opts, cb) {
  var server = HypercoreServer(memdb(), opts)
  server.listen(function (err) {
    assert.ifError(err)
    cb(server)
  })
}

module.exports.destroyThingsAndEnd = function (t, things) {
  var nLeft = things.length

  var checkDone = function (err) {
    t.error(err)

    nLeft--
    if (nLeft === 0) t.end()
  }

  for (var i in things) {
    things[i].destroy(checkDone)
  }
}

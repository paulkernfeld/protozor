var hypercore = require('hypercore')
var memdb = require('memdb')
var tape = require('tape')
var protozor = require('../lib/protozor')

tape('get nothing', function (t) {
  var greg = create()
  var reader = greg.get('pauls feed')
  reader.get(0, function (err, link) {
    t.ok(err)
    t.error(link)
    t.end()
  })
})

tape('write and read protozor', function (t) {
  var greg = create()

  var writeFeed = greg.add('pauls feed')
  writeFeed.append('whatever', function (err) {
    t.error(err)

    writeFeed.apply(function (err, link) {
      t.error(err)
      t.ok(link)
    })
  })

  var reader = greg.get('pauls feed')
  reader.on('link', function (value) {
    t.ok(value)

    reader.get(0, function (err, value) {
      t.error(err)
      t.same(value, Buffer('whatever'))
      t.end()
    })
  })
})

tape('multiple write and read protozor', function (t) {
  var greg = create()

  var writeFeed = greg.add('pauls feed')
  var reader = greg.get('pauls feed')
  reader.once('link', function (link) {
    t.ok(link, 'link one')

    reader.get(0, function (err, value) {
      t.error(err, 'get one error')
      t.same(value, Buffer('one'), 'value one')

      reader.once('link', function (link2) {
        t.ok(link2, 'link two')

        reader.get(1, function (err, value2) {
          t.error(err, 'get two error')
          t.same(value2, Buffer('two'), 'value two')
          t.end()
        })
      })

      writeFeed.append('two', function (err) {
        t.error(err, 'append two')

        writeFeed.apply(function (err, link) {
          t.error(err, 'apply two error')
          t.ok(link)
        })
      })
    })
  })

  writeFeed.append('one', function (err) {
    t.error(err, 'append one')

    writeFeed.apply(function (err, link) {
      t.error(err, 'apply one error')
      t.ok(link)
    })
  })
})

function create () {
  return protozor(memdb(), hypercore(memdb()))
}

var Bep44Protozor = require('../lib/bep44')
var assert = require('assert')
var through2Map = require('through2-map')

// See `examples/read_to_stdout.js` for how to get an example feed ID
var pubkey = process.argv[ 2 ]
assert(pubkey, 'Specify a hex-encoded Protozor feed ID as the argument')

var bg = Bep44Protozor()
bg.server.listen(function () {
  var feed = bg.get(Buffer(pubkey, 'hex'))
  var stream = bg.createReadStream(feed)

  var addNewlines = through2Map(function (chunk) {
    return chunk + '\n'
  })
  stream.pipe(addNewlines).pipe(process.stdout)
})

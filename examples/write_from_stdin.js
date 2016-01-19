var Bep44Protozor = require('..').bep44
var split = require('split')

var bg = Bep44Protozor()

bg.server.listen(function () {
  var feedInfo = bg.new()
  var stream = bg.createWriteStream(feedInfo)

  console.log('Protozor feed ID is', feedInfo.keypair.publicKey.toString('hex'))
  process.stdin.pipe(split()).pipe(stream)
})

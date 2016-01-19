Protozor
========
A P2P system for replicating streaming signed append-only logs.

A Protozor feed is an append-only log where the ID is a public key and all updates must be signed by the corresponding private key. When a log is updated, a pointer to the new head of the log is broadcast over the BitTorrent network using BEP 44 mutable values. The contents of the log are replicated using hypercore, which means that the contents of a log can be downloaded in any order.

Example
-------
See the `examples` directory for these scripts. The code below should work as-is; you can type into the writing side, and the text will come out the reading side, even if they're running on separate computers. To see what's happening under the hood, [set the `DEBUG` environment variable](https://www.npmjs.com/package/debug).

### Writing

The example below makes a new Protozor feed and writes stdin to it, line by line. It prints out the feed ID, which is needed to read from the feed.

```javascript
var Bep44Protozor = require('protozor').bep44
var split = require('split')

var bg = Bep44Protozor()

bg.server.listen(function () {
  var feedInfo = bg.new()
  var stream = bg.createWriteStream(feedInfo)

  console.log('Protozor feed ID is', feedInfo.keypair.publicKey.toString('hex'))
  process.stdin.pipe(split()).pipe(stream)
})
```

### Reading

The example below reads data from the Protozor feed specified as the argument, and prints it out to stdout.

```javascript
var Bep44Protozor = require('protozor').bep44
var split = require('split')

var bg = Bep44Protozor()

bg.server.listen(function () {
  var feedInfo = bg.new()
  var stream = bg.createWriteStream(feedInfo)

  console.log('Protozor feed ID is', feedInfo.keypair.publicKey.toString('hex'))
  process.stdin.pipe(split()).pipe(stream)
})
```

Status
------
This code works for me, but it's still in an alpha stage. It doesn't handle any kind of firewall or NAT traversal.

API
----

### protozor.bep44

This module makes "batteries-included" Protozor feeds, where feed updates are exchanged using [BEP 44](www.bittorrent.org/beps/bep_0044.html) mutable values. This includes "all the fixins:" key generation, a server for hypercore, and discovery using [discovery-channel](https://github.com/maxogden/discovery-channel).

`Bep44Protozor()` - create a new Bep44Protozor object.

`Bep44Protozor.new()` - create a new feed. Returns a `feedInfo`, i.e. a keypair and a corresponding `WriteFeed`. Note that a Protozor feed is not the same as a hypercore feed -- a Protozor feed is a dynamically updateable pointer that refers to hypercore feeds.

`Bep44Protozor.apply(feedInfo, cb)` - apply the writes from the given `WriteFeed`, and broadcast the new head of the feed out to the network.

`Bep44Protozor.get(pubkey)` - return a new `ReadFeed` for the given pubkey, and request the head of that feed via BEP 44.

`Bep44Protozor.createWriteStream(feedInfo)` - return a writable stream that will write to the feed specified.

`Bep44Protozor.createReadStream(feed)` - given a `ReadFeed`, return a readable stream that reads from the feed. Note that this stream never ends.

`Bep44Protozor.destroy()` - this must be called to release the resources from the object

### protozor.protozor

The core functionality for updateable hypercore feeds. This doesn't include any network logic or key verification logic.

### protozor.hypercore-server

Convenience functions for making a hypercore server, including discovery.

### protozor.torrent-kv

A simple interface for dealing with BEP 44 mutable values.
var tape = require('tape')
var helpers = require('../helpers')

tape('real dc feeds', helpers.makeHypercoreServerFeedTest())

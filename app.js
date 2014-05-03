var xml = require('node-xml-lite');
var express = require('express');
var app = express();
app.use(express.bodyParser());
app.post('/poker-bot', function(req, res){
  // possible actions: raise, bet, fold, call, check and allin
  var actionsAllowed = req.param('actions').split("\n");
  console.log(actionsAllowed+"\n\n");
  res.send(actionsAllowed[actionsAllowed.length-1]);
});

var server = app.listen(3000, function() {
    console.log('Listening on port %d', server.address().port);
});
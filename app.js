var express = require('express');
var app = express();
app.use(express.bodyParser());
app.post('/poker-bot', function(req, res){
  res.send(req.param('name'));
});

var server = app.listen(3000, function() {
    console.log('Listening on port %d', server.address().port);
});
var xml = require('node-xml-lite');
var express = require('express');
var app = express();
app.use(express.bodyParser());
app.post('/poker-bot', function(req, res){
	var playerName = req.param('name');
	// possible actions: raise, bet, fold, call, check and allin
	var actionsAllowed = req.param('actions').split("\n");
	var pocket = req.param('pocket').split(' ');
	var hand = [
		{ rank: pocket[0].split('')[0], suit: pocket[0].split('')[1] },
		{ rank: pocket[1].split('')[0], suit: pocket[1].split('')[1] }
	];
  	var gameState = req.param('state');

	var stateObject = xml.parseString(gameState);
	var objects = {};
	for (var i=0; i < stateObject.childs.length; i++) {
		objects[stateObject.childs[i].name] = stateObject.childs[i];
	}
	// for (var i=0; i < objects['table'].length; i++) {
	// }
	console.log(objects.table.attrib);
	res.send(actionsAllowed[actionsAllowed.length-1]);
});

var server = app.listen(3000, function() {
    console.log('Listening on port %d', server.address().port);
});
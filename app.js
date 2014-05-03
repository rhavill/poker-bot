var xml = require('node-xml-lite');
var express = require('express');
var app = express();
app.use(express.bodyParser());
app.post('/poker-bot', function(req, res){
	var playerName = req.param('name');
	// possible actions: raise, bet, fold, call, check and allin
	var actionsAllowed = req.param('actions').split("\n");
	var pocketCardsText = req.param('pocket').split(' ');
	var pocketCard1 = new Card(pocketCardsText[0]);
	var pocketCard2 = new Card(pocketCardsText[1]);
	var pocket = new Pocket([pocketCard1, pocketCard2]);
  	var gameState = req.param('state');
 console.log(pocketCard1);
console.log(pocketCard2);
console.log(pocket.isPocketPair());

	var stateObject = xml.parseString(gameState);
	var objects = {};
	for (var i=0; i < stateObject.childs.length; i++) {
		objects[stateObject.childs[i].name] = stateObject.childs[i];
	}
	for (var i=0; i < objects['table'].childs.length; i++) {
		// console.log(objects.table.childs[i]);
	}
	for (var i=0; i < objects['betting'].childs.length; i++) {
		// console.log(objects.betting.childs[i]);
	}
	res.send(actionsAllowed[actionsAllowed.length-1]);
});

var server = app.listen(3000, function() {
    console.log('Listening on port %d', server.address().port);
});

function Card(text) {
	this.text = text;
	var parts = text.split('');
	this.rank = parts[0];
	this.suit = parts[1];
}

function Pocket(cards) {
	this.cards = cards;
}
Pocket.prototype.isPocketPair = function() {
	return this.cards[0].rank == this.cards[1].rank;
}

function Community(cards) {
	this.cards = cards;
}
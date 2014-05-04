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
	var stateObject = xml.parseString(gameState);
	var players = [];
	var betting = [];
	var objects = {};
	var communityCards = [];
	for (var i=0; i < stateObject.childs.length; i++) {
		objects[stateObject.childs[i].name] = stateObject.childs[i];
	}
	for (var i=0; i < objects['table'].childs.length; i++) {
		var child = objects.table.childs[i];
		if (child.name == 'player') {
			players.push(new Player(child.attrib.name, child.attrib.sit, child.attrib.stack, child.attrib.in_stack, (child.attrib.sit == objects['table'].attrib.button)));
		}
	}
	for (var i=0; i < objects['betting'].childs.length; i++) {
		var bets = [];
		var child = objects.betting.childs[i];
		if (child.childs) {
			for (var j=0; j < child.childs.length; j++) {
				var grandChild = child.childs[j];
				bets.push(new Bet(grandChild.attrib.player, grandChild.attrib.type, grandChild.attrib.amount));
			}
		}
		if (bets) {
			betting.push(bets);	
		}
	}
	if (objects['community'].childs) {
		for (var i=0; i < objects['community'].childs.length; i++) {
			var child = objects.community.childs[i];
			communityCards.push(new Card(child.attrib.rank + child.attrib.suit));
		}
	}
	var community = new Community(communityCards);
	// for (var i=0; i < betting.length; i++) {
	// 	for (var j=0; j < betting[i].length; j++) {
	// 		console.log('round:'+i+' player:'+betting[i][j].player+' amount:'+betting[i][j].amount);
	// 	}
	// }
	console.log("\n");
	console.log(communityCards);
	for (var i=0; i < objects['betting'].childs.length; i++) {
		// console.log(objects.betting.childs[i]);
	}
	res.send(actionsAllowed[actionsAllowed.length-1]);
});

var server = app.listen(3000, function() {
    console.log('Listening on port %d', server.address().port);
});

function Player(name, position, stack, inStack, hasButton) {
	this.name = name;
	this.position = position;
	this.stack = stack;
	this.inStack = inStack;
	this.hasButton = hasButton;
}

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

function Bet(player, type, amount) {
	this.player = player;
	this.type = type;
	this.amount = amount;
}
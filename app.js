var xml = require('node-xml-lite');
var express = require('express');
var app = express();
app.use(express.bodyParser());
app.post('/poker-bot', function(req, res){
	var playerName = req.param('name');
	// possible actions: raise, bet, fold, call, check and allin
	var actionsAllowed = req.param('actions').split("\n");
	var hand = new Hand([]);
	var pocketCardsText = req.param('pocket').split(' ');
	hand.addCard(new Card(pocketCardsText[0]));
	hand.addCard(new Card(pocketCardsText[1]));
  	var gameState = req.param('state');
	var stateObject = xml.parseString(gameState);
	var players = [];
	var me = null, strategy = null;
	var betting = [];
	var objects = {};

	for (var i=0; i < stateObject.childs.length; i++) {
		objects[stateObject.childs[i].name] = stateObject.childs[i];
	}
	for (var i=0; i < objects['table'].childs.length; i++) {
		var child = objects.table.childs[i];
		if (child.name == 'player') {
			var player = new Player(child.attrib.name, child.attrib.sit, child.attrib.stack, child.attrib.in_stack, (child.attrib.sit == objects['table'].attrib.button));
			if (player.name == playerName) {
				me = player;
			}
			players.push(player);
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
			hand.addCard(new Card(child.attrib.rank + child.attrib.suit));
		}
	}
	switch (playerName) {
		case 'MsMamba':
			strategy = new MambaStrategy(me, players, hand, betting, actionsAllowed);
			break;
		default:
			strategy = new Strategy(me, players, hand, betting, actionsAllowed);	
			//strategy.hand.rankHand();	
	}

	res.send(strategy.playHand());
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

function Hand(cards) {
	this.cards = cards;
}
Hand.prototype.GARBAGE = 0;
Hand.prototype.ACE_HIGH = 1;
Hand.prototype.PAIR = 2;
Hand.prototype.TWO_PAIR = 3;
Hand.prototype.TRIPS = 4;
Hand.prototype.STRAIGHT = 5;
Hand.prototype.FLUSH = 6;
Hand.prototype.FULL_HOUSE = 7;
Hand.prototype.QUADS = 8;
Hand.prototype.STRAIGHT_FLUSH = 9;
Hand.prototype.ranks = ['2','3','4','5','6','7','8','9','T','J','Q','K','A'];
Hand.prototype.addCard = function(card) {
	this.cards.push(card);
}
Hand.prototype.rankHand = function() {
	var rank = this.QUADS;
	this.hand.sort(function (a,b) { return this.ranks.indexOf(a.rank) - this.ranks.indexOf(b.rank); });
	//console.log(rank);
};
Hand.prototype.isPairedPocket = function() {
	if (this.cards.length != 2) {
		return false;
	}
	return (this.cards[0].rank == this.cards[1].rank)
}
Hand.prototype.isSuitedPocket = function() {
	if (this.cards.length != 2) {
		return false;
	}
	return (this.cards[0].suit == this.cards[1].suit)
}
Hand.prototype.isConnectedPocket = function() {
	if (this.cards.length != 2) {
		return false;
	}
	var rankDifference = Math.abs(this.ranks.indexOf(this.cards[0].rank) - this.ranks.indexOf(this.cards[1].rank));
	return (rankDifference == 1 || rankDifference == 12);
}
Hand.prototype.isOneOfPocket = function(pairs) {
	if (this.cards.length != 2) {
		return false;
	}
	for (var i = 0; i < pairs.length; i++) {
		var mustBeSuited = (pairs[i].split('')[2] == 's');
		if (!mustBeSuited || (mustBeSuited && this.isSuitedPocket())) {
			var rank1 = pairs[i].split('')[0];
			var rank2 = pairs[i].split('')[1];
			if ((this.cards[0].rank == rank1 && this.cards[1].rank == rank2) ||
				(this.cards[0].rank == rank2 && this.cards[1].rank == rank1)) {
				return true;
			}

		}
	}
	return false;
}

function Bet(player, type, amount) {
	this.player = player;
	this.type = type;
	this.amount = amount;
}

function Strategy(me, players, hand, betting, actionsAllowed) {
	this.me = me;
	this.players = players;
	this.hand = hand;
	this.betting = betting;
	this.actionsAllowed = actionsAllowed;
}
Strategy.prototype.playHand = function() {	
	var action = 'fold';
	if (this.actionsAllowed.indexOf('check') > -1) {
		action = 'check';
	}
	else if (this.actionsAllowed.indexOf('call') > -1) {
		action = 'call';
	}
	else if (this.actionsAllowed.indexOf('bet') > -1) {
		action = 'bet';
	}
	else if (this.actionsAllowed.indexOf('allin') > -1) {
		action = 'allin';
	}
	return action;
}
function MambaStrategy(me, players, hand, betting, actionsAllowed) {
	this.me = me;
	this.players = players;
	this.hand = hand;
	this.betting = betting;
	this.actionsAllowed = actionsAllowed;
}
MambaStrategy.prototype = Object.create(Strategy.prototype);
MambaStrategy.prototype.playHand = function() {
	return this.actionsAllowed[this.actionsAllowed.length-1];
}

// function unionArrays (x, y) {
//   var obj = {};
//   for (var i = x.length-1; i >= 0; -- i)
//      obj[x[i]] = x[i];
//   for (var i = y.length-1; i >= 0; -- i)
//      obj[y[i]] = y[i];
//   var res = []
//   for (var k in obj) {
//     if (obj.hasOwnProperty(k))  // <-- optional
//       res.push(obj[k]);
//   }
//   return res;
// }
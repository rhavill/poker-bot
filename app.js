var xml = require('node-xml-lite');
var express = require('express');
var fs = require('fs');
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
	var buttonIndex = null;

	if (playerName == 'ShortStack') {
		var d = new Date();
		var fileName = d.getTime().toString();
		fs.open('/tmp/'+fileName+'.log.txt','a', 0666, function(err, fd) {
			fs.write(fd, gameState+"\n\n");
			fs.close(fd);
		});		
	}
	
	for (var i=0; i < stateObject.childs.length; i++) {
		objects[stateObject.childs[i].name] = stateObject.childs[i];
	}
	var buttonSeat = objects['table'].attrib.button;
	for (var i=0; i < objects['table'].childs.length; i++) {
		var child = objects.table.childs[i];
		if (child.name == 'player') {
			var isButton = false;
			if (child.attrib.sit == buttonSeat) {
				isButton = true;
				buttonIndex = i;
			}
			var player = new Player(child.attrib.name, child.attrib.sit, null, child.attrib.stack, child.attrib.in_stack, isButton);
			if (player.name == playerName) {
				me = player;
			}
			players.push(player);
		}
	}
	var reachedButton = false;
	for (var i=0; i < players.length; i++) {
		if (i == buttonIndex) {
			reachedButton = true;
		}
		if (reachedButton) {
			players[i].position = i - buttonIndex;
		}
		else {
			players[i].position = players.length - buttonIndex  + i;
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
		if (bets.length) {
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
		case 'ShortStack':
			strategy = new EdMillerStrategy(me, players, hand, betting, actionsAllowed);
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

function Player(name, seat, position, stack, inStack, hasButton) {
	this.name = name;
	this.seat = seat;
	this.position = position;	
	this.stack = stack;
	this.inStack = inStack;
	this.hasButton = hasButton;
}
Player.prototype.isSmallBlind = function () {
	return this.position == 1;
}
Player.prototype.isBigBlind = function () {
	return this.position == 2;
}
Player.prototype.hasEarlyPosition = function () {
	return this.position > 2 && this.position < 5;
}
Player.prototype.hasMidPosition = function () {
	return this.position > 4 && this.position < 7;
}
Player.prototype.hasLatePosition = function () {
	return this.position == 0 || this.position > 6;
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
	//return this.actionsAllowed[this.actionsAllowed.length-1];
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
Strategy.prototype.getRaiseCount = function() {
	var raiseCount = 0;
	for (var i = 0; i < this.betting[this.betting.length - 1].length; i++) {
		if (this.betting[this.betting.length - 1][i].type == 'raise') {
			raiseCount++;
		}
	}
	return raiseCount;
}
Strategy.prototype.raiseOccurredAfterMe = function() {
	var raiseOccurredAfterMe = false;
	var iMadeABet = false;
	for (var i = 0; i < this.betting[this.betting.length - 1].length; i++) {
		if (this.betting[this.betting.length - 1][i].player == this.me.name) {
			iMadeABet = true;
		}
		else if (this.betting[this.betting.length - 1][i].type == 'raise' && iMadeABet) {
			raiseOccurredAfterMe = true;
		}
	}
	return raiseOccurredAfterMe;
}
// possible actions: raise, bet, fold, call, check and allin
Strategy.prototype.tryToRaise = function() {
	var action = 'allin';
	if (this.actionsAllowed.indexOf('raise') > -1) {
		action = 'raise';
	}
	else if (this.actionsAllowed.indexOf('bet') > -1) {
		action = 'bet';
	}
	else if (this.actionsAllowed.indexOf('call') > -1) {
		action = 'call';
	}
	else if (this.actionsAllowed.indexOf('check') > -1) {
		action = 'check';
	}
	return action;
}
Strategy.prototype.tryToCall = function() {
	var action = 'allin';
	if (this.actionsAllowed.indexOf('call') > -1) {
		action = 'call';
	}
	else if (this.actionsAllowed.indexOf('bet') > -1) {
		action = 'bet';
	}
	else if (this.actionsAllowed.indexOf('check') > -1) {
		action = 'check';
	}
	return action;
}
Strategy.prototype.check = function () {
	return 'check';
}
Strategy.prototype.fold = function () {
	return 'fold';
}
Strategy.prototype.isMyFirstBet = function () {
	var isMyFirstBet = true;
	for (var i=0; i < this.betting[0].length; i++) {
		if (this.betting[0][i].player == this.me.name) {
			isMyFirstBet = false;
		}
	}
	return isMyFirstBet;
}
Strategy.prototype.raiseCountSinceMyFirstBet = function () {
	var count = 0;
	var iMadeABet = false;
	console.log('raiseCountSinceMyFirstBet');
	for (var i = 0; i < this.betting[this.betting.length - 1].length; i++) {
		console.log(this.betting[this.betting.length - 1]);
		if (this.betting[this.betting.length - 1][i].player == this.me.name) {
			iMadeABet = true;
		}
		if (this.betting[this.betting.length - 1][i].type == 'raise' && iMadeABet) {
			count++;
		}
	}
	console.log();
	return count;
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

function EdMillerStrategy(me, players, hand, betting, actionsAllowed) {
	this.me = me;
	this.players = players;
	this.hand = hand;
	this.betting = betting;
	this.actionsAllowed = actionsAllowed;
}
EdMillerStrategy.prototype = Object.create(Strategy.prototype);
EdMillerStrategy.prototype.playHand = function() {
	var raiseCount = this.getRaiseCount();
	var raiseOccurredAfterMe = this.raiseOccurredAfterMe();
	var raiseCountSinceMyFirstBet = this.raiseCountSinceMyFirstBet();
	var action = this.actionsAllowed[this.actionsAllowed.length-1];
	var preflopStrategy = {
		unRaised: {
			early: {
				raiseHands: [
					'AA','KK','QQ','JJ','TT',
					'AKs','AQs','AJs','ATs',
					'KQs',
					'AK','AQ'
				],
				callHands: [
					'99','88','77',
					'KJs',
					'QJs',
					'AJ',
					'KQ'
				]
			},
			middle: {
				raiseHands: [
					'AA','KK','QQ','JJ','TT','99',
					'AKs','AQs','AJs','ATs',
					'KQs','KJs',
					'AK','AQ','AJ',
					'KQ'
				],
				callHands: [
					'88','77','66','55','44','33','22',
					'A9s','A8s','A7s',
					'KTs',
					'QJs','QTs',
					'JTs',
					'AT',
					'KJ'
				]
			},
			late: {
				raiseHands: [
					'AA','KK','QQ','JJ','TT','99','88',
					'AKs','AQs','AJs','ATs','A9s','A8s',
					'KQs','KJs','KTs',
					'QJs',
					'AK','AQ','AJ','AT',
					'KQ','KJ'
				],
				callHands: [
					'77','66','55','44','33','22',
					'A7s','A6s','A5s','A4s','A3s','A2s',
					'K9s',
					'QTs','Q9s',
					'JTs','T9s','98s','87s',
					'J9s','T8s'
				]
			},
			bigBlind: {
				raiseHands: [
					'AA','KK','QQ','JJ','TT','99',
					'AKs','AQs','AJs','ATs',
					'KQs','KJs',
					'AK','AQ','AJ',
					'KQ'
				],
				checkHands: ['*']
			},
			smallBlind: {
				raiseHands: [
					'AA','KK','QQ','JJ','TT','99',
					'AKs','AQs','AJs','ATs',
					'KQs','KJs',
					'AK','AQ','AJ',
					'KQ'
				],
				callHands: [
					'88','77','66','55','44','33','22',
					'A9s','A8s','A7s','A6s','A5s','A4s','A3s','A2s',
					'KTs','K9s','K8s',
					'QJs','QTs','Q9s','Q8s',
					'JTs','T9s','98s','87s','76s','65s','54s',
					'J9s','T8s',
					'AT',
					'KJ'
				]
			}
		},
		raised: {
			// Against a raise from the big blind.
			bigBlind: {
				reRaise: [
					'AA','KK','QQ','JJ',
					'AKs','AQs',
					'AK'
				],
				call: [
					'TT','99','88','77','66','55','44','33','22',
					'AJs','ATs','A9s','A8s','A7s','A6s','A5s','A4s','A3s','A2s',
					'KQs','KJs','KTs','K9s',
					'QJs','QTs','Q9s',
					'JTs','T9s','98s','87s',
					'J9s','T8s',
					'AQ'
				]

			},
			// Against a raise in front of you from non-big blind.
			againstRaise: {
				reRaise: [
					'AA','KK','QQ','JJ','TT',
					'AKs','AQs','AJs',
					'KQs',
					'AK'
				],
				fold: ['*']
			},
			// Against re-raise from any position.
			againstReRaise: {
				reRaise: [
					'AA','KK','QQ',
					'AKs'
				],
				fold: ['*']
			}

		}
	};
	
	// possible actions: raise, bet, fold, call, check and allin
	// If this is the pre-flop betting round:
	if (this.betting.length == 1) {
		console.log('count:'+raiseCount+' after:'+raiseOccurredAfterMe+' sincefirst:'+raiseCountSinceMyFirstBet);
		if (raiseCount) {
			if (raiseCount > 1) {
				if (this.hand.isOneOfPocket(preflopStrategy.raised.againstReRaise.reRaise)) {
					action = this.tryToRaise();
				}
				else {
					action = this.fold();
				}
			}
			else {
				if (this.me.isSmallBlind()) {
					console.log('small');
				}
				else if (this.me.isBigBlind()) {
					console.log('big');
					if (this.hand.isOneOfPocket(preflopStrategy.raised.bigBlind.reRaise)) {
						action = this.tryToRaise();
					}
					else if (this.hand.isOneOfPocket(preflopStrategy.raised.bigBlind.call)) {
						action = this.tryToCall();
					}
					else {
						action = this.fold;
					}
				}
				else if (this.me.hasEarlyPosition()) {
					console.log('early');
				}
				else if (this.me.hasMidPosition()) {
					console.log('mid');
				}
				else if (this.me.hasLatePosition()) {
					console.log('late');	
				}
			}
		}
		else {
			if (this.me.isSmallBlind()) {
				console.log('small unRaised');
			}
			else if (this.me.isBigBlind()) {
				console.log('bigBlind unRaised');
				if (this.hand.isOneOfPocket(preflopStrategy.unRaised.bigBlind.raise)) {
					action = this.tryToRaise();
				}
				else if (this.hand.isOneOfPocket(preflopStrategy.unRaised.bigBlind.call)) {
					action = this.tryToCall();
				}
				else {
					action = this.fold;
				}
			}
			else if (this.me.hasEarlyPosition()) {
				console.log('early unRaised');
			}
			else if (this.me.hasMidPosition()) {
				console.log('mid unRaised');
			}
			else if (this.me.hasLatePosition()) {
				console.log('late unRaised');	
			}
		}
	}
	return action;
}
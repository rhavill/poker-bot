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
	var bettingRound = 0;

	// if (playerName == 'shortstack') {
	// 	var d = new Date();
	// 	var fileName = d.getTime().toString();
	// 	fs.open('/tmp/'+fileName+'.log.txt','a', 0666, function(err, fd) {
	// 		fs.write(fd, gameState+"\n\n");
	// 		fs.close(fd);
	// 	});		
	// }
	
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
		bettingRound = objects['community'].childs.length - 2;
	}
	switch (playerName) {
		// case 'Bro':
		// 	strategy = new MambaStrategy(me, players, hand, bettingRound, betting, actionsAllowed);
		// 	break;
		case 'msmamba':
			strategy = new MambaStrategy(me, players, hand, bettingRound, betting, actionsAllowed);
			break;
		case 'shortstack':
			strategy = new MambaStrategy(me, players, hand, bettingRound, betting, actionsAllowed);
			break;
		default:
			strategy = new EdMillerStrategy(me, players, hand, bettingRound, betting, actionsAllowed);	
	}
	var hasPair = strategy.hand.hasPair();
	var hasTwoPair = strategy.hand.hasTwoPair();
	var hasTopPair = strategy.hand.hasTopPair();
	var hasThreeOfAKind = strategy.hand.hasThreeOfAKind();
	var hasFullHouse = strategy.hand.hasFullHouse();
	var hasFourOfAKind = strategy.hand.hasFourOfAKind();
	var hasFlush = strategy.hand.hasFlush();
	var hasFlushDraw = strategy.hand.hasFlushDraw();
	var hasOverPair = strategy.hand.hasOverPair();
	var hasStraight = strategy.hand.hasStraight();
	var hasStraightDraw = strategy.hand.hasStraightDraw();
	//console.log('round'+bettingRound+' $'+strategy.getPotTotal()+' '+playerName+' min bet:'+strategy.getMinimumAllowedBet()+' big pot?:'+strategy.hasBigPot());
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
};
Hand.prototype.getHighestBoardRank = function() {
	var highestRank = '2';
	for (var i=2; i < this.cards.length; i++) {
		if (this.ranks.indexOf(this.cards[i].rank) > this.ranks.indexOf(highestRank)) {
			highestRank = this.cards[i].rank;
		}
	}
	return highestRank;
}
Hand.prototype.pocketHasHighestPairedRank = function () {
	var pocketHasHighestPairedRank = false;
	if (this.hasPair()) {
		var highestRank = '2';
		var rankCounts = this.getRankCounts();
		for (var rank in rankCounts) {
			if (rankCounts[rank] == 2 && this.ranks.indexOf(rank) > this.ranks.indexOf(highestRank)) {
				highestRank = rank;
			}
		}		
		if (this.cards[0].rank == highestRank || this.cards[1].rank == highestRank) {
			pocketHasHighestPairedRank = true;
		}
	}
	return pocketHasHighestPairedRank;
}
Hand.prototype.getSecondHighestBoardRank = function() {
	var highestRank = '2';
	for (var i=2; i < this.cards.length; i++) {
		if (this.ranks.indexOf(this.cards[i].rank) > this.ranks.indexOf(highestRank)) {
			highestRank = this.cards[i].rank;
		}
	}
	var secondHighestRank = '2';
	for (var i=2; i < this.cards.length; i++) {
		if (this.ranks.indexOf(this.cards[i].rank) > this.ranks.indexOf(secondHighestRank) && 
			this.ranks.indexOf(this.cards[i].rank) < this.ranks.indexOf(highestRank)) {
			secondHighestRank = this.cards[i].rank;
		}
	}
	return secondHighestRank;
}
Hand.prototype.hasCardWithRank = function(rank) {
	var hasCardWithRank = false;
	for (var i=0; i < this.cards.length; i++) {
		if (this.cards[i].rank == rank) {
			hasCardWithRank = true;
		}
	}
	return hasCardWithRank;
}
Hand.prototype.getRankCounts = function() {
	var counts = {};
	for (var i=0; i < this.cards.length; i++) {
		if (counts[this.cards[i].rank]) {
			counts[this.cards[i].rank]++;
		}
		else {
			counts[this.cards[i].rank] = 1;
		}
	}
	return counts;
}
Hand.prototype.getBoardRankCounts = function() {
	var counts = {};
	if (this.cards.length > 2) {
		for (var i=2; i < this.cards.length; i++) {
			if (counts[this.cards[i].rank]) {
				counts[this.cards[i].rank]++;
			}
			else {
				counts[this.cards[i].rank] = 1;
			}
		}
	}
	return counts;
}
Hand.prototype.getSuitCounts = function() {
	var counts = {};
	for (var i=0; i < this.cards.length; i++) {
		if (counts[this.cards[i].suit]) {
			counts[this.cards[i].suit]++;
		}
		else {
			counts[this.cards[i].suit] = 1;
		}
	}
	return counts;	
}
Hand.prototype.hasPair = function() {
	var hasPair = false;
	var rankCounts = this.getRankCounts();
	for (var rank in rankCounts) {
		if (rankCounts[rank] > 1) {
			hasPair = true;
			break;
		}
	}
	return hasPair;
}
Hand.prototype.boardHasPair = function() {
	var boardHasPair = false;
	var rankCounts = this.getBoardRankCounts();
	for (var rank in rankCounts) {
		if (rankCounts[rank] > 1) {
			boardHasPair = true;
			break;
		}
	}
	return boardHasPair;
}
Hand.prototype.hasTopPair = function() {
	var hasTopPair = false;
	var highestRank = this.getHighestBoardRank();
	var rankCounts = this.getRankCounts();
	for (var rank in rankCounts) {
		if (rankCounts[rank] > 1 && rank == highestRank) {
			hasTopPair = true;
			break;
		}
	}
	return hasTopPair;
}
Hand.prototype.hasDecentPair = function() {
	var hasDecentPair = false;
	var secondHighestRank = this.getSecondHighestBoardRank();
	if (this.hasPairedPocket() && this.cards[0].rank >= secondHighestRank) {
		hasDecentPair = true;
	}
	else if (this.cards[0].rank >= secondHighestRank || this.cards[1].rank >= secondHighestRank) {
		var rankCounts = this.getRankCounts();
		for (var rank in rankCounts) {
			if (rankCounts[rank] > 1 && rank == secondHighestRank) {
				hasDecentPair = true;
				break;
			}
		}
	}
	return hasDecentPair;
}
Hand.prototype.hasTwoPair = function() {
	var pairCount = 0;
	var rankCounts = this.getRankCounts();
	for (var rank in rankCounts) {
		if (rankCounts[rank] > 1) {
			pairCount++;
		}
	}
	return (pairCount > 1);
}
Hand.prototype.hasThreeOfAKind = function() {
	var hasThreeOfAKind = false;
	var rankCounts = this.getRankCounts();
	for (var rank in rankCounts) {
		if (rankCounts[rank] > 2) {
			hasThreeOfAKind = true;
			break;
		}
	}
	return hasThreeOfAKind;
}
Hand.prototype.hasFlush = function() {
	var hasFlush = false;
	var suitCounts = this.getSuitCounts();
	for (var suit in suitCounts) {
		if (suitCounts[suit] > 4) {
			hasFlush = true;
			break;
		}
	}
	return hasFlush;
}
Hand.prototype.hasSolidFlush = function() {
	// Maybe should check if suited pocket has same suit as other flush cards
	var hasSolidFlush = false;
	if (this.hasFlush()) {
		if (this.isSuitedPocket()) {
			hasSolidFlush = true;
		}
	}
	return hasSolidFlush;
}
Hand.prototype.hasFlushDraw = function() {
	var hasFlushDraw = false;
	var suitCounts = this.getSuitCounts();
	if (this.cards.length < 7) {
		for (var suit in suitCounts) {
			if (suitCounts[suit] == 4) {
				hasFlushDraw = true;
				break;
			}
		}
	}
	return hasFlushDraw;
}
Hand.prototype.hasSolidFlushDraw = function() {
	// Maybe should check if suited pocket has same suit as other flush cards
	var hasSolidFlushDraw = false;
	if (this.hasFlushDraw()) {
		if (this.isSuitedPocket()) {
			hasSolidFlushDraw = true;
		}
	}
	return hasSolidFlushDraw;
}
Hand.prototype.hasFullHouse = function() {
	var hasFullHouse = false;
	var rankCounts = this.getRankCounts();
	var tripsRank = '';
	for (var rank in rankCounts) {
		if (rankCounts[rank] > 2 && this.ranks.indexOf(rank) > this.ranks.indexOf(tripsRank)) {
			tripsRank = rank;
		}
	}
	if (tripsRank) {
		for (var rank in rankCounts) {
			if (rankCounts[rank] > 1 && rank != tripsRank) {
				hasFullHouse = true;
			}
		}
	}
	return hasFullHouse;
}
Hand.prototype.hasStraight = function() {
	var straightCount = 0;
	var maxStraightCount = 0;
	var sortedCards = [];
	var ranks = this.ranks;
	for (var i=0; i < this.cards.length; i++) {
		sortedCards.push(this.cards[i]);
	}
	sortedCards.sort(
		function (a,b) {
			return ranks.indexOf(a.rank) - ranks.indexOf(b.rank);
		}
	);
	//console.log(sortedCards);
	for (var i=0; i < sortedCards.length; i++) {
		if (straightCount == 0) {
			straightCount = 1;
			if (i == 0 ) {
				if (sortedCards[i].rank == '2' && this.hasCardWithRank('A')) {
					straightCount = 2;
				}
			}
		}
		else {
			var rankDifference = ranks.indexOf(sortedCards[i].rank) - ranks.indexOf(sortedCards[i-1].rank);
			if (rankDifference == 1) {
				straightCount++;
			}
			else if (rankDifference > 1) {
				straightCount = 1;
			}
		}
		if (straightCount > maxStraightCount) {
			maxStraightCount = straightCount;
		}
	}
	return (maxStraightCount > 4);
}
Hand.prototype.hasStraightDraw = function() {
	var straightCount = 0;
	var maxStraightCount = 0;
	var sortedCards = [];
	var ranks = this.ranks;
	var hasGap = false;
	if (this.cards.length < 7) {
		for (var i=0; i < this.cards.length; i++) {
			sortedCards.push(this.cards[i]);
		}
		sortedCards.sort(
			function (a,b) {
				return ranks.indexOf(a.rank) - ranks.indexOf(b.rank);
			}
		);
		for (var i=0; i < sortedCards.length; i++) {
			if (straightCount == 0) {
				straightCount = 1;
				if (i == 0 ) {
					if (sortedCards[i].rank == '2' && this.hasCardWithRank('A')) {
						straightCount = 2;
					}
				}
			}
			else {
				var rankDifference = ranks.indexOf(sortedCards[i].rank) - ranks.indexOf(sortedCards[i-1].rank);
				if (rankDifference == 1) {
					straightCount++;
				}
				if (rankDifference == 2 && !hasGap) {
					straightCount++;
					hasGap = true;
				}
				else if (rankDifference > 1) {
					straightCount = 1;
					hasGap = false;
				}
			}
			if (straightCount > maxStraightCount) {
				maxStraightCount = straightCount;
			}
		}
	}
	return (maxStraightCount > 3);
}
Hand.prototype.hasOpenEndedStraightDraw = function() {
	var straightCount = 0;
	var maxStraightCount = 0;
	var sortedCards = [];
	var ranks = this.ranks;
	if (this.cards.length < 7) {
		for (var i=0; i < this.cards.length; i++) {
			sortedCards.push(this.cards[i]);
		}
		sortedCards.sort(
			function (a,b) {
				return ranks.indexOf(a.rank) - ranks.indexOf(b.rank);
			}
		);
		//console.log(sortedCards);
		for (var i=0; i < sortedCards.length; i++) {
			if (straightCount == 0) {
				straightCount = 1;
			}
			else if (sortedCards[i].rank != 'A') {
				var rankDifference = ranks.indexOf(sortedCards[i].rank) - ranks.indexOf(sortedCards[i-1].rank);
				if (rankDifference == 1) {
					straightCount++;
				}
				else if (rankDifference > 1) {
					straightCount = 1;
				}
			}
			if (straightCount > maxStraightCount) {
				maxStraightCount = straightCount;
			}
			//console.log('i',i,'rank',sortedCards[i].rank,'diff',rankDifference,'count',straightCount,'max',maxStraightCount);
		}
	}
	return (maxStraightCount > 3);
}
Hand.prototype.hasFourOfAKind = function() {
	var hasFourOfAKind = false;
	var rankCounts = this.getRankCounts();
	for (var rank in rankCounts) {
		if (rankCounts[rank] > 3) {
			hasFourOfAKind = true;
			break;
		}
	}
	return hasFourOfAKind;
}
Hand.prototype.hasOverPair = function() {
	var hasOverPair = true;
	if (this.hasPairedPocket()) {
		var highestBoardRank = this.getHighestBoardRank();
		var pocketRank = this.cards[0].rank;
		if (this.ranks.indexOf(highestBoardRank) >= this.ranks.indexOf(pocketRank)) {
			hasOverPair = false;
		}
	}
	else {
		hasOverPair = false;
	}
	return hasOverPair;
}
Hand.prototype.hasWeakPair = function() {
	// Ace with low kicker can be considered a weak pair.
	var hasWeakPair = false;
	if (this.hasPair() && !(this.hasTopPair() || this.hasOverPair())) {
		hasWeakPair = true;
	}
	return hasWeakPair;
}
Hand.prototype.hasPairedPocket = function() {
	return (this.cards[0].rank == this.cards[1].rank)
}
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

function PotOdds() {
}
PotOdds.prototype.getBreakEvenOdds = function(outs, toOneOdds) {
	var toOneOddsForOuts = [undefined, 45.0, 22.0, 14.333, 10.5, 8.2, 6.667, 5.571, 4.75, 4.111, 3.6, 3.182, 2.833, 2.538];
	var oddsForOuts = [undefined, .0218, .0435, .0652, .0867, .1087, .1304, .1522, .1739, .1957, .2174, .2391, .2609, .2826];
	var odds = undefined;
	if (outs && outs < 13) {
		if (toOneOdds) {
			return toOneOddsForOuts[outs];
		}
		else {
			return oddsForOuts[outs];
		}
	}
}

function Bet(player, type, amount) {
	this.player = player;
	this.type = type;
	this.amount = amount;
}

function Strategy(me, players, hand, bettingRound, betting, actionsAllowed) {
	this.me = me;
	this.players = players;
	this.hand = hand;
	this.bettingRound = bettingRound;
	this.betting = betting;
	this.actionsAllowed = actionsAllowed;
}
Strategy.prototype.getPotTotal = function() {
	var potTotal = 0;
	if (this.betting) {
		//console.log(this.players);
		for (var i=0; i < this.players.length; i++) {
			potTotal += parseInt(this.players[i].inStack) - parseInt(this.players[i].stack);
		}
	}
	return potTotal;
}
Strategy.prototype.getBiggestBetThisRound = function(player) {
	var biggestBet = 0;
	if (this.bettingRound == 0) {
		// big blind has bet 20 if this is pre-flop
		if (player) {
			if (player.isSmallBlind()) {
				biggestBet = 10;
			}
			else if (player.isBigBlind()) {
				biggestBet = 20;
			}
		}
		else {
			biggestBet = 20;
		}
	}
	if (this.betting[this.betting.length - 1]) {
		for (var i = 0; i < this.betting[this.betting.length - 1].length; i++) {
			var betAmount = parseInt(this.betting[this.betting.length - 1][i].amount);
			if (player) {
				if (betAmount > biggestBet && this.betting[this.betting.length - 1][i].player == player.name) {
					biggestBet = betAmount;
				}
			}
			else {
				if (betAmount > biggestBet) {
					biggestBet = betAmount;
				}				
			}
		}
	}
	return biggestBet;
}
Strategy.prototype.getMinimumAllowedBet = function() {
	var minimumBet = 0;
	var biggestBet = this.getBiggestBetThisRound();
	if (biggestBet) {
		var myBiggestBet = this.getBiggestBetThisRound(this.me);
		if (biggestBet > myBiggestBet)  {
			minimumBet = biggestBet - myBiggestBet;
		}
	}
	return minimumBet;
}
Strategy.prototype.hasBigPot = function() {
	// pot is usuallly big if someone raises before flop
	// 5.5 big bets (220) is also considered big
	// pot odds of 10 to 1 can also define a large pot
	var hasBigPot = false;
	var bigPotPercent = 1 / 11;
	var min = this.getMinimumAllowedBet();
	var pot = this.getPotTotal();
	if ((min / pot) < bigPotPercent) {
		hasBigPot = true;
	}
	return hasBigPot;
}
Strategy.prototype.hasSmallPot = function() {
	return !this.hasBigPot();
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
// Strategy.prototype.getRaiseCount = function() {
// 	var raiseCount = 0;
// 	if (this.betting[this.betting.length - 1]) {
// 		for (var i = 0; i < this.betting[this.betting.length - 1].length; i++) {
// 			if (this.betting[this.betting.length - 1][i].type == 'raise') {
// 				raiseCount++;
// 			}
// 		}
// 	}
// 	return raiseCount;
// }
Strategy.prototype.iHaveRaised = function() {
	var iHaveRaised = false;
	if (this.betting[this.betting.length - 1]) {
		for (var i = 0; i < this.betting[this.betting.length - 1].length; i++) {
			if (this.betting[this.betting.length - 1][i].player.name == this.me.name) {
				iHaveRaised = true;
			}
		}
	}
	return iHaveRaised;
}
Strategy.prototype.getOtherPlayersRaiseCount = function() {
	var raiseCount = 0;
	var round = this.bettingRound;
	if (this.betting[round]) {
		for (var i = 0; i < this.betting[round].length; i++) {
			if (this.betting[round][i].type == 'raise' &&
				this.betting[round][i].player != this.me.name) {
				raiseCount++;
			}
		}
	}
	return raiseCount;
}
Strategy.prototype.raiseOccurredAfterMe = function() {
	var raiseOccurredAfterMe = false;
	var iMadeABet = false;
	if (this.betting[this.betting.length - 1]) {
		for (var i = 0; i < this.betting[this.betting.length - 1].length; i++) {
			if (this.betting[this.betting.length - 1][i].player == this.me.name) {
				iMadeABet = true;
			}
			else if (this.betting[this.betting.length - 1][i].type == 'raise' && iMadeABet) {
				raiseOccurredAfterMe = true;
			}
		}
	}
	return raiseOccurredAfterMe;
}
Strategy.prototype.raiseCountSinceMyFirstBet = function () {
	var count = 0;
	var iMadeABet = false;
	if (this.betting[this.betting.length - 1]) {
		for (var i = 0; i < this.betting[this.betting.length - 1].length; i++) {
			if (this.betting[this.betting.length - 1][i].player == this.me.name) {
				iMadeABet = true;
			}
			else if (this.betting[this.betting.length - 1][i].type == 'raise' && iMadeABet) {
				count++;
			}
		}
	}
	return count;
}
Strategy.prototype.playerIsPlaying = function(playerName) {
	isPlaying = false;
	for (var i = 0; i < this.players.length; i++) {
		if (this.players[i].name == playerName) {
			isPlaying = true;
		}
	}
	return isPlaying;
}
// possible actions: raise, bet, fold, call, check and allin
Strategy.prototype.tryToRaise = function() {
	var action = 'check';
	if (this.actionsAllowed.indexOf('raise') > -1) {
		action = 'raise';
	}
	else if (this.actionsAllowed.indexOf('bet') > -1) {
		action = 'bet';
	}
	else if (this.actionsAllowed.indexOf('call') > -1) {
		action = 'call';
	}
	else if (this.actionsAllowed.indexOf('allin') > -1) {
		action = 'allin';
	}
	return action;
}
Strategy.prototype.tryToCall = function() {
	var action = 'bet';
	if (this.actionsAllowed.indexOf('call') > -1) {
		action = 'call';
	}
	else if (this.actionsAllowed.indexOf('check') > -1) {
		action = 'check';
	}
	else if (this.actionsAllowed.indexOf('allin') > -1) {
		action = 'allin';
	}
	return action;
}
Strategy.prototype.checkFold = function () {
	var action = 'fold';
	if (this.actionsAllowed.indexOf('check') > -1) {
		action = 'check';
	}
	return action;
}
Strategy.prototype.checkCall = function () {
	var action = 'allin';
	if (this.actionsAllowed.indexOf('check') > -1) {
		action = 'check';
	}
	else if (this.actionsAllowed.indexOf('call') > -1) {
		action = 'call';
	}
	return action;
}
Strategy.prototype.betCall = function () {
	var action = 'allin';
	if (this.actionsAllowed.indexOf('bet') > -1) {
		action = 'bet';
	}
	else if (this.actionsAllowed.indexOf('call') > -1) {
		action = 'call';
	}
	return action;
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
Strategy.prototype.hasFavorablePotOdds = function (potOdds, outs) {
	// increase outs to add some sort of implied odds
	outs++;
	var minimumBet = this.getMinimumAllowedBet();
	var potSize = this.getPotTotal();
	var betPotRatio = minimumBet / potSize;
	var breakEvenOdds = potOdds.getBreakEvenOdds(outs);
	// console.log('favorable odds? minbet '+minimumBet+' pot '+potSize+' bet:pot '+betPotRatio+' outs '+outs+' breakEvenOdds '+breakEvenOdds+' favorable? '+(breakEvenOdds > betPotRatio));
	return (breakEvenOdds > betPotRatio);
}
function MambaStrategy(me, players, hand, bettingRound, betting, actionsAllowed) {
	this.me = me;
	this.players = players;
	this.hand = hand;
	this.bettingRound = bettingRound;
	this.betting = betting;
	this.actionsAllowed = actionsAllowed;
}
MambaStrategy.prototype = Object.create(Strategy.prototype);
MambaStrategy.prototype.playHand = function() {
	//return this.actionsAllowed[this.actionsAllowed.length-1];

	var potOdds = new PotOdds();

	var raiseCount = this.getOtherPlayersRaiseCount();
	var raiseOccurredAfterMe = this.raiseOccurredAfterMe();
	var raiseCountSinceMyFirstBet = this.raiseCountSinceMyFirstBet();
	var iHaveRaised = this.iHaveRaised();
	// var action = this.actionsAllowed[this.actionsAllowed.length-1];
	var action = this.checkFold();
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
	if (this.bettingRound == 0) {
		// console.log('count:'+raiseCount+' after:'+raiseOccurredAfterMe+' sincefirst:'+raiseCountSinceMyFirstBet);
		if (raiseCount > 1) {
			if (this.raiseCountSinceMyFirstBet() == 1 && !this.isMyFirstBet()) {
				action = this.checkCall();
			}
			else if (this.raiseCountSinceMyFirstBet() > 1 && !this.isMyFirstBet() && iHaveRaised) {
				action = this.checkCall();
			}
			else if (raiseCount > 1) {
				if (this.hand.isOneOfPocket(preflopStrategy.raised.againstReRaise.reRaise)) {
					action = this.tryToRaise();
				}
				else {
					action = this.fold();
				}
			}
			else {
				if (this.me.isBigBlind()) {
					if (this.hand.isOneOfPocket(preflopStrategy.raised.bigBlind.reRaise)) {
						action = this.tryToRaise();
					}
					else if (this.hand.isOneOfPocket(preflopStrategy.raised.bigBlind.call)) {
						action = this.tryToCall();
					}
					else {
						action = this.fold();
					}
				}
				else {
					if (this.hand.isOneOfPocket(preflopStrategy.raised.againstRaise.reRaise)) {
						action = this.tryToRaise();
					}
					else {
						action = this.fold();
					}
				}
			}
		}
		else {
			if (this.me.isSmallBlind()) {
				if (this.hand.isOneOfPocket(preflopStrategy.unRaised.smallBlind.raiseHands)) {
					action = this.tryToRaise();
				}
				else if (this.hand.isOneOfPocket(preflopStrategy.unRaised.smallBlind.callHands)) {
					action = this.tryToCall();
				}
				else if (!(this.playerIsPlaying('gaer') || this.playerIsPlaying('simple_bot')) || this.hand.hasCardWithRank('A') || this.hand.hasCardWithRank('K') || this.hand.isPairedPocket()) {
					action = this.checkCall();
				}
				else {
					action = this.fold();
				}
			}
			else if (this.me.isBigBlind()) {
				if (this.hand.isOneOfPocket(preflopStrategy.unRaised.bigBlind.raiseHands)) {
					action = this.tryToRaise();
				}
				else if (!(this.playerIsPlaying('gaer') || this.playerIsPlaying('simple_bot')) || this.hand.hasCardWithRank('A') || this.hand.hasCardWithRank('K') || this.hand.isPairedPocket()) {
					action = this.checkCall();
				}
				else if (!raiseCount) {
					action = this.checkCall();
				}
				else {
					action = this.fold();
				}
			}
			else if (this.me.hasEarlyPosition()) {
				if (this.hand.isOneOfPocket(preflopStrategy.unRaised.early.raiseHands)) {
					action = this.tryToRaise();
				}
				else if (this.hand.isOneOfPocket(preflopStrategy.unRaised.early.callHands)) {
					action = this.tryToCall();
				}
				else if (!(this.playerIsPlaying('gaer') || this.playerIsPlaying('simple_bot')) || this.hand.hasCardWithRank('A') || this.hand.hasCardWithRank('K') || this.hand.isPairedPocket()) {
					action = this.checkCall();
				}
				else {
					action = this.fold();
				}
			}
			else if (this.me.hasMidPosition()) {
				if (this.hand.isOneOfPocket(preflopStrategy.unRaised.middle.raiseHands)) {
					action = this.tryToRaise();
				}
				else if (this.hand.isOneOfPocket(preflopStrategy.unRaised.middle.callHands)) {
					action = this.tryToCall();
				}
				else if (!(this.playerIsPlaying('gaer') || this.playerIsPlaying('simple_bot')) || this.hand.hasCardWithRank('A') || this.hand.hasCardWithRank('K') || this.hand.isPairedPocket()) {
					action = this.checkCall();
				}
				else {
					action = this.fold();
				}
			}
			else if (this.me.hasLatePosition()) {
				if (this.hand.isOneOfPocket(preflopStrategy.unRaised.late.raiseHands)) {
					action = this.tryToRaise();
				}
				else if (this.hand.isOneOfPocket(preflopStrategy.unRaised.late.callHands)) {
					action = this.tryToCall();
				}
				else if (!(this.playerIsPlaying('gaer') || this.playerIsPlaying('simple_bot')) || this.hand.hasCardWithRank('A') || this.hand.hasCardWithRank('K') || this.hand.isPairedPocket()) {
					action = this.checkCall();
				}
				else {
					action = this.fold();
				}
			}
		}
	}
	// post-flop betting rounds
	else {
		var hasPair = this.hand.hasPair();
		var hasOverPair = this.hand.hasOverPair();
		var hasTwoPair = this.hand.hasTwoPair();
		var hasTopPair = this.hand.hasTopPair();
		var hasDecentPair = this.hand.hasDecentPair();
		var hasThreeOfAKind = this.hand.hasThreeOfAKind();
		var hasFullHouse = this.hand.hasFullHouse();
		var hasFourOfAKind = this.hand.hasFourOfAKind();
		var hasFlush = this.hand.hasFlush();
		var hasSolidFlush = this.hand.hasSolidFlush();
		// Maybe a flush draw should only be considered when player has a suited pocket.
		var hasFlushDraw = this.hand.hasFlushDraw();
		var hasSolidFlushDraw = this.hand.hasSolidFlushDraw();
		var hasStraight = this.hand.hasStraight();
		var hasStraightDraw = this.hand.hasStraightDraw();
		var hasOpenEndedStraightDraw = this.hand.hasOpenEndedStraightDraw();
		var isPairedBoard = this.hand.boardHasPair();
		var hasPairedPocket = this.hand.hasPairedPocket();
		var pocketHasHighestPairedRank = this.hand.pocketHasHighestPairedRank();
		// maybe should be less aggressive w/ two pair.
		if ((hasTwoPair && !raiseCount && !isPairedBoard) || hasThreeOfAKind || hasSolidFlush || hasStraight) {
			action = this.tryToRaise();
		}
		else if (hasFlush) {
			action = this.checkCall();
		}
		else if (hasTwoPair && (hasOverPair || hasTopPair) && !raiseCount && pocketHasHighestPairedRank) {
			action = this.tryToRaise();
		}
		else if (hasTwoPair && hasDecentPair && hasPairedPocket) {
			action = this.betCall();
		}
		else if (hasTwoPair) {
			action = this.checkCall();
		}
		else if ((hasOverPair || hasTopPair) && (!isPairedBoard || pocketHasHighestPairedRank)) {
			// Maybe should fold if there is paired board or a flush draw?
			if (raiseCount) {
				action = this.checkCall();
			}
			else {
				action = this.tryToRaise();
			}
		}
		// Flop
		else if (this.bettingRound == 1 && (hasFlushDraw || hasOpenEndedStraightDraw)) {
			if (hasFlushDraw && (raiseCount || !hasSolidFlushDraw)) {
				action = this.checkCall();
			}
			else {
				action = this.tryToRaise();
			}
		}
		else if (this.raiseCountSinceMyFirstBet() == 1 && !this.isMyFirstBet()) {
			// console.log('calling because only 1 raise since my last bet');
			action = this.checkCall();
		}
		else if (this.raiseCountSinceMyFirstBet() > 1 && !this.isMyFirstBet() && iHaveRaised) {
			// console.log('calling because I raised earlier this round');
			action = this.checkCall();
		}
		else if (hasDecentPair && raiseCount) {
			// Fold a weak pair after raise.
			// Maybe should check for extremely big pot size. (favorable for a 2-3 out hand)
			if (this.hasFavorablePotOdds(potOdds, 3)) {
				action = this.checkCall();
			}
			else {
				action = this.checkFold();
			}
		}
		// else if (hasDecentPair && !isPairedBoard) {
		else if (hasDecentPair) {
			action = this.checkCall();
		}
		else if (hasFlushDraw) {
			if (this.hasFavorablePotOdds(potOdds, 9)) {
				action = this.checkCall();
			}
			else {
				action = this.checkFold();
			}
		}
		else if (hasOpenEndedStraightDraw) {
			if (this.hasFavorablePotOdds(potOdds, 8)) {
				action = this.checkCall();
			}
			else {
				action = this.checkFold();
			}
		}
		else if (hasStraightDraw && !hasOpenEndedStraightDraw) {
			if (this.hasFavorablePotOdds(potOdds, 4)) {
				action = this.checkCall();
			}
			else {
				action = this.checkFold();
			}
		}
		else if (this.hand.hasWeakPair()) {
			// Fold a weak pair after raise.
			// Maybe should check for extremely big pot size. (favorable for a 2-3 out hand)
			// Maybe should count a hand paired with the board as 5 outs?
			// Is a two-pair possibility realy worh 5 outs?
			if (this.hasFavorablePotOdds(potOdds, 3)) {
				action = this.checkCall();
			}
			else {
				action = this.checkFold();
			}
		}
		else if (this.hand.hasWeakPair()) {
			action = this.checkFold();
		}
		else if (!hasPair) {
			// do not bet with nothing after the flop.
			// maybe pot size should be factored in this decision
			action = this.checkFold();
		}
	}
	//console.log('biggest:'+this.getBiggestBetThisRound()+'mybiggest:'+this.getBiggestBetThisRound(this.me)+'min:'+this.getMinimumAllowedBet());
	return action;
}

function EdMillerStrategy(me, players, hand, bettingRound, betting, actionsAllowed) {
	this.me = me;
	this.players = players;
	this.hand = hand;
	this.bettingRound = bettingRound;
	this.betting = betting;
	this.actionsAllowed = actionsAllowed;
}
EdMillerStrategy.prototype = Object.create(Strategy.prototype);
EdMillerStrategy.prototype.playHand = function() {

	var potOdds = new PotOdds();

	var raiseCount = this.getOtherPlayersRaiseCount();
	var raiseOccurredAfterMe = this.raiseOccurredAfterMe();
	var raiseCountSinceMyFirstBet = this.raiseCountSinceMyFirstBet();
	var iHaveRaised = this.iHaveRaised();
	// var action = this.actionsAllowed[this.actionsAllowed.length-1];
	var action = this.checkFold();
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
	if (this.bettingRound == 0) {
		// console.log('count:'+raiseCount+' after:'+raiseOccurredAfterMe+' sincefirst:'+raiseCountSinceMyFirstBet);
		if (raiseCount) {
			if (this.raiseCountSinceMyFirstBet() == 1 && !this.isMyFirstBet()) {
				action = this.checkCall();
			}
			else if (this.raiseCountSinceMyFirstBet() > 1 && !this.isMyFirstBet() && iHaveRaised) {
				action = this.checkCall();
			}
			else if (raiseCount > 1) {
				if (this.hand.isOneOfPocket(preflopStrategy.raised.againstReRaise.reRaise)) {
					action = this.tryToRaise();
				}
				else {
					action = this.fold();
				}
			}
			else {
				if (this.me.isBigBlind()) {
					if (this.hand.isOneOfPocket(preflopStrategy.raised.bigBlind.reRaise)) {
						action = this.tryToRaise();
					}
					else if (this.hand.isOneOfPocket(preflopStrategy.raised.bigBlind.call)) {
						action = this.tryToCall();
					}
					else {
						action = this.fold();
					}
				}
				else {
					if (this.hand.isOneOfPocket(preflopStrategy.raised.againstRaise.reRaise)) {
						action = this.tryToRaise();
					}
					else {
						action = this.fold();
					}
				}
			}
		}
		else {
			if (this.me.isSmallBlind()) {
				if (this.hand.isOneOfPocket(preflopStrategy.unRaised.smallBlind.raiseHands)) {
					action = this.tryToRaise();
				}
				else if (this.hand.isOneOfPocket(preflopStrategy.unRaised.smallBlind.callHands)) {
					action = this.tryToCall();
				}
				else {
					action = this.fold();
				}
			}
			else if (this.me.isBigBlind()) {
				if (this.hand.isOneOfPocket(preflopStrategy.unRaised.bigBlind.raiseHands)) {
					action = this.tryToRaise();
				}
				else {
					action = this.checkCall();
				}
			}
			else if (this.me.hasEarlyPosition()) {
				if (this.hand.isOneOfPocket(preflopStrategy.unRaised.early.raiseHands)) {
					action = this.tryToRaise();
				}
				else if (this.hand.isOneOfPocket(preflopStrategy.unRaised.early.callHands)) {
					action = this.tryToCall();
				}
				else {
					action = this.fold();
				}
			}
			else if (this.me.hasMidPosition()) {
				if (this.hand.isOneOfPocket(preflopStrategy.unRaised.middle.raiseHands)) {
					action = this.tryToRaise();
				}
				else if (this.hand.isOneOfPocket(preflopStrategy.unRaised.middle.callHands)) {
					action = this.tryToCall();
				}
				else {
					action = this.fold();
				}
			}
			else if (this.me.hasLatePosition()) {
				if (this.hand.isOneOfPocket(preflopStrategy.unRaised.late.raiseHands)) {
					action = this.tryToRaise();
				}
				else if (this.hand.isOneOfPocket(preflopStrategy.unRaised.late.callHands)) {
					action = this.tryToCall();
				}
				else {
					action = this.fold();
				}
			}
		}
	}
	// post-flop betting rounds
	else {
		var hasPair = this.hand.hasPair();
		var hasOverPair = this.hand.hasOverPair();
		var hasTwoPair = this.hand.hasTwoPair();
		var hasTopPair = this.hand.hasTopPair();
		var hasDecentPair = this.hand.hasDecentPair();
		var hasThreeOfAKind = this.hand.hasThreeOfAKind();
		var hasFullHouse = this.hand.hasFullHouse();
		var hasFourOfAKind = this.hand.hasFourOfAKind();
		var hasFlush = this.hand.hasFlush();
		var hasSolidFlush = this.hand.hasSolidFlush();
		// Maybe a flush draw should only be considered when player has a suited pocket.
		var hasFlushDraw = this.hand.hasFlushDraw();
		var hasSolidFlushDraw = this.hand.hasSolidFlushDraw();
		var hasStraight = this.hand.hasStraight();
		var hasStraightDraw = this.hand.hasStraightDraw();
		var hasOpenEndedStraightDraw = this.hand.hasOpenEndedStraightDraw();
		var isPairedBoard = this.hand.boardHasPair();
		var hasPairedPocket = this.hand.hasPairedPocket();
		var pocketHasHighestPairedRank = this.hand.pocketHasHighestPairedRank();
		// maybe should be less aggressive w/ two pair.
		if ((hasTwoPair && !raiseCount && !isPairedBoard) || hasThreeOfAKind || hasSolidFlush || hasStraight) {
			action = this.tryToRaise();
		}
		else if (hasFlush) {
			action = this.checkCall();
		}
		else if (hasTwoPair && (hasOverPair || hasTopPair) && !raiseCount && pocketHasHighestPairedRank) {
			action = this.tryToRaise();
		}
		else if (hasTwoPair && hasDecentPair && hasPairedPocket) {
			action = this.betCall();
		}
		else if (hasTwoPair) {
			action = this.checkCall();
		}
		else if ((hasOverPair || hasTopPair) && (!isPairedBoard || pocketHasHighestPairedRank)) {
			// Maybe should fold if there is paired board or a flush draw?
			if (raiseCount) {
				action = this.checkCall();
			}
			else {
				action = this.tryToRaise();
			}
		}
		// Flop
		else if (this.bettingRound == 1 && (hasFlushDraw || hasOpenEndedStraightDraw)) {
			if (hasFlushDraw && (raiseCount || !hasSolidFlushDraw)) {
				action = this.checkCall();
			}
			else {
				action = this.tryToRaise();
			}
		}
		else if (this.raiseCountSinceMyFirstBet() == 1 && !this.isMyFirstBet()) {
			// console.log('calling because only 1 raise since my last bet');
			action = this.checkCall();
		}
		else if (this.raiseCountSinceMyFirstBet() > 1 && !this.isMyFirstBet() && iHaveRaised) {
			// console.log('calling because I raised earlier this round');
			action = this.checkCall();
		}
		else if (hasDecentPair && raiseCount) {
			// Fold a weak pair after raise.
			// Maybe should check for extremely big pot size. (favorable for a 2-3 out hand)
			if (this.hasFavorablePotOdds(potOdds, 3)) {
				action = this.checkCall();
			}
			else {
				action = this.checkFold();
			}
		}
		// else if (hasDecentPair && !isPairedBoard) {
		else if (hasDecentPair) {
			action = this.checkCall();
		}
		else if (hasFlushDraw) {
			if (this.hasFavorablePotOdds(potOdds, 9)) {
				action = this.checkCall();
			}
			else {
				action = this.checkFold();
			}
		}
		else if (hasOpenEndedStraightDraw) {
			if (this.hasFavorablePotOdds(potOdds, 8)) {
				action = this.checkCall();
			}
			else {
				action = this.checkFold();
			}
		}
		else if (hasStraightDraw && !hasOpenEndedStraightDraw) {
			if (this.hasFavorablePotOdds(potOdds, 4)) {
				action = this.checkCall();
			}
			else {
				action = this.checkFold();
			}
		}
		else if (this.hand.hasWeakPair()) {
			// Fold a weak pair after raise.
			// Maybe should check for extremely big pot size. (favorable for a 2-3 out hand)
			// Maybe should count a hand paired with the board as 5 outs?
			// Is a two-pair possibility realy worh 5 outs?
			if (this.hasFavorablePotOdds(potOdds, 3)) {
				action = this.checkCall();
			}
			else {
				action = this.checkFold();
			}
		}
		else if (this.hand.hasWeakPair()) {
			action = this.checkFold();
		}
		else if (!hasPair) {
			// do not bet with nothing after the flop.
			// maybe pot size should be factored in this decision
			action = this.checkFold();
		}
	}
	//console.log('biggest:'+this.getBiggestBetThisRound()+'mybiggest:'+this.getBiggestBetThisRound(this.me)+'min:'+this.getMinimumAllowedBet());
	return action;
}

// todo:  do not raise with top pair on board
// avoid raise wars
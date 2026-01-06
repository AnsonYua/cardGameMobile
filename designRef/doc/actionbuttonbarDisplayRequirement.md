1.when it is opponent turn and it is main phase, it will show "waiting for opponent"
2.when it is opponent turn and it is in action step and currentBattle.confirmation.{currentPlayer}=false meaning current player can do some action. then the availableTargets is clickable
3.when it is opponent turn and it is in action step and currentBattle.confirmation.{currentPlayer}=true meaning current player no action can do , it will show "waiting for opponent"
4.if there is blocker phase, show the existing logic button

this is my clarification. for not in opponent turn , follow the existing logic. can u base on
  this to do refactor.
 

can u can do 
main phase -isopponent turn , not oppoent turn
blocker phase  -isopponent turn , not oppoent turn
action phase  -isopponent turn , not oppoent turn
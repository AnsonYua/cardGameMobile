in gameEnv.players.{contextPlayer}.deck.hand, in each hand , there is cardData.level
  and cardData.cost . this cost control or determine if we can play card or (if the play card button show in actionbutton bar). 
  card can only play when 
  
  - For normal plays (not burst) of non-energy cards:
      - Block play if totalEnergy < cardData.level.
      - Block play if availableEnergy < cardData.cost.
  - For energy cards or burst plays:
      - Always allow (no level/cost checks).
  - Use the current game state:
      - totalEnergy = player.zones.energyArea.length
      - availableEnergy = count of energy cards where isRested === false
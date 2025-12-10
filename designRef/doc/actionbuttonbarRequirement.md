1.by default, if previousPhase !== MAIN_PHASE and if gameEnv.phase  = MAIN_PHASE , and gameEnv.currentPlayer = gameId, we should only should End Turn button

2. if click any of help card , it will show Play Card Button and a cancel button. when click cancel, it will go back to normal status in which one End Turn button shown. when card click that card is being highlighted, when cacnel the card will display highlight. the highlight mean a green rect frame in the card.

3.if a base card in handarea is clicked and the play button is clicked, it will call api 
curl 'http://localhost:8080/api/game/player/playCard' \
  -H 'Accept: */*' \
  -H 'Accept-Language: zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7,zh-CN;q=0.6' \
  -H 'Cache-Control: no-cache' \
  -H 'Connection: keep-alive' \
  -H 'Content-Type: application/json' \
  -H 'Origin: http://localhost:3000' \
  -H 'Pragma: no-cache' \
  -H 'Referer: http://localhost:3000/' \
  -H 'Sec-Fetch-Dest: empty' \
  -H 'Sec-Fetch-Mode: cors' \
  -H 'Sec-Fetch-Site: same-site' \
  -H 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36' \
  -H 'sec-ch-ua: "Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "macOS"' \
  --data-raw '{"playerId":"playerId_2","gameId":"{gameId}","action":{"type":"PlayCard","carduid":"{cardUId}","playAs":"base"}}'

4.if a unit card in handarea is clicked and the play button is clicked, it will call api 
curl 'http://localhost:8080/api/game/player/playCard' \
  -H 'Accept: */*' \
  -H 'Accept-Language: zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7,zh-CN;q=0.6' \
  -H 'Cache-Control: no-cache' \
  -H 'Connection: keep-alive' \
  -H 'Content-Type: application/json' \
  -H 'Origin: http://localhost:3000' \
  -H 'Pragma: no-cache' \
  -H 'Referer: http://localhost:3000/' \
  -H 'Sec-Fetch-Dest: empty' \
  -H 'Sec-Fetch-Mode: cors' \
  -H 'Sec-Fetch-Site: same-site' \
  -H 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36' \
  -H 'sec-ch-ua: "Chromium";v="142", "Google Chrome";v="142", "Not_A Brand";v="99"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "macOS"' \
  --data-raw '{"playerId":"playerId_2","gameId":"sample_play_card","action":{"type":"PlayCard","carduid":"ST01-004_f02a0c50-214e-41f4-af02-10cdaa460876","playAs":"unit"}}'
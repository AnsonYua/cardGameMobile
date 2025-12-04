export type StartGamePayload = {
  playerId: string;
  gameConfig: { playerName: string };
};

export class ApiManager {
  constructor(private baseUrl = "http://localhost:8080") {}

  startGame(payload: StartGamePayload): Promise<any> {
    const url = `${this.baseUrl}/api/game/player/startGame`;
    return fetch(url, {
      method: "POST",
      headers: {
        Accept: "*/*",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }).then(async (res) => {
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(`startGame failed: ${res.status} ${res.statusText} ${json ? JSON.stringify(json) : ""}`);
      }
      return json;
    });
  }
}

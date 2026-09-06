export class NotificationHub {
  constructor(private readonly state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    if (request.method === "POST" && request.headers.get("x-sourceboard-internal") === "1") {
      const payload = await request.text();
      for (const socket of this.state.getWebSockets()) {
        try {
          socket.send(payload);
        } catch {
          socket.close(1011, "Notification delivery failed");
        }
      }
      return new Response(null, { status: 204 });
    }
    if (request.headers.get("upgrade")?.toLowerCase() !== "websocket") {
      return new Response("WebSocket upgrade required", { status: 426 });
    }
    const lastSeen = new URL(request.url).searchParams.get("lastSeen");
    const pair = new WebSocketPair();
    this.state.acceptWebSocket(pair[1]);
    pair[1].send(JSON.stringify({ type: "ready", lastSeen: lastSeen ?? null }));
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    if (typeof message === "string" && message === "ping") ws.send("pong");
  }

  webSocketClose(): void {
    // Hibernation API owns socket lifecycle.
  }
}

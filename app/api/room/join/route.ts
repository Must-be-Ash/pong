import { NextResponse } from "next/server"
import Pusher from "pusher"

// Initialize Pusher
const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  useTLS: true,
})

export async function POST(request: Request) {
  try {
    const { roomId, username, userId } = await request.json()

    // Broadcast to the room that a player has joined
    await pusher.trigger(`presence-room-${roomId}`, "player-joined", {
      username,
      userId,
      timestamp: new Date().toISOString(),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error in room join:", error)
    return NextResponse.json({ error: "Failed to join room" }, { status: 500 })
  }
}

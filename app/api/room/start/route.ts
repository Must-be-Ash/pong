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
    const { roomId } = await request.json()

    // Broadcast to the room that the game has started
    await pusher.trigger(`presence-room-${roomId}`, "game-start", {
      timestamp: new Date().toISOString(),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error starting game:", error)
    return NextResponse.json({ error: "Failed to start game" }, { status: 500 })
  }
}

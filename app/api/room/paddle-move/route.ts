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
    const { roomId, userId, paddleY } = await request.json()

    // Broadcast paddle movement to the room
    await pusher.trigger(`presence-room-${roomId}`, "paddle-move", {
      userId,
      paddleY,
      timestamp: new Date().toISOString(),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error in paddle move:", error)
    return NextResponse.json({ error: "Failed to update paddle position" }, { status: 500 })
  }
}

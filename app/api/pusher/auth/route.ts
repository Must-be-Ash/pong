import { NextResponse } from "next/server"
import Pusher from "pusher"

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  useTLS: true,
})

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const socketId = formData.get("socket_id") as string
    const channel = formData.get("channel_name") as string
    const userId = formData.get("user_id") as string
    const username = formData.get("username") as string

    if (!socketId || !channel) {
      throw new Error("Required parameters missing")
    }

    // Authenticate the user for the presence channel
    const authResponse = pusher.authorizeChannel(socketId, channel, {
      user_id: userId || socketId,
      user_info: {
        username: username || "Anonymous"
      }
    })

    return NextResponse.json(authResponse)
  } catch (error) {
    console.error("Error in Pusher auth:", error)
    return NextResponse.json({ error: "Failed to authenticate" }, { status: 500 })
  }
} 
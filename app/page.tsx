"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { v4 as uuidv4 } from "uuid"

export default function Home() {
  const [username, setUsername] = useState("")
  const [roomId, setRoomId] = useState("")
  const router = useRouter()

  // Generate a unique user ID when the component mounts
  useEffect(() => {
    const userId = localStorage.getItem("pong-user-id") || uuidv4()
    localStorage.setItem("pong-user-id", userId)
  }, [])

  const createRoom = () => {
    if (!username) return
    const newRoomId = uuidv4().substring(0, 8)
    router.push(`/room/${newRoomId}?username=${encodeURIComponent(username)}`)
  }

  const joinRoom = () => {
    if (!username || !roomId) return
    router.push(`/room/${roomId}?username=${encodeURIComponent(username)}`)
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-gray-900 to-black p-4">
      <Card className="w-full max-w-md bg-black/50 backdrop-blur-sm border-gray-800">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-white">Multiplayer Pong</CardTitle>
          <CardDescription className="text-gray-400">Create a new game or join an existing one</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="username" className="text-sm font-medium text-gray-200">
              Your Name
            </label>
            <Input
              id="username"
              placeholder="Enter your name"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="bg-gray-800 border-gray-700 text-white"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="roomId" className="text-sm font-medium text-gray-200">
              Room ID (to join existing game)
            </label>
            <Input
              id="roomId"
              placeholder="Enter room ID"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="bg-gray-800 border-gray-700 text-white"
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-2">
          <Button
            onClick={createRoom}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-400 hover:from-blue-500 hover:to-blue-300"
            disabled={!username}
          >
            Create New Game
          </Button>
          <Button
            onClick={joinRoom}
            variant="outline"
            className="w-full border-gray-700 text-gray-200 hover:bg-gray-800"
            disabled={!username || !roomId}
          >
            Join Existing Game
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

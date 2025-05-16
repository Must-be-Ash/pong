"use client"

import { useEffect, useState, useRef } from "react"
import { useParams, useSearchParams } from "next/navigation"
import Pusher from "pusher-js"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"
import { Copy, ArrowLeft } from "lucide-react"
import PongGame from "@/components/pong-game"

interface PusherMember {
  id: string;
  info: {
    username: string;
  };
}

interface PusherMembers {
  count: number;
  members: { [key: string]: { username: string } };
  myID: string;
}

export default function RoomPage() {
  const { id } = useParams()
  const searchParams = useSearchParams()
  const username = searchParams.get("username") || "Anonymous"
  const [isConnected, setIsConnected] = useState(false)
  const [opponent, setOpponent] = useState<string | null>(null)
  const [isHost, setIsHost] = useState(false)
  const [gameStarted, setGameStarted] = useState(false)
  const [inviteUrl, setInviteUrl] = useState("")
  const pusherRef = useRef<Pusher | null>(null)
  const channelRef = useRef<any>(null)
  const userId = useRef<string>("")
  const { toast } = useToast()

  useEffect(() => {
    // Get the user ID from localStorage
    userId.current = localStorage.getItem("pong-user-id") || ""

    // Create the invite URL
    const baseUrl = window.location.origin
    setInviteUrl(`${baseUrl}/room/${id}?username=`)

    // Initialize Pusher
    pusherRef.current = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      authEndpoint: "/api/pusher/auth",
      auth: {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        params: {
          user_id: userId.current,
          username: username
        }
      }
    })

    // Subscribe to the room channel
    const roomChannel = pusherRef.current.subscribe(`presence-room-${id}`)
    channelRef.current = roomChannel

    // Handle connection established
    roomChannel.bind("pusher:subscription_succeeded", (members: PusherMembers) => {
      setIsConnected(true)
      console.log("Connected to presence channel", members)

      // Get all members as an array
      const membersList = Object.entries(members.members)
      
      // Sort members by ID to ensure consistent host assignment
      membersList.sort(([id1], [id2]) => id1.localeCompare(id2))
      
      // First member (lowest ID) is always the host
      const [firstMemberId] = membersList[0] || []
      setIsHost(firstMemberId === userId.current)

      // If there are two players, set the opponent
      if (membersList.length === 2) {
        const otherMember = membersList.find(([id]) => id !== userId.current)
        if (otherMember) {
          const [_, memberInfo] = otherMember
          setOpponent(memberInfo.username)
        }
      }

      // Announce this player's presence
      fetch("/api/room/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          roomId: id,
          username,
          userId: userId.current,
        }),
      })
    })

    // Handle member added
    roomChannel.bind("pusher:member_added", (member: PusherMember) => {
      if (member.id !== userId.current) {
        setOpponent(member.info.username)
        toast({
          title: "Player joined",
          description: `${member.info.username} has joined the game`,
        })
      }
    })

    // Handle member removed
    roomChannel.bind("pusher:member_removed", (member: PusherMember) => {
      if (member.id !== userId.current) {
        setOpponent(null)
        toast({
          title: "Player left",
          description: `${member.info.username} has left the game`,
          variant: "destructive",
        })
      }
    })

    // Handle game start
    roomChannel.bind("game-start", () => {
      setGameStarted(true)
    })

    // Cleanup on unmount
    return () => {
      if (pusherRef.current) {
        pusherRef.current.unsubscribe(`presence-room-${id}`)
        pusherRef.current.disconnect()
      }

      // Announce player leaving
      fetch("/api/room/leave", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          roomId: id,
          userId: userId.current,
        }),
      })
    }
  }, [id, username, toast])

  const copyInviteLink = () => {
    navigator.clipboard.writeText(inviteUrl)
    toast({
      title: "Invite link copied",
      description: "Share this link with your friend to play together",
    })
  }

  const startGame = () => {
    if (!opponent) {
      toast({
        title: "Cannot start game",
        description: "Waiting for another player to join",
        variant: "destructive",
      })
      return
    }

    fetch("/api/room/start", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        roomId: id,
      }),
    })
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-gray-900 to-black p-4">
      <div className="w-full max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/" className="flex items-center text-gray-400 hover:text-white">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Lobby
          </Link>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white">Room: {id}</h1>
            <p className="text-gray-400">Playing as: {username}</p>
          </div>
          <div className="w-24"></div> {/* Spacer for alignment */}
        </div>

        {gameStarted ? (
          <PongGame roomId={id as string} isHost={isHost} username={username} opponent={opponent || "Opponent"} />
        ) : (
          <div className="rounded-lg bg-black/50 backdrop-blur-sm border border-gray-800 p-6">
            <div className="mb-6 text-center">
              <h2 className="text-xl font-semibold text-white mb-2">
                {isConnected ? "Waiting Room" : "Connecting..."}
              </h2>
              <p className="text-gray-400">
                {opponent ? `${opponent} has joined. Ready to play!` : "Waiting for another player to join..."}
              </p>
            </div>

            <div className="mb-6">
              <div className="flex items-center space-x-2 mb-2">
                <p className="text-gray-300">Invite a friend:</p>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-gray-700 text-gray-300 hover:bg-gray-800"
                  onClick={copyInviteLink}
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Link
                </Button>
              </div>
              <div className="flex items-center space-x-2">
                <div className="text-xs text-gray-500 truncate flex-1 bg-gray-800 rounded p-2">{inviteUrl}</div>
              </div>
            </div>

            <div className="flex justify-center">
              <Button
                onClick={startGame}
                disabled={!opponent || !isHost}
                className="bg-gradient-to-r from-blue-600 to-blue-400 hover:from-blue-500 hover:to-blue-300"
              >
                {isHost ? (opponent ? "Start Game" : "Waiting for Player...") : "Waiting for Host to Start..."}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

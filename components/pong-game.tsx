"use client"

import type React from "react"

import { useEffect, useRef, useState } from "react"
import Pusher from "pusher-js"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"

interface PongGameProps {
  roomId: string
  isHost: boolean
  username: string
  opponent: string
}

interface GameState {
  ballX: number
  ballY: number
  ballSpeedX: number
  ballSpeedY: number
  paddle1Y: number
  paddle2Y: number
  score1: number
  score2: number
}

const CANVAS_WIDTH = 800
const CANVAS_HEIGHT = 500
const PADDLE_HEIGHT = 100
const PADDLE_WIDTH = 15
const BALL_SIZE = 15
const PADDLE_SPEED = 10

export default function PongGame({ roomId, isHost, username, opponent }: PongGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [gameState, setGameState] = useState<GameState>({
    ballX: CANVAS_WIDTH / 2,
    ballY: CANVAS_HEIGHT / 2,
    ballSpeedX: 5,
    ballSpeedY: 5,
    paddle1Y: CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2,
    paddle2Y: CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2,
    score1: 0,
    score2: 0,
  })
  const [isGameOver, setIsGameOver] = useState(false)
  const [winner, setWinner] = useState<string | null>(null)
  const pusherRef = useRef<Pusher | null>(null)
  const channelRef = useRef<any>(null)
  const animationRef = useRef<number>(0)
  const userId = useRef<string>("")
  const { toast } = useToast()

  // Initialize game
  useEffect(() => {
    userId.current = localStorage.getItem("pong-user-id") || ""

    // Initialize Pusher if not already initialized
    if (!pusherRef.current) {
      pusherRef.current = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
        cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      })

      const channel = pusherRef.current.subscribe(`presence-room-${roomId}`)
      channelRef.current = channel

      // Handle paddle movement from opponent
      channel.bind("paddle-move", (data: any) => {
        if (data.userId !== userId.current) {
          setGameState((prev) => ({
            ...prev,
            paddle2Y: isHost ? data.paddleY : prev.paddle2Y,
            paddle1Y: !isHost ? data.paddleY : prev.paddle1Y,
          }))
        }
      })

      // Handle game state updates from host
      channel.bind("game-state", (data: GameState) => {
        if (!isHost) {
          setGameState(data)
        }
      })

      // Handle game over
      channel.bind("game-over", (data: { winner: string }) => {
        setIsGameOver(true)
        setWinner(data.winner)
        cancelAnimationFrame(animationRef.current)

        toast({
          title: "Game Over",
          description: `${data.winner} wins the game!`,
        })
      })
    }

    // Start game loop if host
    if (isHost) {
      startGameLoop()
    }

    // Handle keyboard input
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp" || e.key === "w") {
        movePaddle(-PADDLE_SPEED)
      } else if (e.key === "ArrowDown" || e.key === "s") {
        movePaddle(PADDLE_SPEED)
      }
    }

    window.addEventListener("keydown", handleKeyDown)

    // Cleanup
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      cancelAnimationFrame(animationRef.current)

      if (pusherRef.current) {
        pusherRef.current.unsubscribe(`presence-room-${roomId}`)
      }
    }
  }, [roomId, isHost, toast, opponent, username])

  // Draw game on canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Clear canvas
    ctx.fillStyle = "#000"
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    // Draw center line
    ctx.strokeStyle = "#333"
    ctx.setLineDash([10, 15])
    ctx.beginPath()
    ctx.moveTo(CANVAS_WIDTH / 2, 0)
    ctx.lineTo(CANVAS_WIDTH / 2, CANVAS_HEIGHT)
    ctx.stroke()
    ctx.setLineDash([])

    // Draw paddles
    ctx.fillStyle = "#fff"
    ctx.fillRect(0, gameState.paddle1Y, PADDLE_WIDTH, PADDLE_HEIGHT)
    ctx.fillRect(CANVAS_WIDTH - PADDLE_WIDTH, gameState.paddle2Y, PADDLE_WIDTH, PADDLE_HEIGHT)

    // Draw ball
    ctx.fillRect(gameState.ballX - BALL_SIZE / 2, gameState.ballY - BALL_SIZE / 2, BALL_SIZE, BALL_SIZE)

    // Draw scores
    ctx.font = "32px Arial"
    ctx.fillText(gameState.score1.toString(), CANVAS_WIDTH / 4, 50)
    ctx.fillText(gameState.score2.toString(), (CANVAS_WIDTH / 4) * 3, 50)

    // Draw player names
    ctx.font = "16px Arial"
    ctx.fillText(isHost ? username : opponent, CANVAS_WIDTH / 4, 80)
    ctx.fillText(isHost ? opponent : username, (CANVAS_WIDTH / 4) * 3, 80)
  }, [gameState, isHost, username, opponent])

  // Game loop
  const startGameLoop = () => {
    if (!isHost) return

    const updateGame = () => {
      setGameState((prev) => {
        const newState = { ...prev }

        // Move ball
        newState.ballX += newState.ballSpeedX
        newState.ballY += newState.ballSpeedY

        // Ball collision with top and bottom walls
        if (newState.ballY <= 0 || newState.ballY >= CANVAS_HEIGHT) {
          newState.ballSpeedY = -newState.ballSpeedY
        }

        // Ball collision with paddles
        if (
          newState.ballX <= PADDLE_WIDTH &&
          newState.ballY >= newState.paddle1Y &&
          newState.ballY <= newState.paddle1Y + PADDLE_HEIGHT
        ) {
          newState.ballSpeedX = -newState.ballSpeedX
          // Add some randomness to the ball direction
          newState.ballSpeedY += Math.random() * 2 - 1
        }

        if (
          newState.ballX >= CANVAS_WIDTH - PADDLE_WIDTH &&
          newState.ballY >= newState.paddle2Y &&
          newState.ballY <= newState.paddle2Y + PADDLE_HEIGHT
        ) {
          newState.ballSpeedX = -newState.ballSpeedX
          // Add some randomness to the ball direction
          newState.ballSpeedY += Math.random() * 2 - 1
        }

        // Ball out of bounds - score
        if (newState.ballX < 0) {
          // Player 2 scores
          newState.score2 += 1
          resetBall(newState)

          // Check for game over
          if (newState.score2 >= 5) {
            endGame(opponent)
          }
        }

        if (newState.ballX > CANVAS_WIDTH) {
          // Player 1 scores
          newState.score1 += 1
          resetBall(newState)

          // Check for game over
          if (newState.score1 >= 5) {
            endGame(username)
          }
        }

        // Send game state to other player
        if (channelRef.current) {
          channelRef.current.trigger("client-game-state", newState)
        }

        return newState
      })

      animationRef.current = requestAnimationFrame(updateGame)
    }

    animationRef.current = requestAnimationFrame(updateGame)
  }

  // Reset ball position
  const resetBall = (state: GameState) => {
    state.ballX = CANVAS_WIDTH / 2
    state.ballY = CANVAS_HEIGHT / 2
    state.ballSpeedX = 5 * (Math.random() > 0.5 ? 1 : -1)
    state.ballSpeedY = 5 * (Math.random() > 0.5 ? 1 : -1)
  }

  // End game
  const endGame = (winnerName: string) => {
    setIsGameOver(true)
    setWinner(winnerName)
    cancelAnimationFrame(animationRef.current)

    // Notify other player
    fetch("/api/room/game-over", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        roomId,
        winner: winnerName,
      }),
    })
  }

  // Move paddle
  const movePaddle = (delta: number) => {
    setGameState((prev) => {
      const paddleY = isHost ? prev.paddle1Y : prev.paddle2Y
      const newPaddleY = Math.max(0, Math.min(CANVAS_HEIGHT - PADDLE_HEIGHT, paddleY + delta))

      // Send paddle position to other player
      fetch("/api/room/paddle-move", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          roomId,
          userId: userId.current,
          paddleY: newPaddleY,
        }),
      })

      return {
        ...prev,
        paddle1Y: isHost ? newPaddleY : prev.paddle1Y,
        paddle2Y: !isHost ? newPaddleY : prev.paddle2Y,
      }
    })
  }

  // Handle touch/mouse controls for mobile
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const y = e.clientY - rect.top

    const paddleY = isHost ? gameState.paddle1Y : gameState.paddle2Y
    const paddleCenter = paddleY + PADDLE_HEIGHT / 2

    if (y < paddleCenter) {
      movePaddle(-PADDLE_SPEED * 2)
    } else {
      movePaddle(PADDLE_SPEED * 2)
    }
  }

  // Restart game
  const restartGame = () => {
    if (!isHost) return

    setIsGameOver(false)
    setWinner(null)

    setGameState({
      ballX: CANVAS_WIDTH / 2,
      ballY: CANVAS_HEIGHT / 2,
      ballSpeedX: 5,
      ballSpeedY: 5,
      paddle1Y: CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2,
      paddle2Y: CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2,
      score1: 0,
      score2: 0,
    })

    fetch("/api/room/restart", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        roomId,
      }),
    })

    startGameLoop()
  }

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="border border-gray-700 rounded-lg bg-black"
          onClick={handleCanvasClick}
        />

        {isGameOver && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 rounded-lg">
            <h2 className="text-3xl font-bold text-white mb-4">Game Over</h2>
            <p className="text-xl text-white mb-6">{winner === username ? "You win!" : `${winner} wins!`}</p>
            {isHost && (
              <Button onClick={restartGame} className="bg-gradient-to-r from-blue-600 to-blue-400">
                Play Again
              </Button>
            )}
            {!isHost && <p className="text-gray-400">Waiting for host to restart...</p>}
          </div>
        )}
      </div>

      <div className="mt-6 text-center">
        <p className="text-gray-400 mb-2">Use arrow keys or W/S to move your paddle</p>
        <p className="text-gray-400">First to 5 points wins!</p>
      </div>
    </div>
  )
}

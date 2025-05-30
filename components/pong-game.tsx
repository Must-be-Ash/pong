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
  isPlaying: boolean
  countdown: number
}

const CANVAS_WIDTH = 800
const CANVAS_HEIGHT = 500
const PADDLE_HEIGHT = 100
const PADDLE_WIDTH = 15
const BALL_SIZE = 15
const PADDLE_SPEED = 10
const COUNTDOWN_START = 3

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
    isPlaying: false,
    countdown: COUNTDOWN_START,
  })
  const [isGameOver, setIsGameOver] = useState(false)
  const [winner, setWinner] = useState<string | null>(null)
  const pusherRef = useRef<Pusher | null>(null)
  const channelRef = useRef<any>(null)
  const animationRef = useRef<number>(0)
  const countdownTimerRef = useRef<NodeJS.Timeout | null>(null)
  const userId = useRef<string>("")
  const { toast } = useToast()

  // Initialize game
  useEffect(() => {
    userId.current = localStorage.getItem("pong-user-id") || ""

    // Initialize Pusher if not already initialized
    if (!pusherRef.current) {
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

      const channel = pusherRef.current.subscribe(`presence-room-${roomId}`)
      channelRef.current = channel

      // Handle paddle movement from opponent
      channel.bind("client-paddle-move", (data: any) => {
        if (data.userId !== userId.current) {
          setGameState((prev) => ({
            ...prev,
            paddle2Y: isHost ? data.paddleY : prev.paddle2Y,
            paddle1Y: !isHost ? data.paddleY : prev.paddle1Y,
          }))
        }
      })

      // Handle game state updates from host
      channel.bind("client-game-state", (newState: GameState) => {
        if (!isHost) {
          setGameState(newState)
        }
      })

      // Handle countdown updates
      channel.bind("client-countdown", (data: { countdown: number }) => {
        if (!isHost) {
          setGameState(prev => ({ ...prev, countdown: data.countdown }))
        }
      })

      // Handle game start
      channel.bind("client-game-start", () => {
        if (!isHost) {
          setGameState(prev => ({ ...prev, isPlaying: true }))
        }
      })

      // Handle game over
      channel.bind("client-game-over", (data: { winner: string }) => {
        setIsGameOver(true)
        setWinner(data.winner)
        setGameState(prev => ({ ...prev, isPlaying: false }))
        cancelAnimationFrame(animationRef.current)

        toast({
          title: "Game Over",
          description: `${data.winner} wins the game!`,
        })
      })
    }

    // Start countdown
    startCountdown()

    // Handle keyboard input
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!gameState.isPlaying) return
      
      if (e.key === "ArrowUp" || e.key.toLowerCase() === "w") {
        movePaddle(-PADDLE_SPEED)
      } else if (e.key === "ArrowDown" || e.key.toLowerCase() === "s") {
        movePaddle(PADDLE_SPEED)
      }
    }

    window.addEventListener("keydown", handleKeyDown)

    // Cleanup
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      if (countdownTimerRef.current) {
        clearInterval(countdownTimerRef.current)
      }
      cancelAnimationFrame(animationRef.current)
      if (pusherRef.current) {
        pusherRef.current.unsubscribe(`presence-room-${roomId}`)
      }
    }
  }, [roomId, isHost, toast, opponent, username])

  // Start countdown
  const startCountdown = () => {
    if (!isHost) return

    setGameState(prev => ({ ...prev, countdown: COUNTDOWN_START }))
    
    countdownTimerRef.current = setInterval(() => {
      setGameState(prev => {
        const newState = {
          ...prev,
          countdown: prev.countdown - 1
        }

        // Broadcast countdown
        if (channelRef.current) {
          channelRef.current.trigger("client-countdown", { countdown: newState.countdown })
        }

        if (newState.countdown <= 0) {
          clearInterval(countdownTimerRef.current!)
          newState.isPlaying = true
          
          // Broadcast game start
          if (channelRef.current) {
            channelRef.current.trigger("client-game-start", {})
          }
          
          startGameLoop()
        }

        return newState
      })
    }, 1000)
  }

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

    // Draw countdown if not playing
    if (!gameState.isPlaying && gameState.countdown > 0) {
      ctx.font = "64px Arial"
      ctx.fillStyle = "#fff"
      ctx.textAlign = "center"
      ctx.fillText(gameState.countdown.toString(), CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2)
      ctx.textAlign = "left"
    }

    // Draw paddles
    ctx.fillStyle = "#fff"
    ctx.fillRect(0, gameState.paddle1Y, PADDLE_WIDTH, PADDLE_HEIGHT)
    ctx.fillRect(CANVAS_WIDTH - PADDLE_WIDTH, gameState.paddle2Y, PADDLE_WIDTH, PADDLE_HEIGHT)

    // Draw ball if playing
    if (gameState.isPlaying) {
      ctx.fillRect(gameState.ballX - BALL_SIZE / 2, gameState.ballY - BALL_SIZE / 2, BALL_SIZE, BALL_SIZE)
    }

    // Draw scores
    ctx.font = "32px Arial"
    ctx.fillStyle = "#fff"
    if (isHost) {
      ctx.fillText(gameState.score1.toString(), CANVAS_WIDTH / 4, 50)
      ctx.fillText(gameState.score2.toString(), (CANVAS_WIDTH / 4) * 3, 50)
    } else {
      ctx.fillText(gameState.score2.toString(), CANVAS_WIDTH / 4, 50)
      ctx.fillText(gameState.score1.toString(), (CANVAS_WIDTH / 4) * 3, 50)
    }

    // Draw player names
    ctx.font = "16px Arial"
    if (isHost) {
      ctx.fillText(username, CANVAS_WIDTH / 4, 80)
      ctx.fillText(opponent, (CANVAS_WIDTH / 4) * 3, 80)
    } else {
      ctx.fillText(username, (CANVAS_WIDTH / 4) * 3, 80)
      ctx.fillText(opponent, CANVAS_WIDTH / 4, 80)
    }
  }, [gameState, isHost, username, opponent])

  // Game loop
  const startGameLoop = () => {
    if (!isHost) return

    const updateGame = () => {
      setGameState((prev) => {
        if (!prev.isPlaying) return prev

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
          newState.ballSpeedX = Math.abs(newState.ballSpeedX) // Ensure ball moves right
          newState.ballSpeedY += (Math.random() * 2 - 1) * 0.5 // Reduced randomness
        }

        if (
          newState.ballX >= CANVAS_WIDTH - PADDLE_WIDTH &&
          newState.ballY >= newState.paddle2Y &&
          newState.ballY <= newState.paddle2Y + PADDLE_HEIGHT
        ) {
          newState.ballSpeedX = -Math.abs(newState.ballSpeedX) // Ensure ball moves left
          newState.ballSpeedY += (Math.random() * 2 - 1) * 0.5 // Reduced randomness
        }

        // Ball out of bounds - score
        if (newState.ballX < 0) {
          newState.score2 += 1
          resetBall(newState)

          if (newState.score2 >= 5) {
            endGame(!isHost ? username : opponent)
            return newState
          }
        }

        if (newState.ballX > CANVAS_WIDTH) {
          newState.score1 += 1
          resetBall(newState)

          if (newState.score1 >= 5) {
            endGame(isHost ? username : opponent)
            return newState
          }
        }

        // Keep ball speed in check
        const maxSpeed = 10
        newState.ballSpeedY = Math.max(Math.min(newState.ballSpeedY, maxSpeed), -maxSpeed)

        // Send game state to other player
        if (channelRef.current) {
          channelRef.current.trigger("client-game-state", newState)
        }

        return newState
      })

      // Continue the game loop
      animationRef.current = requestAnimationFrame(updateGame)
    }

    // Start the game loop
    animationRef.current = requestAnimationFrame(updateGame)
  }

  // Reset ball position
  const resetBall = (state: GameState) => {
    state.ballX = CANVAS_WIDTH / 2
    state.ballY = CANVAS_HEIGHT / 2
    state.ballSpeedX = 5 * (Math.random() > 0.5 ? 1 : -1)
    state.ballSpeedY = (Math.random() * 4 - 2) // Reduced initial vertical speed
  }

  // End game
  const endGame = (winnerName: string) => {
    setIsGameOver(true)
    setWinner(winnerName)
    setGameState(prev => ({ ...prev, isPlaying: false }))
    cancelAnimationFrame(animationRef.current)

    if (channelRef.current) {
      channelRef.current.trigger("client-game-over", { winner: winnerName })
    }
  }

  // Move paddle
  const movePaddle = (delta: number) => {
    if (!gameState.isPlaying) return

    setGameState((prev) => {
      const paddleY = isHost ? prev.paddle1Y : prev.paddle2Y
      const newPaddleY = Math.max(0, Math.min(CANVAS_HEIGHT - PADDLE_HEIGHT, paddleY + delta))

      // Send paddle movement to other player immediately
      if (channelRef.current) {
        channelRef.current.trigger("client-paddle-move", {
          userId: userId.current,
          paddleY: newPaddleY,
        })
      }

      return {
        ...prev,
        paddle1Y: isHost ? newPaddleY : prev.paddle1Y,
        paddle2Y: !isHost ? newPaddleY : prev.paddle2Y,
      }
    })
  }

  // Handle touch/mouse controls
  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!gameState.isPlaying) return

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
      isPlaying: false,
      countdown: COUNTDOWN_START,
    })

    startCountdown()
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

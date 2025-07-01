import { Webhook } from "svix"
import { WebhookEvent } from "@clerk/nextjs/server"
import prisma from "@/lib/client"
import { NextRequest } from "next/server"

// Clerk webhook secret (configure dans .env.local)
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET

export async function POST(req: NextRequest) {
  if (!WEBHOOK_SECRET) {
    throw new Error("WEBHOOK_SECRET is missing in environment variables.")
  }

  // Récupération des headers nécessaires
  const svix_id = req.headers.get("svix-id")
  const svix_timestamp = req.headers.get("svix-timestamp")
  const svix_signature = req.headers.get("svix-signature")

  if (!(svix_id && svix_timestamp && svix_signature)) {
    return new Response("Missing required Svix headers", { status: 400 })
  }

  const payload = await req.json()
  const body = JSON.stringify(payload)

  const wh = new Webhook(WEBHOOK_SECRET)
  let evt: WebhookEvent

  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent
  } catch (err) {
    console.error("Webhook verification failed:", err)
    return new Response("Invalid webhook signature", { status: 400 })
  }

  const eventType = evt.type
  const { id, username, image_url } = payload.data

  try {
    if (eventType === "user.created") {
      await prisma.user.create({
        data: {
          id,
          username,
          avatar: image_url || "/noAvatar.png",
          cover: "/noCover.png",
        },
      })
      return new Response("User has been created!", { status: 200 })
    }

    if (eventType === "user.updated") {
      await prisma.user.update({
        where: { id },
        data: {
          username,
          avatar: image_url || "/noAvatar.png",
        },
      })
      return new Response("User has been updated!", { status: 200 })
    }
  } catch (err) {
    console.error("Database operation failed:", err)
    return new Response("Failed to process user data", { status: 500 })
  }

  return new Response("Webhook received", { status: 200 })
}
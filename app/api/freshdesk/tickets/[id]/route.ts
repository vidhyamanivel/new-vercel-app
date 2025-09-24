import { type NextRequest, NextResponse } from "next/server"
import { FreshdeskAPI, freshdeskConfig } from "@/lib/freshdesk-api"

// API route to fetch specific ticket details
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ticketId = Number.parseInt(params.id)

    if (!ticketId) {
      return NextResponse.json({ error: "Invalid ticket ID" }, { status: 400 })
    }

    // Check if environment variables are properly configured
    if (!freshdeskConfig.domain || freshdeskConfig.domain === "" || freshdeskConfig.domain === "your-domain") {
      return NextResponse.json(
        {
          error: "Configuration Error",
          details: "FRESHDESK_DOMAIN environment variable is not set. Please add it in Project Settings.",
        },
        { status: 500 },
      )
    }

    if (!freshdeskConfig.apiKey || freshdeskConfig.apiKey === "" || freshdeskConfig.apiKey === "your-api-key") {
      return NextResponse.json(
        {
          error: "Configuration Error",
          details: "FRESHDESK_API_KEY environment variable is not set. Please add it in Project Settings.",
        },
        { status: 500 },
      )
    }

    const freshdesk = new FreshdeskAPI(freshdeskConfig)

    try {
      const ticketData = await freshdesk.getTicket(ticketId)

      const transformedTicket = {
        id: ticketData.id,
        subject: ticketData.subject,
        description: ticketData.description_text || ticketData.description,
        status:
          ticketData.status === 2
            ? "open"
            : ticketData.status === 3
              ? "pending"
              : ticketData.status === 4
                ? "resolved"
                : ticketData.status === 5
                  ? "closed"
                  : "open",
        priority:
          ticketData.priority === 1
            ? "low"
            : ticketData.priority === 2
              ? "medium"
              : ticketData.priority === 3
                ? "high"
                : ticketData.priority === 4
                  ? "urgent"
                  : "medium",
        requester: {
          name: ticketData.requester?.name || "Unknown",
          email: ticketData.requester?.email || "unknown@example.com",
          phone: ticketData.requester?.phone,
          avatar: ticketData.requester?.avatar,
        },
        agent: ticketData.responder_id
          ? {
              name: ticketData.responder?.name || "Unassigned",
              email: ticketData.responder?.email || "",
              avatar: ticketData.responder?.avatar,
            }
          : undefined,
        created_at: ticketData.created_at,
        updated_at: ticketData.updated_at,
        tags: ticketData.tags || [],
      }

      return NextResponse.json(transformedTicket)
    } catch (fetchError) {
      if (fetchError instanceof Error && fetchError.message.includes("404")) {
        return NextResponse.json(
          {
            error: "Ticket Not Found",
            details: `Ticket #${ticketId} does not exist or you don't have permission to access it.`,
            ticketId: ticketId,
          },
          { status: 404 },
        )
      }

      return NextResponse.json(
        {
          error: "Failed to Fetch Ticket",
          details: fetchError instanceof Error ? fetchError.message : "Unknown error occurred",
          ticketId: ticketId,
        },
        { status: 500 },
      )
    }
  } catch (error) {
    return NextResponse.json(
      {
        error: "Internal Server Error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

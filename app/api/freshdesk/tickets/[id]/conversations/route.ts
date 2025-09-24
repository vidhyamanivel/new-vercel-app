import { type NextRequest, NextResponse } from "next/server"
import { FreshdeskAPI, freshdeskConfig } from "@/lib/freshdesk-api"

// API route to fetch conversations for a specific ticket
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
      const conversationsData = await freshdesk.getConversations(ticketId)

      // Transform the conversations data to match our expected format
      const transformedConversations = conversationsData.map((conv: any) => ({
        id: conv.id,
        body: conv.body,
        body_text: conv.body_text,
        from_email: conv.from_email,
        to_emails: conv.to_emails || [],
        cc_emails: conv.cc_emails || [],
        bcc_emails: conv.bcc_emails || [],
        created_at: conv.created_at,
        updated_at: conv.updated_at,
        incoming: conv.incoming || false,
        private: conv.private || false,
        user: {
          name: conv.user?.name || conv.from_email?.split("@")[0] || "Unknown",
          email: conv.from_email || conv.user?.email || "",
          avatar: conv.user?.avatar || null,
        },
        attachments: conv.attachments || [],
      }))

      return NextResponse.json(transformedConversations)
    } catch (fetchError) {
      if (fetchError instanceof Error && fetchError.message.includes("404")) {
        return NextResponse.json(
          {
            error: "Conversations Not Found",
            details: `No conversations found for ticket #${ticketId} or you don't have permission to access them.`,
            ticketId: ticketId,
          },
          { status: 404 },
        )
      }

      return NextResponse.json(
        {
          error: "Failed to Fetch Conversations",
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

import { type NextRequest, NextResponse } from "next/server"
import { FreshdeskAPI, freshdeskConfig } from "@/lib/freshdesk-api"

// API route to search tickets by number, URL, or domain
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const query = searchParams.get("q")
    const type = searchParams.get("type") // 'number', 'url', or 'domain'

    if (!query) {
      return NextResponse.json({ error: "Search query is required" }, { status: 400 })
    }

    console.log(`[v0] Searching for: ${query}, type: ${type}`)

    const freshdesk = new FreshdeskAPI(freshdeskConfig)

    if (type === "domain") {
      try {
        // Search tickets by requester email domain
        const searchQuery = `requester_email:*@${query}`
        const results = await freshdesk.searchTickets(searchQuery)

        console.log(`[v0] Found ${results.results?.length || 0} tickets for domain: ${query}`)

        return NextResponse.json({
          results: results.results || [],
          total: results.total || 0,
        })
      } catch (error) {
        console.error(`[v0] Domain search error:`, error)
        return NextResponse.json(
          {
            error: "Failed to search tickets by domain",
            details: error instanceof Error ? error.message : "Unknown error",
          },
          { status: 500 },
        )
      }
    }

    // Existing single ticket search logic
    let ticketId: number | null = null

    if (type === "url") {
      // Extract ticket ID from URL
      const urlMatch = query.match(/\/tickets\/(\d+)/)
      if (urlMatch) {
        ticketId = Number.parseInt(urlMatch[1], 10)
      }
    } else {
      // Assume it's a ticket number
      const numberMatch = query.match(/^\d+$/)
      if (numberMatch) {
        ticketId = Number.parseInt(query, 10)
      }
    }

    if (!ticketId) {
      return NextResponse.json(
        {
          error: "Could not extract ticket ID from input",
          details: "Please provide a valid ticket number or Freshdesk URL",
        },
        { status: 400 },
      )
    }

    // Fetch the ticket
    const [ticket, conversations] = await Promise.all([
      freshdesk.getTicket(ticketId),
      freshdesk.getConversations(ticketId),
    ])

    console.log(`[v0] Found ticket ${ticketId}: ${ticket.subject}`)

    return NextResponse.json({
      ticket,
      conversations,
    })
  } catch (error) {
    console.error(`[v0] Error searching ticket:`, error)

    if (error instanceof Error && error.message.includes("not found")) {
      return NextResponse.json(
        {
          error: "Ticket not found",
          details: error.message,
        },
        { status: 404 },
      )
    }

    return NextResponse.json(
      {
        error: "Failed to search ticket",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

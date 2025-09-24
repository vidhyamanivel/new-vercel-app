import { type NextRequest, NextResponse } from "next/server"
import { FreshdeskAPI, freshdeskConfig } from "@/lib/freshdesk-api"

// API route to proxy Freshdesk attachments
// This solves the issue where Freshdesk attachments aren't directly downloadable
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    console.log("[v0] Attachment download request:", {
      attachmentId: params.id,
      hasApiKey: !!process.env.FRESHDESK_API_KEY,
      hasDomain: !!process.env.FRESHDESK_DOMAIN,
      domain: process.env.FRESHDESK_DOMAIN?.substring(0, 10) + "...",
    })

    const attachmentId = Number.parseInt(params.id)
    const requestedFilename = request.nextUrl.searchParams.get("filename")

    if (!attachmentId) {
      console.log("[v0] Invalid attachment ID:", params.id)
      return NextResponse.json({ error: "Invalid attachment ID" }, { status: 400 })
    }

    if (!process.env.FRESHDESK_DOMAIN || !process.env.FRESHDESK_API_KEY) {
      console.log("[v0] Missing environment variables:", {
        hasDomain: !!process.env.FRESHDESK_DOMAIN,
        hasApiKey: !!process.env.FRESHDESK_API_KEY,
      })
      return NextResponse.json(
        { error: "Freshdesk configuration missing", details: "FRESHDESK_DOMAIN or FRESHDESK_API_KEY not configured" },
        { status: 500 },
      )
    }

    console.log("[v0] Creating Freshdesk API instance...")
    const freshdesk = new FreshdeskAPI(freshdeskConfig)

    console.log("[v0] Fetching attachment from Freshdesk...")
    const { blob, contentType, filename } = await freshdesk.getAttachment(attachmentId)

    console.log("[v0] Attachment fetched successfully:", {
      size: blob.size,
      contentType,
      filename,
    })

    const finalFilename = filename || requestedFilename || `attachment_${attachmentId}`

    // Create response with proper headers for file download
    const response = new NextResponse(blob)
    response.headers.set("Content-Disposition", `attachment; filename="${finalFilename}"`)
    response.headers.set("Content-Type", contentType)
    response.headers.set("Cache-Control", "private, max-age=3600") // Cache for 1 hour
    response.headers.set("Content-Length", blob.size.toString())

    console.log("[v0] Returning attachment response")
    return response
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error"
    console.log("[v0] Attachment download error:", {
      error: errorMessage,
      attachmentId: params.id,
    })
    return NextResponse.json(
      {
        error: "Failed to download attachment",
        details: errorMessage,
        attachmentId: params.id,
      },
      { status: 500 },
    )
  }
}

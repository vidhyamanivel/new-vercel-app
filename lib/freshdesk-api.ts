// Freshdesk API integration utilities
// Note: This handles the attachment download limitation by providing proxy endpoints

interface FreshdeskConfig {
  domain: string
  apiKey: string
}

export class FreshdeskAPI {
  private config: FreshdeskConfig
  private baseUrl: string

  constructor(config: FreshdeskConfig) {
    this.config = config
    const cleanDomain = config.domain.replace(".freshdesk.com", "")
    this.baseUrl = `https://${cleanDomain}.freshdesk.com/api/v2`
  }

  private getAuthHeaders() {
    return {
      Authorization: `Basic ${btoa(this.config.apiKey + ":X")}`,
      "Content-Type": "application/json",
    }
  }

  async getTicket(ticketId: number) {
    const url = `${this.baseUrl}/tickets/${ticketId}`

    try {
      // Add timeout and better error handling
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

      const response = await fetch(url, {
        headers: this.getAuthHeaders(),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()

        if (response.status === 404) {
          throw new Error(`Ticket #${ticketId} not found`)
        }
        if (response.status === 401) {
          throw new Error(`Authentication failed - check your API key and domain`)
        }
        throw new Error(`Failed to fetch ticket: ${response.status} ${response.statusText} - ${errorText}`)
      }

      const data = await response.json()
      return data
    } catch (error) {
      // Re-throw with more context
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          throw new Error("Request timeout - Freshdesk API took too long to respond")
        }
        if (error.message.includes("fetch failed")) {
          throw new Error(
            "Network error - Unable to connect to Freshdesk API. Check your domain and network connectivity.",
          )
        }
      }
      throw error
    }
  }

  async getConversations(ticketId: number, page = 1) {
    const url = `${this.baseUrl}/tickets/${ticketId}/conversations?page=${page}&per_page=100`

    try {
      // Add timeout and better error handling
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

      const response = await fetch(url, {
        headers: this.getAuthHeaders(),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()

        if (response.status === 401) {
          throw new Error(`Authentication failed - check your API key and domain`)
        }
        if (response.status === 404) {
          throw new Error(`Ticket #${ticketId} not found or no conversations available`)
        }
        throw new Error(`Failed to fetch conversations: ${response.status} ${response.statusText} - ${errorText}`)
      }

      const data = await response.json()
      return data
    } catch (error) {
      // Re-throw with more context
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          throw new Error("Request timeout - Freshdesk API took too long to respond")
        }
        if (error.message.includes("fetch failed")) {
          throw new Error(
            "Network error - Unable to connect to Freshdesk API. Check your domain and network connectivity.",
          )
        }
      }
      throw error
    }
  }

  async getAttachment(attachmentId: number): Promise<{ blob: Blob; contentType: string; filename: string }> {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000) // 15 second timeout for files

      const response = await fetch(`${this.baseUrl}/attachments/${attachmentId}`, {
        headers: {
          Authorization: `Basic ${btoa(this.config.apiKey + ":X")}`,
        },
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorText = await response.text()

        if (response.status === 404) {
          throw new Error(`Attachment ${attachmentId} not found`)
        }
        if (response.status === 401) {
          throw new Error(`Authentication failed - check your API key`)
        }
        throw new Error(`Failed to fetch attachment: ${response.status} ${response.statusText} - ${errorText}`)
      }

      const contentType = response.headers.get("content-type") || "application/octet-stream"
      const contentDisposition = response.headers.get("content-disposition") || ""
      const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
      const filename = filenameMatch ? filenameMatch[1].replace(/['"]/g, "") : `attachment_${attachmentId}`

      const blob = await response.blob()

      return {
        blob,
        contentType,
        filename,
      }
    } catch (error) {
      if (error instanceof Error) {
        if (error.name === "AbortError") {
          throw new Error("Attachment download timeout - file took too long to download")
        }
        if (error.message.includes("fetch failed")) {
          throw new Error("Network error - Unable to connect to Freshdesk for attachment download")
        }
        throw new Error(`Failed to fetch attachment: ${error.message}`)
      }
      throw new Error(`Failed to fetch attachment: ${String(error)}`)
    }
  }

  async searchTickets(
    query: string,
    filters?: {
      status?: string[]
      priority?: string[]
      requester_email?: string
      agent_email?: string
      created_since?: string
      updated_since?: string
    },
  ) {
    try {
      const searchParams = new URLSearchParams()
      searchParams.append("query", query)

      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (Array.isArray(value)) {
            value.forEach((v) => searchParams.append(key, v))
          } else if (value) {
            searchParams.append(key, value)
          }
        })
      }

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)

      const response = await fetch(`${this.baseUrl}/search/tickets?${searchParams.toString()}`, {
        headers: this.getAuthHeaders(),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`Failed to search tickets: ${response.statusText}`)
      }

      return response.json()
    } catch (error) {
      throw error
    }
  }

  async getTicketFromUrl(url: string) {
    const ticketIdMatch = url.match(/\/tickets\/(\d+)/)
    if (!ticketIdMatch) {
      throw new Error("Invalid Freshdesk URL - could not extract ticket ID")
    }

    const ticketId = Number.parseInt(ticketIdMatch[1], 10)
    return this.getTicket(ticketId)
  }

  // Server-side method to create attachment proxy endpoint
  async createAttachmentProxy(attachmentId: number, filename: string) {
    // This would typically be implemented as a Next.js API route
    // that authenticates with Freshdesk and streams the file content
    return `/api/freshdesk/attachments/${attachmentId}?filename=${encodeURIComponent(filename)}`
  }
}

export const freshdeskConfig: FreshdeskConfig = {
  domain: process.env.FRESHDESK_DOMAIN || "",
  apiKey: process.env.FRESHDESK_API_KEY || "",
}

"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { TicketSearch } from "./ticket-search"
import {
  MessageSquare,
  Paperclip,
  Clock,
  User,
  Mail,
  Phone,
  AlertCircle,
  CheckCircle,
  XCircle,
  Download,
  ImageIcon,
  FileText,
  ArrowLeft,
  Shield,
  Calendar,
  Tag,
} from "lucide-react"
import { cn } from "@/lib/utils"

// Mock data types
interface FreshdeskTicket {
  id: number
  subject: string
  description: string
  status: "open" | "pending" | "resolved" | "closed"
  priority: "low" | "medium" | "high" | "urgent"
  requester: {
    name: string
    email: string
    phone?: string
    avatar?: string
  }
  agent?: {
    name: string
    email: string
    avatar?: string
  }
  created_at: string
  updated_at: string
  tags: string[]
  custom_fields?: Record<string, any>
  source?: string
  type?: string
  group?: string
  product?: string
}

interface Conversation {
  id: number
  body: string
  body_text: string
  from_email: string
  to_emails: string[]
  cc_emails?: string[]
  bcc_emails?: string[]
  created_at: string
  updated_at: string
  incoming: boolean
  private: boolean
  user: {
    name: string
    email: string
    avatar?: string
  }
  attachments: Attachment[]
}

interface Attachment {
  id: number
  name: string
  content_type: string
  size: number
  created_at: string
  attachment_url: string // Note: This won't be directly accessible
}

// Real Freshdesk API functions
const fetchTicketDetails = async (ticketId: number): Promise<FreshdeskTicket> => {
  console.log("[v0] Fetching ticket details for ID:", ticketId)

  const response = await fetch(`/api/freshdesk/tickets/${ticketId}`)
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: "Unknown error" }))
    console.log("[v0] API Error:", response.status, errorData)

    if (response.status === 404) {
      throw new Error(`Ticket #${ticketId} not found`)
    }

    throw new Error(errorData.details || `Failed to fetch ticket: ${response.statusText}`)
  }

  const data = await response.json()
  console.log("[v0] Received ticket data:", data)
  return data
}

const fetchConversations = async (ticketId: number): Promise<Conversation[]> => {
  console.log("[v0] Fetching conversations for ticket ID:", ticketId)

  const response = await fetch(`/api/freshdesk/tickets/${ticketId}/conversations`)
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: "Unknown error" }))

    if (response.status === 404) {
      return []
    }

    throw new Error(errorData.details || `Failed to fetch conversations: ${response.statusText}`)
  }

  const data = await response.json()
  console.log("[v0] Received conversations data:", data)
  return data
}

// Custom hook for Freshdesk API
const useFreshdeskData = (ticketId: number | null) => {
  const [ticket, setTicket] = useState<FreshdeskTicket | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!ticketId || ticketId === 0) {
      setTicket(null)
      setConversations([])
      setLoading(false)
      setError(null)
      return
    }

    const loadData = async () => {
      try {
        setLoading(true)
        setError(null)
        const ticketData = await fetchTicketDetails(ticketId)
        setTicket(ticketData)

        try {
          const conversationData = await fetchConversations(ticketId)
          setConversations(conversationData)
        } catch (convError) {
          console.log("[v0] Conversations fetch failed, using empty array:", convError)
          setConversations([])
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load ticket data")
        setTicket(null)
        setConversations([])
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [ticketId])

  return { ticket, conversations, loading, error }
}

const StatusBadge = ({ status }: { status: string }) => {
  const statusConfig = {
    open: { color: "bg-primary text-primary-foreground shadow-lg", icon: MessageSquare },
    pending: { color: "bg-amber-500 text-white shadow-lg", icon: Clock },
    resolved: { color: "bg-emerald-500 text-white shadow-lg", icon: CheckCircle },
    closed: { color: "bg-slate-500 text-white shadow-lg", icon: XCircle },
  }

  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.open
  const Icon = config.icon

  return (
    <Badge className={cn("flex items-center gap-1.5 px-4 py-2 font-semibold", config.color)}>
      <Icon className="h-4 w-4" />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  )
}

const PriorityBadge = ({ priority }: { priority: string }) => {
  const priorityConfig = {
    low: "bg-slate-100 text-slate-700 border-slate-300 shadow-sm",
    medium: "bg-blue-100 text-blue-700 border-blue-300 shadow-sm",
    high: "bg-secondary/20 text-secondary border-secondary/30 shadow-sm",
    urgent: "bg-red-100 text-red-700 border-red-300 shadow-sm pulse-glow",
  }

  return (
    <Badge
      variant="outline"
      className={cn("border-2 font-semibold px-3 py-1", priorityConfig[priority as keyof typeof priorityConfig])}
    >
      {priority.charAt(0).toUpperCase() + priority.slice(1)}
    </Badge>
  )
}

const AttachmentCard = ({ attachment }: { attachment: Attachment }) => {
  const [downloading, setDownloading] = useState(false)

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B"
    const k = 1024
    const sizes = ["B", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
  }

  const isImage = attachment.content_type.startsWith("image/")

  const handleDownload = async () => {
    try {
      setDownloading(true)
      console.log("[v0] Starting attachment download for:", attachment.name)

      const proxyUrl = `/api/freshdesk/attachments/${attachment.id}?filename=${encodeURIComponent(attachment.name)}`
      console.log("[v0] Using proxy URL:", proxyUrl)

      // Use direct navigation instead of fetch + blob approach
      const link = document.createElement("a")
      link.href = proxyUrl
      link.download = attachment.name
      link.target = "_blank"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      console.log("[v0] Download initiated successfully")
    } catch (error) {
      console.error("[v0] Download failed:", error)
      alert("Failed to download attachment. Please try again.")
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-all">
      <div className="flex-shrink-0">
        {isImage ? (
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <ImageIcon className="h-5 w-5 text-blue-600" />
          </div>
        ) : (
          <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
            <FileText className="h-5 w-5 text-slate-600" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-slate-900 truncate">{attachment.name}</p>
        <p className="text-sm text-slate-500">{formatFileSize(attachment.size)}</p>
      </div>
      <Button variant="ghost" size="sm" onClick={handleDownload} disabled={downloading} className="flex-shrink-0">
        {downloading ? (
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-slate-400 border-t-transparent"></div>
        ) : (
          <Download className="h-4 w-4" />
        )}
      </Button>
    </div>
  )
}

export function TicketDashboard() {
  const [currentTicketId, setCurrentTicketId] = useState<number | null>(null)
  const [searchResults, setSearchResults] = useState<any[]>([])

  const { ticket, conversations, loading, error } = useFreshdeskData(currentTicketId)

  const handleTicketsFound = (tickets: any[]) => {
    setSearchResults(tickets)
  }

  if (!currentTicketId && searchResults.length === 0) {
    return <TicketSearch onTicketFound={setCurrentTicketId} onTicketsFound={handleTicketsFound} loading={loading} />
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">Loading ticket details...</p>
        </div>
      </div>
    )
  }

  if (error || !ticket) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="glass-effect rounded-2xl p-8 floating-animation">
            <div className="w-20 h-20 bg-destructive/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="h-10 w-10 text-destructive" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-4">Ticket Not Found</h2>
            <p className="text-white/80 mb-6 leading-relaxed">
              {error?.includes("not found")
                ? `The ticket you're looking for doesn't exist or you don't have permission to access it.`
                : error || "An unexpected error occurred while loading the ticket."}
            </p>
            <Button
              onClick={() => {
                setCurrentTicketId(null)
                setSearchResults([])
              }}
              className="bg-white text-primary hover:bg-white/90 font-semibold px-6 py-3 rounded-xl shadow-lg hover:shadow-xl backdrop-blur-sm bg-white/10 hover:bg-white/20 group"
            >
              <ArrowLeft className="mr-2 h-5 w-5 group-hover:translate-x-[-2px] transition-transform duration-200" />
              Search Another Ticket
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const publicConversations = conversations.filter((conv) => !conv.private)
  const privateNotes = conversations.filter((conv) => conv.private)
  const allAttachments = conversations.flatMap((conv) => conv.attachments)

  return (
    <div className="min-h-screen bg-gradient-to-br from-card via-background to-muted">
      <header className="gradient-bg border-b border-white/20 sticky top-0 z-10 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <Button
                variant="ghost"
                size="lg"
                onClick={() => {
                  setCurrentTicketId(null)
                  setSearchResults([])
                }}
                className="text-white hover:bg-white/20 font-semibold px-6 py-3 rounded-xl border-2 border-white/30 hover:border-white/50 transition-all duration-200 shadow-lg hover:shadow-xl backdrop-blur-sm bg-white/10 hover:bg-white/20 group"
              >
                <ArrowLeft className="h-5 w-5 mr-2 group-hover:translate-x-[-2px] transition-transform duration-200" />
                Back to Search
              </Button>
              <div className="flex items-center gap-4">
                <h1 className="text-3xl font-bold text-white">#{ticket.id}</h1>
                <StatusBadge status={ticket.status} />
                <PriorityBadge priority={ticket.priority} />
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {ticket.custom_fields && Object.keys(ticket.custom_fields).length > 0 && (
          <Card className="mb-8 border-0 shadow-xl bg-card/50 backdrop-blur-sm">
            <CardContent className="p-8">
              <h3 className="text-xl font-bold text-foreground mb-6">Ticket Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div>
                  <p className="text-sm font-semibold text-muted-foreground mb-1">Status</p>
                  <p className="text-foreground">{ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1)}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-muted-foreground mb-1">Priority</p>
                  <p className="text-foreground">
                    {ticket.priority.charAt(0).toUpperCase() + ticket.priority.slice(1)}
                  </p>
                </div>
                {ticket.source && (
                  <div>
                    <p className="text-sm font-semibold text-muted-foreground mb-1">Source</p>
                    <p className="text-foreground">{ticket.source}</p>
                  </div>
                )}
                {ticket.type && (
                  <div>
                    <p className="text-sm font-semibold text-muted-foreground mb-1">Type</p>
                    <p className="text-foreground">{ticket.type}</p>
                  </div>
                )}
                {ticket.group && (
                  <div>
                    <p className="text-sm font-semibold text-muted-foreground mb-1">Group</p>
                    <p className="text-foreground">{ticket.group}</p>
                  </div>
                )}
                {ticket.agent && (
                  <div>
                    <p className="text-sm font-semibold text-muted-foreground mb-1">Agent</p>
                    <p className="text-foreground">{ticket.agent.name}</p>
                  </div>
                )}
                {ticket.product && (
                  <div>
                    <p className="text-sm font-semibold text-muted-foreground mb-1">Product</p>
                    <p className="text-foreground">{ticket.product}</p>
                  </div>
                )}

                {ticket.custom_fields &&
                  Object.entries(ticket.custom_fields).map(
                    ([key, value]) =>
                      value && (
                        <div key={key}>
                          <p className="text-sm font-semibold text-muted-foreground mb-1">
                            {key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
                          </p>
                          <p className="text-foreground">{String(value)}</p>
                        </div>
                      ),
                  )}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-3">
            <Card className="mb-8 border-0 shadow-xl bg-card/50 backdrop-blur-sm">
              <CardContent className="p-8">
                <h2 className="text-2xl font-bold text-foreground mb-6 text-balance leading-tight">{ticket.subject}</h2>
                <div className="flex items-center gap-8 text-sm text-muted-foreground">
                  <div className="flex items-center gap-3 bg-muted/50 px-4 py-2 rounded-lg">
                    <User className="h-5 w-5 text-primary" />
                    <span className="font-medium">{ticket.requester.name}</span>
                  </div>
                  <div className="flex items-center gap-3 bg-muted/50 px-4 py-2 rounded-lg">
                    <Mail className="h-5 w-5 text-primary" />
                    <span className="font-medium">{ticket.requester.email}</span>
                  </div>
                  {ticket.requester.phone && (
                    <div className="flex items-center gap-3 bg-muted/50 px-4 py-2 rounded-lg">
                      <Phone className="h-5 w-5 text-primary" />
                      <span className="font-medium">{ticket.requester.phone}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Tabs defaultValue="conversations" className="space-y-6">
              <TabsList className="bg-card/80 backdrop-blur-sm border border-border/50 shadow-lg p-1 rounded-xl">
                <TabsTrigger
                  value="conversations"
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold px-6 py-3 rounded-lg"
                >
                  <MessageSquare className="h-5 w-5 mr-2" />
                  Conversations ({publicConversations.length})
                </TabsTrigger>
                <TabsTrigger
                  value="notes"
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold px-6 py-3 rounded-lg"
                >
                  <Shield className="h-5 w-5 mr-2" />
                  Private Notes ({privateNotes.length})
                </TabsTrigger>
                <TabsTrigger
                  value="attachments"
                  className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-semibold px-6 py-3 rounded-lg"
                >
                  <Paperclip className="h-5 w-5 mr-2" />
                  Files ({allAttachments.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="conversations" className="space-y-4">
                <Card className="border-0 shadow-sm bg-card/50 backdrop-blur-sm">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <Avatar className="h-12 w-12 ring-2 ring-primary/20">
                        <AvatarImage src={ticket.requester.avatar || "/placeholder.svg"} />
                        <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                          {ticket.requester.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <span className="font-semibold text-foreground">{ticket.requester.name}</span>
                          <Badge variant="outline" className="bg-white">
                            Customer
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {new Date(ticket.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="text-foreground leading-relaxed">{ticket.description}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {publicConversations.map((conversation, index) => (
                  <Card key={conversation.id} className="border-0 shadow-sm bg-card/50 backdrop-blur-sm">
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <Avatar className="h-12 w-12 ring-2 ring-primary/20">
                          <AvatarImage src={conversation.user.avatar || "/placeholder.svg"} />
                          <AvatarFallback
                            className={
                              conversation.incoming ? "bg-primary text-primary-foreground" : "bg-green-500 text-white"
                            }
                          >
                            {conversation.user.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <span className="font-semibold text-foreground">{conversation.user.name}</span>
                            <Badge
                              variant={conversation.incoming ? "outline" : "default"}
                              className={
                                conversation.incoming ? "bg-primary/10 text-primary" : "bg-green-100 text-green-700"
                              }
                            >
                              {conversation.incoming ? "Customer" : "Agent"}
                            </Badge>
                            <span className="text-sm text-muted-foreground">
                              {new Date(conversation.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <div
                            className="text-foreground leading-relaxed prose prose-sm max-w-none"
                            dangerouslySetInnerHTML={{ __html: conversation.body }}
                          />
                          {conversation.attachments.length > 0 && (
                            <div className="mt-4 space-y-2">
                              {conversation.attachments.map((attachment) => (
                                <AttachmentCard key={attachment.id} attachment={attachment} />
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              <TabsContent value="notes" className="space-y-4">
                {privateNotes.map((note) => (
                  <Card key={note.id} className="border-0 shadow-sm bg-amber-50 border-l-4 border-l-amber-500">
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <Avatar className="h-12 w-12 ring-2 ring-primary/20">
                          <AvatarImage src={note.user.avatar || "/placeholder.svg"} />
                          <AvatarFallback className="bg-amber-500 text-white">
                            {note.user.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-semibold text-foreground">{note.user.name}</p>
                          <div
                            className="text-foreground leading-relaxed"
                            dangerouslySetInnerHTML={{ __html: note.body }}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </TabsContent>

              <TabsContent value="attachments">
                <Card className="border-0 shadow-sm bg-card/50 backdrop-blur-sm">
                  <CardContent className="p-6">
                    {allAttachments.length > 0 ? (
                      <div className="space-y-3">
                        {allAttachments.map((attachment) => (
                          <AttachmentCard key={attachment.id} attachment={attachment} />
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-12 text-muted-foreground">
                        <Paperclip className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No attachments found</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          <div className="lg:col-span-1">
            <Card className="border-0 shadow-xl bg-card/50 backdrop-blur-sm sticky top-32">
              <CardContent className="p-8 space-y-8">
                <div>
                  <h3 className="font-bold text-foreground mb-6 flex items-center gap-3 text-lg">
                    <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    Requester
                  </h3>
                  <div className="flex items-center gap-4 bg-muted/30 p-4 rounded-xl">
                    <Avatar className="h-12 w-12 ring-2 ring-primary/20">
                      <AvatarImage src={ticket.requester.avatar || "/placeholder.svg"} />
                      <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                        {ticket.requester.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold text-foreground">{ticket.requester.name}</p>
                      <p className="text-sm text-muted-foreground">{ticket.requester.email}</p>
                    </div>
                  </div>
                </div>

                {ticket.agent && (
                  <div>
                    <h3 className="font-bold text-foreground mb-6 flex items-center gap-3 text-lg">
                      <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      Agent
                    </h3>
                    <div className="flex items-center gap-4 bg-muted/30 p-4 rounded-xl">
                      <Avatar className="h-12 w-12 ring-2 ring-primary/20">
                        <AvatarImage src={ticket.agent.avatar || "/placeholder.svg"} />
                        <AvatarFallback className="bg-green-500 text-white font-semibold">
                          {ticket.agent.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-semibold text-foreground">{ticket.agent.name}</p>
                        <p className="text-sm text-muted-foreground">{ticket.agent.email}</p>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="font-bold text-foreground mb-6 flex items-center gap-3 text-lg">
                    <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center">
                      <Calendar className="h-5 w-5 text-primary" />
                    </div>
                    Timeline
                  </h3>
                  <div className="space-y-4">
                    <div className="bg-muted/30 p-4 rounded-xl">
                      <p className="text-muted-foreground text-sm font-medium">Created</p>
                      <p className="font-semibold text-foreground">
                        {new Date(ticket.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="bg-muted/30 p-4 rounded-xl">
                      <p className="text-muted-foreground text-sm font-medium">Updated</p>
                      <p className="font-semibold text-foreground">
                        {new Date(ticket.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-bold text-foreground mb-6 flex items-center gap-3 text-lg">
                    <div className="w-8 h-8 bg-primary/20 rounded-lg flex items-center justify-center">
                      <Tag className="h-5 w-5 text-primary" />
                    </div>
                    Tags
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {ticket.tags.length > 0 ? (
                      ticket.tags.map((tag) => (
                        <Badge
                          key={tag}
                          className="bg-secondary/20 text-secondary border-secondary/30 font-medium px-3 py-1"
                        >
                          {tag}
                        </Badge>
                      ))
                    ) : (
                      <p className="text-muted-foreground text-sm">No tags assigned</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}

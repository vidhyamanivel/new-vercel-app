"use client"

import type React from "react"
import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Search, ExternalLink, Hash, Zap, Mail, User, Calendar } from "lucide-react"

interface TicketSearchProps {
  onTicketFound: (ticketId: number) => void
  onTicketsFound: (tickets: any[]) => void
  loading: boolean
}

interface SearchResult {
  id: number
  subject: string
  status: string
  priority: string
  requester: {
    name: string
    email: string
  }
  created_at: string
  updated_at: string
  custom_fields?: Record<string, any>
}

export function TicketSearch({ onTicketFound, onTicketsFound, loading }: TicketSearchProps) {
  const [searchInput, setSearchInput] = useState("")
  const [searchType, setSearchType] = useState<"number" | "url" | "domain">("number")
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchMode, setSearchMode] = useState<"single" | "domain">("single")

  const extractTicketId = (input: string): number | null => {
    const cleanInput = input.trim()
    if (/^\d+$/.test(cleanInput)) {
      return Number.parseInt(cleanInput, 10)
    }
    const urlMatch = cleanInput.match(/\/tickets\/(\d+)/)
    if (urlMatch) {
      return Number.parseInt(urlMatch[1], 10)
    }
    const paramMatch = cleanInput.match(/[?&]ticket[_-]?id=(\d+)/i)
    if (paramMatch) {
      return Number.parseInt(paramMatch[1], 10)
    }
    return null
  }

  const extractDomain = (email: string): string => {
    const match = email.match(/@(.+)$/)
    return match ? match[1] : ""
  }

  const handleSingleTicketSearch = async () => {
    const ticketId = extractTicketId(searchInput)
    if (ticketId) {
      onTicketFound(ticketId)
    } else {
      alert("Please enter a valid ticket number or Freshdesk URL")
    }
  }

  const handleDomainSearch = async () => {
    const domain = searchInput.trim()
    if (!domain) {
      alert("Please enter a domain name (e.g., example.com)")
      return
    }

    try {
      const response = await fetch(`/api/freshdesk/search?type=domain&q=${encodeURIComponent(domain)}`)
      if (!response.ok) {
        throw new Error("Failed to search tickets by domain")
      }

      const data = await response.json()
      setSearchResults(data.results || [])
      onTicketsFound(data.results || [])
    } catch (error) {
      console.error("Domain search failed:", error)
      alert("Failed to search tickets by domain. Please try again.")
    }
  }

  const handleSearch = () => {
    if (searchMode === "single") {
      handleSingleTicketSearch()
    } else {
      handleDomainSearch()
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch()
    }
  }

  const detectInputType = (value: string) => {
    if (value.includes("freshdesk.com") || value.includes("http")) {
      setSearchType("url")
    } else if (/^\d+$/.test(value.trim())) {
      setSearchType("number")
    } else if (value.includes(".") && !value.includes("/")) {
      setSearchType("domain")
    }
  }

  const getStatusColor = (status: string) => {
    const colors = {
      open: "bg-blue-100 text-blue-700",
      pending: "bg-yellow-100 text-yellow-700",
      resolved: "bg-green-100 text-green-700",
      closed: "bg-gray-100 text-gray-700",
    }
    return colors[status as keyof typeof colors] || "bg-gray-100 text-gray-700"
  }

  const getPriorityColor = (priority: string) => {
    const colors = {
      low: "bg-gray-100 text-gray-700",
      medium: "bg-blue-100 text-blue-700",
      high: "bg-orange-100 text-orange-700",
      urgent: "bg-red-100 text-red-700",
    }
    return colors[priority as keyof typeof colors] || "bg-gray-100 text-gray-700"
  }

  if (searchResults.length > 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Search Results</h1>
              <p className="text-slate-600">
                Found {searchResults.length} tickets for domain: {searchInput}
              </p>
            </div>
            <Button
              onClick={() => {
                setSearchResults([])
                setSearchInput("")
              }}
              variant="outline"
            >
              New Search
            </Button>
          </div>

          <div className="grid gap-4">
            {searchResults.map((ticket) => (
              <Card
                key={ticket.id}
                className="hover:shadow-lg transition-shadow cursor-pointer"
                onClick={() => onTicketFound(ticket.id)}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-semibold text-slate-900">#{ticket.id}</h3>
                        <Badge className={getStatusColor(ticket.status)}>
                          {ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1)}
                        </Badge>
                        <Badge className={getPriorityColor(ticket.priority)}>
                          {ticket.priority.charAt(0).toUpperCase() + ticket.priority.slice(1)}
                        </Badge>
                      </div>
                      <h4 className="text-lg font-medium text-slate-800 mb-3">{ticket.subject}</h4>

                      <div className="flex items-center gap-6 text-sm text-slate-600">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          <span>{ticket.requester.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          <span>{ticket.requester.email}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4" />
                          <span>{new Date(ticket.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg mx-auto shadow-xl border-0 bg-white/80 backdrop-blur-sm">
        <CardContent className="p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-500 rounded-2xl mb-4">
              <Zap className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Freshdesk Search</h1>
            <p className="text-slate-600">Search by ticket number, URL, or domain</p>
          </div>

          <Tabs
            value={searchMode}
            onValueChange={(value) => setSearchMode(value as "single" | "domain")}
            className="mb-6"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="single">Single Ticket</TabsTrigger>
              <TabsTrigger value="domain">By Domain</TabsTrigger>
            </TabsList>

            <TabsContent value="single" className="space-y-4 mt-4">
              <div className="relative">
                <div className="absolute left-4 top-1/2 transform -translate-y-1/2 z-10">
                  {searchType === "url" ? (
                    <ExternalLink className="h-5 w-5 text-slate-400" />
                  ) : (
                    <Hash className="h-5 w-5 text-slate-400" />
                  )}
                </div>
                <Input
                  placeholder="12345 or https://company.freshdesk.com/tickets/12345"
                  value={searchInput}
                  onChange={(e) => {
                    setSearchInput(e.target.value)
                    detectInputType(e.target.value)
                  }}
                  onKeyPress={handleKeyPress}
                  className="pl-12 h-12 text-base border-slate-200 focus:border-blue-500 focus:ring-blue-500"
                  disabled={loading}
                />
              </div>
            </TabsContent>

            <TabsContent value="domain" className="space-y-4 mt-4">
              <div className="relative">
                <div className="absolute left-4 top-1/2 transform -translate-y-1/2 z-10">
                  <Mail className="h-5 w-5 text-slate-400" />
                </div>
                <Input
                  placeholder="example.com"
                  value={searchInput}
                  onChange={(e) => {
                    setSearchInput(e.target.value)
                    setSearchType("domain")
                  }}
                  onKeyPress={handleKeyPress}
                  className="pl-12 h-12 text-base border-slate-200 focus:border-blue-500 focus:ring-blue-500"
                  disabled={loading}
                />
              </div>
              <p className="text-xs text-slate-500">Search for all tickets from users with this email domain</p>
            </TabsContent>
          </Tabs>

          <Button
            onClick={handleSearch}
            className="w-full h-12 bg-blue-500 hover:bg-blue-600 text-white font-medium"
            disabled={loading || !searchInput.trim()}
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-2"></div>
                Searching...
              </>
            ) : (
              <>
                <Search className="mr-2 h-5 w-5" />
                {searchMode === "single" ? "Search Ticket" : "Search Domain"}
              </>
            )}
          </Button>

          <div className="mt-6 text-center">
            <p className="text-xs text-slate-500">
              {searchMode === "single"
                ? "Supports ticket numbers and Freshdesk URLs"
                : "Enter domain name without @ symbol"}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

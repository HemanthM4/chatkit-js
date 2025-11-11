---
title: "Building a ChatKit AI Chatbot in Next.js 15: What OpenAI Didn't Tell You"
slug: "chatkit-nextjs-integration"
published: "2025-10-13"
updated: "2025-10-12"
categories:
  - "Next.js"
tags:
  - "openai"
  - "chatkit"
  - "next.js"
  - "ai chatbot"
  - "agent builder"
  - "react"
  - "typescript"
  - "streaming"
  - "edge functions"
  - "gpt-4"
llm-intent: "reference"
audience-level: "intermediate"
framework-versions:
  - "next.js@15"
  - "react@19 (inferred)"
  - "typescript@5 (inferred)"
  - "node@20+ (inferred)"
status: "stable"
llm-purpose: "Complete guide to integrating OpenAI ChatKit with Next.js 15, covering session management, Agent Builder workflows, SSE streaming, and debugging."
llm-prereqs:
  - "Access to Next.js"
  - "Access to OpenAI ChatKit"
  - "Access to TypeScript"
  - "Access to React"
  - "Access to Agent Builder"
llm-outputs:
  - "Completed outcome: Complete guide to integrating OpenAI ChatKit with Next.js 15, covering session management, Agent Builder workflows, SSE streaming, and debugging."
---

**Summary Triples**
- (ChatKit, provides, pre-built UI components, response streaming, file attachments, and thread management)
- (Agent Builder, defines, AI behavior via configurable workflows that ChatKit calls for message handling and responses)
- (Backend, responsibility, authenticate users and create ChatKit sessions/tokens; not to manage message routing or streaming)
- (ChatKit client, connects, to Agent Builder workflows using server-issued session tokens and conversation identifiers)
- (Next.js 15 Edge Runtime, requires, special handling for streaming responses and cannot use Node-only modules in edge handlers)
- (Middleware, can, interfere with SSE/streaming endpoints and should be bypassed or configured to exclude chat routes)
- (SSE/streaming, needs, correct response headers (text/event-stream or streamed Response), no buffering, and a streaming-capable runtime)
- (Session tokens, should be, generated server-side, short-lived, and stored/transmitted securely (HttpOnly cookie or backend session API))
- (Debugging focus, includes, middleware conflicts, CORS headers, cookie vs Authorization header usage, and edge cold starts)

### {GOAL}
Complete guide to integrating OpenAI ChatKit with Next.js 15, covering session management, Agent Builder workflows, SSE streaming, and debugging.

### {PREREQS}
- Access to Next.js
- Access to OpenAI ChatKit
- Access to TypeScript
- Access to React
- Access to Agent Builder

### {STEPS}
1. Configure environment variables
2. Install ChatKit React package
3. Build session management API route
4. Create ChatKit widget component
5. Wire widget into app layout
6. Configure Agent Builder workflow
7. Add branching logic with classifier
8. Fix middleware SSE conflicts

<!-- llm:goal="Complete guide to integrating OpenAI ChatKit with Next.js 15, covering session management, Agent Builder workflows, SSE streaming, and debugging." -->
<!-- llm:prereq="Access to Next.js" -->
<!-- llm:prereq="Access to OpenAI ChatKit" -->
<!-- llm:prereq="Access to TypeScript" -->
<!-- llm:prereq="Access to React" -->
<!-- llm:prereq="Access to Agent Builder" -->
<!-- llm:output="Completed outcome: Complete guide to integrating OpenAI ChatKit with Next.js 15, covering session management, Agent Builder workflows, SSE streaming, and debugging." -->

# Building a ChatKit AI Chatbot in Next.js 15: What OpenAI Didn't Tell You
> Complete guide to integrating OpenAI ChatKit with Next.js 15, covering session management, Agent Builder workflows, SSE streaming, and debugging.
Matija Žiberna · 2025-10-13

If you caught OpenAI's recent Dev Day announcements, you probably heard about ChatKit - their new framework for building AI chat experiences. As someone who's built chatbots from scratch before, I was curious to see what the fuss was about. Could it really be as easy as they claimed?

Spoiler: Yes, but with some critical gotchas the docs don't mention.

I spent the afternoon integrating ChatKit into a Next.js 15 application, and while the core promise is true - your backend and frontend are mostly abstracted away - there were some implementation details that took hours to figure out. The official documentation shows you the happy path, but doesn't prepare you for the actual problems you'll hit.

This guide walks through the complete implementation, including the issues I encountered and how to solve them. By the end, you'll have a fully functional AI chatbot widget floating on your site, powered by OpenAI's Agent Builder.

## What ChatKit Actually Gives You

Before diving into code, let's understand what ChatKit provides. At its core, ChatKit is OpenAI's batteries-included framework for chat interfaces. You get pre-built UI components, response streaming, file attachments, thread management, and integration with their Agent Builder platform.

The key insight is this: instead of building your own chat UI and managing conversation state, you configure ChatKit to talk to an Agent Builder workflow. OpenAI handles all the heavy lifting - you just provide the plumbing.

Here's what that means practically. You create an Agent Builder workflow that defines your AI's behavior. ChatKit provides the chat interface. Your backend's only job is to authenticate users and create chat sessions. Everything else - message routing, response streaming, conversation history - OpenAI manages for you.

## Setting Up the Foundation

Let's start with the environment configuration. ChatKit needs a few key pieces of information to connect your frontend to OpenAI's infrastructure.

Create or update your `.env` file with these variables:

```bash
# Your existing OpenAI API key
OPENAI_API_KEY=sk-proj-...

# ChatKit-specific configuration
CHATKIT_WORKFLOW_ID=wf_your_workflow_id_here
NEXT_PUBLIC_CHATKIT_API_URL=/api/chatkit
NEXT_PUBLIC_CHATKIT_DOMAIN_KEY=domain_pk_your_domain_key_here
```

The workflow ID comes from Agent Builder, which we'll set up shortly. The domain key is for production - you'll register your domain in the OpenAI platform to get this. For local development, ChatKit will work without it.

Next, install the ChatKit React package:

```bash
pnpm install @openai/chatkit-react
```

This gives you the React hooks and components for rendering the chat interface. Now let's create a centralized configuration file to keep things organized.

```typescript
// File: src/lib/chatkit-config.ts
import type { StartScreenPrompt } from "@openai/chatkit-react"

export const CHATKIT_API_URL = process.env.NEXT_PUBLIC_CHATKIT_API_URL ?? "/api/chatkit"
export const CHATKIT_DOMAIN_KEY = process.env.NEXT_PUBLIC_CHATKIT_DOMAIN_KEY ?? "domain_pk_localhost_dev"

export const GREETING = "Hi! I'm your AI assistant. How can I help you today?"

export const STARTER_PROMPTS: StartScreenPrompt[] = [
  {
    label: "What can you help me with?",
    prompt: "What can you help me with?",
    icon: "circle-question",
  },
  {
    label: "Tell me about your features",
    prompt: "Tell me about your features",
    icon: "sparkle",
  },
]

export const PLACEHOLDER_INPUT = "Ask me anything..."
```

This configuration defines how your chat interface will look and behave. The starter prompts are those helpful suggestions users see before sending their first message. The greeting appears when the chat opens. Keep these focused on your specific use case.

## Building the Backend: Session Management

Here's where things get interesting. ChatKit needs a backend endpoint to create authenticated sessions. The official docs show a FastAPI example, but since we're in Next.js land, we'll use an API route.

This is also where I hit the first major gotcha, which we'll discuss after seeing the code.

```typescript
// File: src/app/api/chatkit/route.ts
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

const SESSION_COOKIE_NAME = 'chatkit_session_id'
const SESSION_COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

export async function POST(request: NextRequest): Promise<Response> {
  let sessionCookie: string | null = null

  try {
    const openaiApiKey = process.env.OPENAI_API_KEY
    if (!openaiApiKey) {
      return NextResponse.json({ error: 'Missing OPENAI_API_KEY' }, { status: 500 })
    }

    // Get or create user session
    const { userId, sessionCookie: resolvedSessionCookie } = await resolveUserId(request)
    sessionCookie = resolvedSessionCookie

    const workflowId = process.env.CHATKIT_WORKFLOW_ID

    if (!workflowId) {
      return buildJsonResponse(
        { error: 'Missing workflow id' },
        400,
        { 'Content-Type': 'application/json' },
        sessionCookie
      )
    }

    // Create session with OpenAI ChatKit API
    const upstreamResponse = await fetch('https://api.openai.com/v1/chatkit/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
        'OpenAI-Beta': 'chatkit_beta=v1',
      },
      body: JSON.stringify({
        workflow: { id: workflowId },
        user: userId,
        chatkit_configuration: {
          file_upload: { enabled: false },
        },
      }),
    })

    const upstreamJson = await upstreamResponse.json().catch(() => ({}))

    if (!upstreamResponse.ok) {
      console.error('ChatKit session creation failed', {
        status: upstreamResponse.status,
        body: upstreamJson,
      })
      return buildJsonResponse(
        { error: 'Failed to create session' },
        upstreamResponse.status,
        { 'Content-Type': 'application/json' },
        sessionCookie
      )
    }

    return buildJsonResponse(
      {
        client_secret: upstreamJson?.client_secret ?? null,
        expires_after: upstreamJson?.expires_after ?? null,
      },
      200,
      { 'Content-Type': 'application/json' },
      sessionCookie
    )
  } catch (error) {
    console.error('Create session error', error)
    return buildJsonResponse(
      { error: 'Unexpected error' },
      500,
      { 'Content-Type': 'application/json' },
      sessionCookie
    )
  }
}

async function resolveUserId(request: NextRequest): Promise<{
  userId: string
  sessionCookie: string | null
}> {
  const existing = getCookieValue(request.headers.get('cookie'), SESSION_COOKIE_NAME)

  if (existing) {
    return { userId: existing, sessionCookie: null }
  }

  const generated = crypto.randomUUID()

  return {
    userId: generated,
    sessionCookie: serializeSessionCookie(generated),
  }
}

function getCookieValue(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null

  const cookies = cookieHeader.split(';')
  for (const cookie of cookies) {
    const [rawName, ...rest] = cookie.split('=')
    if (rawName?.trim() === name) {
      return rest.join('=').trim()
    }
  }
  return null
}

function serializeSessionCookie(value: string): string {
  const attributes = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(value)}`,
    'Path=/',
    `Max-Age=${SESSION_COOKIE_MAX_AGE}`,
    'HttpOnly',
    'SameSite=Lax',
  ]

  if (process.env.NODE_ENV === 'production') {
    attributes.push('Secure')
  }

  return attributes.join('; ')
}

function buildJsonResponse(
  payload: unknown,
  status: number,
  headers: Record<string, string>,
  sessionCookie: string | null
): Response {
  const responseHeaders = new Headers(headers)

  if (sessionCookie) {
    responseHeaders.append('Set-Cookie', sessionCookie)
  }

  return new Response(JSON.stringify(payload), { status, headers: responseHeaders })
}
```

This endpoint does several things worth understanding. First, it uses the edge runtime for better performance - session creation happens frequently, so lower latency matters. Second, it manages user sessions via cookies. Each user gets a UUID that persists for 30 days, allowing conversation history to work across visits.

The core functionality is straightforward: receive a request, call OpenAI's ChatKit API to create a session, return the client secret. That client secret is what authenticates the frontend chat widget with OpenAI's servers.

Notice the `OpenAI-Beta: chatkit_beta=v1` header. ChatKit is in beta, and this header is required. Without it, your requests will fail with cryptic authentication errors.

## Creating the Chat Widget

Now for the frontend. We'll build a floating chat button that expands into a full chat interface. This is where the second major gotcha lives, which completely stumped me for a couple of hours.

```typescript
// File: src/components/ChatKitWidget.tsx
'use client'

import { useState, useCallback } from 'react'
import { ChatKit, useChatKit } from '@openai/chatkit-react'
import { CHATKIT_API_URL, GREETING, STARTER_PROMPTS, PLACEHOLDER_INPUT } from '@/lib/chatkit-config'

export function ChatKitWidget() {
  const [isOpen, setIsOpen] = useState(false)

  const handleResponseEnd = useCallback(() => {
    console.log('AI response completed')
  }, [])

  const handleError = useCallback(({ error }: { error: Error }) => {
    console.error('ChatKit error:', error)
  }, [])

  const getClientSecret = useCallback(async (existingSecret: string | null) => {
    const response = await fetch(CHATKIT_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })

    if (!response.ok) {
      throw new Error('Failed to create ChatKit session')
    }

    const { client_secret } = await response.json()
    return client_secret
  }, [])

  const chatkit = useChatKit({
    api: { getClientSecret },
    theme: {
      colorScheme: 'light',
      color: {
        grayscale: { hue: 220, tint: 6, shade: -4 },
        accent: { primary: '#0f172a', level: 1 },
      },
      radius: 'round',
    },
    startScreen: { greeting: GREETING, prompts: STARTER_PROMPTS },
    composer: { placeholder: PLACEHOLDER_INPUT },
    threadItemActions: { feedback: false },
    onResponseEnd: handleResponseEnd,
    onError: handleError,
  })

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-blue-600 text-white shadow-xl hover:bg-blue-700 hover:scale-110 transition-all duration-200 flex items-center justify-center"
        aria-label={isOpen ? 'Close chat' : 'Open chat'}
      >
        {isOpen ? (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        )}
      </button>

      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 shadow-2xl rounded-lg overflow-hidden border border-slate-200">
          <ChatKit control={chatkit.control} className="h-[600px] w-[400px] max-w-[calc(100vw-3rem)]" />
        </div>
      )}
    </>
  )
}
```

The component structure is simple: a floating button that toggles a chat panel. The magic happens in the `useChatKit` hook configuration. This hook connects your UI to OpenAI's backend.

Pay close attention to the `api` configuration. We're using `getClientSecret` here, which is the correct approach. Here's why this matters and where I went wrong initially.

## The Configuration Gotcha That Cost Me Hours

ChatKit's documentation shows two ways to configure the API connection. One uses `url` and `domainKey`. The other uses `getClientSecret`. They seem interchangeable in the docs, but they're fundamentally different.

When you use `url` and `domainKey`, ChatKit expects that endpoint to handle every single operation - sessions, threads, messages, everything. Your backend becomes a full proxy for ChatKit's API. This is the "advanced integration" path for when you need complete control.

When you use `getClientSecret`, your endpoint only handles authentication. ChatKit talks directly to OpenAI for everything else. This is the "recommended integration" and what most developers actually want.

I initially used the `url` approach because the example showed it first. Everything seemed to work - the chat opened, I could type messages. But nothing came back. The server logs showed successful session creation followed by thread creation requests. Those thread requests were hitting my endpoint, which only knew how to create sessions. ChatKit was trying to create conversation threads through my API, but I hadn't implemented that functionality.

The fix was switching to `getClientSecret`. Suddenly everything worked. My endpoint handles authentication, OpenAI handles the rest. This is the simpler, better approach unless you have specific reasons to proxy everything.

## Wiring It Into Your App

With the widget built, we need to add it to your application layout. We also need to load ChatKit's core JavaScript, which provides the underlying web components.

```typescript
// File: src/app/layout.tsx
import Script from 'next/script'
import { ChatKitWidget } from '@/components/ChatKitWidget'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}

        <ChatKitWidget />

        <Script
          src="https://cdn.platform.openai.com/deployments/chatkit/chatkit.js"
          strategy="afterInteractive"
        />
      </body>
    </html>
  )
}
```

The Script component loads ChatKit's JavaScript after your page becomes interactive. This keeps your initial page load fast. The widget renders on every page since it's in the root layout, giving you that persistent chat experience users expect.

## Configuring Agent Builder

At this point, your frontend and backend are ready. But your chatbot has no brain yet. That's where Agent Builder comes in.

Head to the OpenAI platform and create a new Agent Builder workflow. You'll need three nodes: Start, Agent, and End.

The Start node accepts input from ChatKit. Configure the Agent node with your desired model - I recommend GPT-4 or GPT-4 Turbo for quality responses. Add instructions that define your AI's personality and capabilities. Something like:

```
You are a helpful AI assistant. Answer questions clearly and concisely.
Be friendly and professional.
```

Here's the third gotcha: the End node configuration. This one is subtle and easy to miss.

The End node defines what gets sent back to ChatKit. It needs to return an object with a `message` field. The trick is referencing the agent's output correctly. If your agent node is named "My Agent" and outputs a variable called `output_text`, your End node schema should look like this:

```json
{
  "type": "object",
  "properties": {
    "message": {
      "type": "string",
      "default": "__VAR__my_agent.output_text__ENDVAR__"
    }
  },
  "required": ["message"]
}
```

Note the variable reference syntax: `__VAR__node_name.variable_name__ENDVAR__`. If you reference `input.output_text` instead - which seems logical since it's the input to the End node - you'll get empty responses. The End node needs to reference the agent's output, not its own input.

### Building a Workflow with Branching Logic

Once the basic workflow works, adding a bit of routing logic makes ChatKit feel tailor-made. Here's the exact setup that finally behaved in production:

1. **Start** - no changes needed; it simply forwards the incoming `message` field.
2. **project_inquiry_classification (Classifier Node)** - switch the node's output type to *Structured*. Use a schema such as:

   ```json
   {
     "type": "object",
     "properties": {
       "inquiry_type": {
         "type": "string",
         "enum": [
           "general_inquiry",
           "website_build",
           "web_app_or_platform",
           "single_purpose_tool",
           "automation_or_integration",
           "maintenance_or_consulting"
         ]
       },
       "confidence": { "type": "number" },
       "reason": { "type": "string" }
     },
     "required": ["inquiry_type", "confidence", "reason"],
     "additionalProperties": false
   }
   ```

   The important part is letting Agent Builder populate `output_parsed`. Every conditional edge must reference `project_inquiry_classification.output_parsed.inquiry_type`; pointing at `output_text` or the raw JSON string will never evaluate truthy.

3. **website_inquiry_agent (Specialised Agent Node)** - keep the system prompt focused on the website flow and add a user prompt such as `{{ input.message }}`. If you enable *Include chat history*, make sure you're comfortable with the classifier's JSON showing up in the history; with GPT-5 nano we hit a platform bug that prevented responses, so we left history off until OpenAI fixes it.
4. **End** - when the agent outputs Structured data, reference it via `__VAR__website_inquiry_agent.output_parsed.message__ENDVAR__`. If you fall back to Text output, switch the template to `output_text` instead. Publishing without the correct reference is what yields the infamous `"{"` response.

After every tweak publish the workflow; each publish issues a new version, so confirm the ID in `CHATKIT_WORKFLOW_ID` matches the latest one. Forgetting this step leaves ChatKit talking to an outdated graph.

After configuring your workflow, publish it. Agent Builder will give you a workflow ID. Add that to your environment variables as `CHATKIT_WORKFLOW_ID`. Restart your dev server, and you're done.

## Testing Your Implementation

Fire up your development server and load your site. You should see a blue floating button in the bottom right corner. Click it, and the chat panel expands. The start screen shows your greeting and starter prompts.

Send a message. You'll see it appear in the chat thread immediately. Then watch as the AI's response streams in word by word. That streaming is handled automatically by ChatKit - no additional code required.

If something doesn't work, check these common issues. If the widget doesn't appear, verify the ChatKit script loaded in your browser's network tab. If messages send but you get no responses, check that your Agent Builder workflow is published and the End node mapping is correct. If session creation fails, confirm your API key has ChatKit beta access.

The browser console and your server logs are your friends here. ChatKit provides detailed error messages when things go wrong.

## What You've Built

You now have a production-ready AI chatbot integrated into your Next.js application. The frontend handles UI and user interaction. Your backend manages authentication and session creation. OpenAI's infrastructure handles everything else - message routing, response generation, conversation state, streaming.

The beauty of this architecture is its simplicity. You're not maintaining conversation state in your database. You're not building streaming infrastructure. You're not managing WebSocket connections. OpenAI does all of that. You focus on your application's unique logic.

From here, you can customize the chat's appearance with ChatKit's theming options. You can add file upload capabilities. You can create custom widgets that render rich content inside the chat. You can integrate tools and functions that give your AI access to external data.

But the foundation is solid. You have a working, scalable chatbot that took an afternoon to build instead of weeks.

## Hard-Won Debugging Notes

These pitfalls didn't show up in the docs, but they surfaced the moment the integration hit a real Next.js app:

- **Localisation middleware breaks SSE streaming.** Next-intl rewrote `/__server_sent_events__` to `/en/__server_sent_events__`, so the built-in Next.js SSE endpoint returned 404s and ChatKit never received tokens. Exclude that path in `src/middleware.ts` before you start chasing ghosts.
- **Streaming requires a verified organization.** Until you verify the org inside the OpenAI dashboard, ChatKit returns `Your organization must be verified to stream this model`. Verification takes a few minutes to propagate.
- **Structured outputs need `output_parsed`.** Agent Builder happily returns JSON as plain text if you don't map the schema to `__VAR__node.output_text__ENDVAR__`. Whenever you hit `{"` in the response payload, double-check the End node template.
- **Chat history toggle is flaky on GPT-5 nano.** Enabling *Include chat history* caused the agent node to stop responding even with a valid user prompt. For now we keep it off and rely on the input message instead.

If you found this helpful or have questions about the implementation, drop a comment below. And subscribe for more practical development guides where I tackle real integration challenges.

Thanks, Matija

## LLM Response Snippet
```json
{
  "goal": "Complete guide to integrating OpenAI ChatKit with Next.js 15, covering session management, Agent Builder workflows, SSE streaming, and debugging.",
  "responses": [
    {
      "question": "What does the article \"Building a ChatKit AI Chatbot in Next.js 15: What OpenAI Didn't Tell You\" cover?",
      "answer": "Complete guide to integrating OpenAI ChatKit with Next.js 15, covering session management, Agent Builder workflows, SSE streaming, and debugging."
    }
  ]
}
```
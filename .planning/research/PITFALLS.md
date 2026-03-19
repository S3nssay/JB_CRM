# Pitfalls Research

**Domain:** AI Voice Agents & Property Management Intelligence for UK Estate Agency CRM
**Researched:** 2026-03-19
**Confidence:** HIGH (multi-source verification across voice AI providers, UK property sector, and multi-agent systems)

## Critical Pitfalls

### Pitfall 1: Voice AI Tool-Calling Latency Kills Conversations

**What goes wrong:**
The AI agent needs to query the CRM mid-conversation (check property availability, look up a tenancy, find contractor details). Each tool call adds 500ms-2s of dead air. Stack two or three lookups and the caller experiences 3-6 seconds of silence. Callers interpret silence as the line dropping or the bot being broken, and hang up. Retell AI averages ~800ms latency per turn even without tool calls; adding CRM queries on top pushes response times past the 2-second threshold where conversations feel unnatural.

**Why it happens:**
Developers test with instant local responses but production CRM queries hit PostgreSQL via Supabase with network latency, plus the LLM reasoning step, plus text-to-speech. The compounding is invisible in testing where queries return in <50ms on localhost.

**How to avoid:**
- Pre-load likely context before the call connects. When a known number calls, fetch their tenant/landlord record, active tenancies, and property details into a call-scoped context cache before the voice agent picks up.
- Design the knowledge base for sub-100ms retrieval. Use indexed structured data (not RAG over documents) for the critical path: property details, tenancy status, rent arrears status, contractor contacts.
- Implement "filler speech" patterns: the agent says "Let me check that for you" while the tool call executes, buying 1-2 seconds naturally.
- Limit tool calls to 1 per conversational turn where possible. Batch lookups into a single "get call context" function.

**Warning signs:**
- Average tool-call response time exceeding 800ms in staging
- Call abandonment rate above 15% (industry norm is 5-8%)
- Transcript analysis showing callers saying "hello?" or "are you there?" mid-conversation

**Phase to address:**
Knowledge Base phase (data design) and Voice Agent Integration phase (caching architecture). The knowledge base schema must be designed for fast retrieval from day one -- retrofitting indexing later means schema changes under live traffic.

---

### Pitfall 2: Multi-Agent Routing Creates "Black Hole" Conversations

**What goes wrong:**
The supervisor agent misclassifies caller intent and routes to the wrong specialist. The Sales agent gets a maintenance call. The caller repeats themselves. The agent either tries to handle it anyway (giving wrong information) or attempts a re-route that drops context. 42% of multi-agent system failures are specification failures (the agent does the wrong thing), and 37% are coordination breakdowns (agents fail to hand off correctly). These failures often generate no error signals -- the system appears to work but gives wrong answers.

**Why it happens:**
Intent classification in estate agency is genuinely ambiguous. "I'm calling about the property on Elgin Avenue" could be a sales enquiry, a rental enquiry, a maintenance report, or a landlord checking on their managed property. Without identifying the caller first (are they a tenant? a landlord? a prospective buyer?), routing is a coin flip.

**How to avoid:**
- Identify the caller before routing. Check the inbound number against the tenant, landlord, and contact databases. A known tenant calling about a managed property is almost certainly PM-related, not sales.
- Use a two-step routing pattern: the receptionist agent gathers enough context (who are you, what's this about) before routing, rather than trying to classify intent from the first utterance.
- Build fallback routing: if confidence is below 70%, keep the conversation with the receptionist rather than routing to a specialist who might be wrong.
- Log every routing decision with the confidence score. Review misroutes weekly during the first month.

**Warning signs:**
- Caller says "that's not what I'm calling about" in transcripts
- Same caller hitting multiple specialists in one call
- Specialist agents receiving task types outside their domain

**Phase to address:**
AI Receptionist phase. The routing logic must be battle-tested before specialist agents go live. Deploy the receptionist alone first, logging routing decisions without acting on them, to build a dataset of real intent patterns before connecting specialists.

---

### Pitfall 3: AI-Generated Tenancy Agreements Contain Unenforceable or Illegal Clauses

**What goes wrong:**
The AI Admin Specialist generates an Assured Shorthold Tenancy (AST) agreement that includes prohibited fees (violating the Tenant Fees Act 2019), unfair terms (violating the Consumer Rights Act 2015), outdated notice periods (not reflecting the Renters' Rights Act 2025), or clauses that would be unenforceable at tribunal. The Guild of Letting & Management explicitly warns that AI-generated tenancy agreements present "significant legal, financial, and reputational risks" because AI cannot reliably track legislative changes or tailor agreements to specific circumstances.

**Why it happens:**
LLMs are trained on historical legal text that may include pre-2019 fee structures, pre-2025 notice periods, or clauses that have been struck down by case law. The model does not "know" when legislation changed -- it pattern-matches from training data. A tenancy agreement that looks professionally formatted but contains one unenforceable clause can invalidate critical landlord rights (e.g., right to possession).

**How to avoid:**
- NEVER have the LLM draft contracts from scratch. Use parameterised templates that have been reviewed by a property solicitor. The AI fills in variables (names, dates, rent amounts, property address) but the legal language is fixed.
- Maintain a template library versioned against legislation dates. When the Renters' Rights Act changes notice periods, update the template -- do not rely on the LLM to know.
- Add a mandatory human review step before any generated contract is sent to DocuSign. The CRM should flag AI-generated documents with a "requires legal review" status.
- Include a compliance checklist that the system validates programmatically: deposit protection mentioned, correct notice periods, no prohibited fees, prescribed information included.

**Warning signs:**
- Generated agreements containing financial penalties not permitted under the Tenant Fees Act
- Notice periods that do not match current legislation
- Missing prescribed information requirements (deposit protection, landlord address, EPC)
- Template last-reviewed date more than 6 months old

**Phase to address:**
AI Admin Specialist phase. Templates must be created and legally reviewed before the AI agent can use them. This is a hard dependency -- the agent cannot generate contracts until templates exist.

---

### Pitfall 4: Arrears Chasing AI Triggers Harassment Claims or Breaches Vulnerability Protocols

**What goes wrong:**
The AI PM Specialist chases rent arrears aggressively -- calling tenants repeatedly, sending multiple messages per day, or continuing to chase a tenant who has communicated financial hardship or vulnerability. This breaches the Pre-Action Protocol for Possession Claims (requiring landlords to explore alternatives before legal action), potentially constitutes harassment under the Protection from Harassment Act 1997, and violates FCA guidance on treating vulnerable customers fairly (applicable when collecting debts).

**Why it happens:**
An AI agent optimising for "secure payment commitment" will naturally escalate frequency and urgency of contact. It has no concept of vulnerability, mental health, or when persistence becomes harassment. The line between "diligent follow-up" and "harassment" is contextual and requires human judgement that LLMs lack.

**How to avoid:**
- Hard-code contact frequency limits: maximum 1 call attempt and 1 message per 48-hour period for arrears. No contact on Sundays. No contact after 8pm.
- Implement a vulnerability flag system. If a tenant mentions financial hardship, job loss, mental health, or any vulnerability indicator, the AI must immediately escalate to a human and stop automated chasing.
- Log every arrears contact in an auditable timeline. If a case goes to tribunal, John Barclay needs to demonstrate proportionate, reasonable contact.
- Implement a maximum escalation chain: after 3 unsuccessful automated contacts, escalate to human case management. Do not let the AI continue indefinitely.
- Include a "payment arrangement" pathway where the AI can agree to a repayment plan within pre-set parameters (e.g., up to 4 weeks catch-up), logged and confirmed in writing.

**Warning signs:**
- Same tenant contacted more than 3 times in a week
- Tenant responses indicating distress or vulnerability not triggering escalation
- No human review of arrears cases after 14 days of AI management
- Absence of audit trail for arrears communications

**Phase to address:**
AI Property Management Specialist phase. Arrears handling rules must be coded as hard constraints (not prompt instructions) before the PM agent goes live. This is a compliance requirement, not a feature preference.

---

### Pitfall 5: Knowledge Base Becomes Stale and Agent Gives Confidently Wrong Answers

**What goes wrong:**
The property knowledge base says the gas safety certificate is valid (it expired last month). The boiler is listed as a Vaillant EcoTEC (it was replaced with a Worcester Bosch 6 months ago). The agent tells a tenant their heating system is X when it is Y, or tells a contractor the wrong boiler model, wasting a call-out. Unlike hallucination (where the AI invents information), this is the AI correctly retrieving and confidently stating information that was accurate when entered but is now wrong. Stale data is harder to detect than missing data.

**Why it happens:**
Property knowledge bases require continuous updates from multiple sources: contractor visit reports, certification renewals, appliance replacements, compliance inspections. If updates depend on someone manually entering data after each event, they will fall behind. Estate agency staff are busy -- data entry is the first thing that slips.

**How to avoid:**
- Build update triggers into existing workflows. When a contractor invoice is logged, prompt for knowledge base updates (what was done, what was replaced, new certification expiry).
- Implement expiry-driven staleness alerts. Every knowledge base entry with a date (gas cert, EPC, electrical cert, insurance) should have an automated alert 30 days before expiry and a "potentially stale" flag after expiry.
- Design the knowledge base to show "last verified" dates alongside every fact. The AI agent should qualify stale data: "According to our records from [date], the heating system is [X], but I'd recommend we verify that."
- Automated ingestion where possible: if DocuSign returns a signed gas safety certificate, extract the expiry date programmatically rather than relying on manual entry.

**Warning signs:**
- Knowledge base entries with "last updated" dates older than 6 months
- Contractor call-outs where the reported issue doesn't match the knowledge base
- Compliance certificates showing as valid when they have expired
- No automated staleness detection or alerting

**Phase to address:**
Property Knowledge Base phase. Staleness detection must be built into the schema from day one -- adding "last_verified" and "expires_at" columns retroactively is painful. Certification expiry alerts are a compliance requirement.

---

### Pitfall 6: Conversation Context Lost Across Channels

**What goes wrong:**
A tenant calls about a leak and speaks to the voice AI. They then WhatsApp a photo of the damage. They get an email confirmation. Each channel interaction is treated as a separate conversation. The WhatsApp agent asks "what property is this regarding?" when the tenant just told the voice agent 10 minutes ago. The tenant feels unheard and frustrated. At worst, two parallel maintenance tickets are created for the same issue.

**Why it happens:**
Each channel (voice, WhatsApp, SMS, email) naturally has its own session management. Voice calls have call SIDs. WhatsApp has conversation threads. Email has message IDs. Without a unified conversation model that links these by contact identity, each channel operates in isolation. Building unified threading is architecturally expensive and is often deferred to "later."

**How to avoid:**
- Design a unified conversation model from the start: a `conversations` table with a `contact_id` linking all channel interactions. Every voice call, WhatsApp message, SMS, and email thread links to a conversation.
- Identify contacts by phone number (shared across voice, WhatsApp, SMS) and email. Build a contact resolution layer that runs before any agent interaction.
- Store conversation summaries (not just transcripts) that are channel-agnostic. When a tenant switches from voice to WhatsApp, the agent loads the conversation summary, not the raw voice transcript.
- Accept that "multi-channel from day one" increases Phase 1 complexity by 3-4x. The alternative -- building channels in isolation and unifying later -- is a rewrite, not a refactor.

**Warning signs:**
- Duplicate tickets/enquiries for the same issue from the same contact
- Agents asking for information the contact already provided on another channel
- No shared conversation ID across channel interactions
- Contact lookup failing to match phone numbers to existing records

**Phase to address:**
Multi-Channel Infrastructure phase. This must be built BEFORE specialist agents, because every specialist depends on unified context. If channels are built in isolation first, the unification effort later will be a major rewrite.

---

### Pitfall 7: Cascading Agent Failures with No Circuit Breaker

**What goes wrong:**
The OpenAI API hits rate limits during a busy period. Ten concurrent voice calls are all waiting for LLM responses. Each retry adds load. The retry storm overwhelms the API quota further. All voice calls experience 10+ second delays or fail entirely. Meanwhile, the PM agent is trying to dispatch a contractor and its tool call times out. The maintenance ticket is created but the contractor notification never sends. 40% of multi-agent pilots fail within six months, often due to cascading failures that compound rather than resolve.

**Why it happens:**
Multi-agent systems create multiplicative load on shared resources (OpenAI API, database, Twilio). A single-agent system making 10 API calls per hour becomes a multi-agent system making 100+ calls per hour. Rate limits, cost controls, and failure handling that worked for one agent break when six agents share the same resources.

**How to avoid:**
- Implement per-agent rate limiting and a shared token budget. Each agent type gets an allocation of OpenAI tokens per minute. When the budget is exhausted, the agent falls back to scripted responses rather than queuing retries.
- Build circuit breakers: after 3 consecutive API failures in 60 seconds, stop making API calls for 30 seconds. Return a graceful degradation response ("I'm experiencing some technical difficulties, let me connect you with a team member").
- Separate critical-path API calls (voice agent mid-conversation) from background tasks (follow-up emails, report generation). Critical calls get priority queue access.
- Monitor cost per agent per day. Set hard ceilings. A runaway agent loop can burn through OpenAI credits in hours.

**Warning signs:**
- OpenAI API error rate above 5%
- Average response time increasing over the course of a day
- Cost per conversation increasing without explanation
- Background tasks (emails, follow-ups) failing silently

**Phase to address:**
Multi-Channel Infrastructure phase (shared infrastructure) and each specialist agent phase (per-agent limits). Circuit breakers must exist before any agent goes into production.

---

### Pitfall 8: AI Agent Takes Destructive CRM Actions Without Confirmation

**What goes wrong:**
The AI agent interprets "cancel the viewing" as "cancel the tenancy." Or it books a viewing at a property that is under offer. Or it updates a landlord's bank details based on a phone call (social engineering attack vector). Unlike a human agent who has contextual judgement about which actions are risky, an LLM with tool-calling access will execute any action its tools allow, as long as the conversation seems to warrant it.

**Why it happens:**
Tool-calling is binary -- the agent either can or cannot call a function. There is no built-in concept of "this action is low-risk" vs "this action requires confirmation." Developers grant broad tool access to make the agent capable, not realising that capability without constraints is dangerous. The widely-cited incident of an AI coding agent deleting a live database illustrates this pattern.

**How to avoid:**
- Classify every CRM action into tiers:
  - **Tier 1 (autonomous):** Read data, create leads, log notes, send pre-approved messages
  - **Tier 2 (confirm with caller):** Book viewings, create maintenance tickets, update contact details
  - **Tier 3 (human approval required):** Cancel tenancies, modify financial records, change bank details, generate legal documents, process refunds
- Implement action validation middleware: before any tool call executes, validate it against the tier system. Tier 3 actions queue for human approval and notify the team via the CRM dashboard.
- Never expose financial write operations (bank details, rent amounts, deposit records) as agent-callable tools. These are human-only operations.
- Log every agent action with the conversation context that triggered it, creating an audit trail.

**Warning signs:**
- Agent executing write operations without any confirmation pattern
- No action tier classification in the tool-calling schema
- Financial or legal data modifiable by agent tool calls
- No audit log of agent-initiated CRM changes

**Phase to address:**
Every specialist agent phase. The action tier system must be defined in the Multi-Channel Infrastructure phase and enforced for each specialist. No specialist ships without its tool access being classified and constrained.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcoding voice prompts in code instead of a prompt management system | Faster initial development | Every prompt change requires a code deploy; cannot A/B test prompts; no version history | Never in production -- prompts change weekly during tuning |
| Storing conversation transcripts as unstructured text blobs | Simple storage | Cannot search, filter, or analyse conversations; compliance audits require structured data | MVP only, migrate within 30 days |
| Using a single OpenAI API key for all agents | No key management overhead | Cannot track cost per agent; cannot rate-limit per agent; one agent's abuse affects all | Never -- use separate keys or at minimum separate tracking from day one |
| Skipping contact deduplication | Faster contact creation | Duplicate leads, duplicate tenants, conflicting records; agents give inconsistent answers | Never -- dedup is a data integrity requirement |
| Building each channel adapter independently | Ship one channel faster | Unifying later requires rewriting session management, contact resolution, and conversation threading | Only if genuinely shipping one channel with no plan for others within 3 months |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Retell AI / Voice Provider | Assuming the voice provider handles conversation state | Voice providers are stateless per call. Your application must maintain conversation history, caller identity, and CRM context. Push context to the agent at call start. |
| Twilio (SMS/WhatsApp) | Treating each inbound message as a new conversation | Use Twilio's conversation SID or implement your own session windowing (messages from same number within 24 hours = same conversation). |
| OpenAI Function Calling | Defining too many tools (10+) per agent | LLMs perform worse with large tool sets. Each specialist should have 5-7 focused tools maximum. Use the supervisor to route to the right specialist rather than giving one agent all tools. |
| DocuSign | Sending AI-generated documents directly for signing | Always route through a human review queue. DocuSign signed documents are legally binding -- an error in an AI-generated contract is a legal liability, not a bug. |
| Supabase/PostgreSQL | Running real-time knowledge base queries through the ORM during voice calls | For sub-100ms retrieval during calls, use direct indexed SQL queries or a Redis cache layer, not Drizzle ORM with its query builder overhead. |
| Microsoft 365 / Email | Processing inbound emails synchronously in the request handler | Email processing should be async (job queue). A slow AI classification step blocking the IMAP polling loop causes email backlogs. |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Loading full property records for every voice call | Response latency increases with property data size | Create a "call context" view with only the fields agents need (address, status, rent, key dates, systems summary) | When properties have 50+ maintenance records and full document histories |
| Storing all conversation history in-memory in the orchestrator | Memory usage grows linearly with concurrent conversations | Persist conversation state to database; load only active conversations | At 20+ concurrent conversations (realistic during office hours) |
| Synchronous AI classification for every inbound message | Message processing bottleneck during peak hours | Queue-based processing with priority for voice (real-time) over email (async) | At 50+ messages per hour across all channels |
| Full-text search over property descriptions for AI queries | Query time grows with property count | Pre-compute property embeddings or use structured filters (postcode, bedrooms, price range) before AI search | At 500+ properties |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| AI agent reading out full bank details or personal data on voice calls | Data breach via social engineering; caller pretends to be a landlord | Never read full bank details on calls. Confirm identity with multiple factors. Read only last 4 digits of account numbers. |
| Storing voice call recordings without GDPR consent | ICO enforcement action; fines up to 4% of turnover | Announce recording at call start. Store consent flag. Implement recording retention policy (delete after 6 months unless disputed). |
| AI agent accepting identity changes via phone ("update my email to...") | Account takeover; redirect tenancy communications to attacker | Identity changes are Tier 3 (human-only). Agent logs the request but does not execute. Human verifies via separate channel. |
| Conversation transcripts containing financial data stored without encryption | Data breach exposure of sensitive financial information | Encrypt transcripts at rest. Redact financial data (card numbers, bank details) from stored transcripts. |
| Agent tool calls not validated against the authenticated caller's permissions | Tenant could trigger landlord-only operations by asking the AI | Every tool call must check the caller's identity tier. Tenants can only trigger tenant-scoped actions. |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| AI agent not identifying itself as AI at call start | Violates UK transparency requirements; callers feel deceived when they realise | Open every call with "Hello, you've reached John Barclay Estate Agents. I'm an AI assistant -- I can help with most enquiries, or connect you to a team member." |
| No "speak to a human" escape hatch | Callers get trapped in AI loops for issues the agent cannot resolve | Allow "speak to a person" or "transfer me" at any point. If the agent fails to resolve after 3 attempts, proactively offer transfer. |
| Overly verbose AI responses on voice calls | Callers zone out; key information is buried | Voice responses must be under 30 seconds. Use confirmation questions instead of monologues. "The property at 42 Elgin Avenue is available at [pound]2,500 per month. Would you like to book a viewing?" |
| Sending WhatsApp/SMS follow-ups without opt-in | Spam complaints; potential PECR violation | First interaction via a channel the caller initiated. Follow-ups on other channels require explicit consent recorded in CRM. |
| AI agent using American English spellings and terminology | Undermines brand credibility for a UK estate agency | System prompts must specify British English. Test for "colour" not "color", "flat" not "apartment", "ground floor" not "first floor". |

## "Looks Done But Isn't" Checklist

- [ ] **Voice Agent:** Works in demo but no filler speech during tool calls -- callers hear dead air in production
- [ ] **Knowledge Base:** Property data is populated but no staleness detection -- expired certs show as valid
- [ ] **Multi-Channel:** Each channel works independently but no unified conversation threading -- context lost between channels
- [ ] **Arrears Chasing:** AI sends messages but no frequency limits or vulnerability detection -- harassment risk
- [ ] **Contract Generation:** Templates exist but not reviewed by a property solicitor against current legislation
- [ ] **Agent Routing:** Supervisor routes correctly in test but no fallback for ambiguous intent -- misroutes in production
- [ ] **Audit Trail:** Agent actions are logged but not linked to the conversation that triggered them -- useless for compliance
- [ ] **Cost Controls:** Agents work but no per-agent token budgets -- runaway costs during spikes
- [ ] **Caller Identification:** Agent answers calls but no pre-call contact lookup -- treats known tenants as strangers
- [ ] **Human Handoff:** Transfer option exists but no context is passed to the human agent -- caller repeats everything
- [ ] **GDPR Compliance:** Data is stored but no retention policy, no deletion capability, no Subject Access Request workflow
- [ ] **Error Recovery:** Agent handles happy path but no graceful degradation when OpenAI API is down

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Wrong contract clause sent via DocuSign | HIGH | Void the document immediately. Contact all parties. Issue corrected agreement. Legal review of all templates. Potential compensation. |
| Arrears harassment complaint | HIGH | Cease automated contact immediately. Human case manager takes over. Review all communications for compliance. Legal counsel. |
| Stale knowledge base causing wrong contractor dispatch | MEDIUM | Audit entire knowledge base. Implement expiry alerts. Refund wasted contractor call-out fees. |
| Misrouted call giving wrong information | MEDIUM | Call the contact back with correct information. Review routing rules. Add the misroute pattern to training data. |
| Cascading API failure dropping calls | MEDIUM | Implement circuit breakers. Add fallback responses. Review rate limiting. Consider backup LLM provider. |
| Context lost across channels | LOW | Retroactively link conversations by contact ID. Build unified threading. Apologise to affected contacts. |
| AI using American English | LOW | Update all system prompts. Add British English test cases. Review generated content for Americanisms. |
| Missing audit trail | MEDIUM | Retroactively reconstruct from logs if possible. Implement structured logging immediately. May not satisfy compliance audit for historical period. |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Voice latency kills conversations | Knowledge Base + Voice Integration | Measure end-to-end response time under load; must be <2s for 95th percentile |
| Multi-agent routing black holes | AI Receptionist (before specialists) | Deploy receptionist logging-only for 1 week; review routing accuracy before connecting specialists |
| Illegal tenancy agreement clauses | AI Admin Specialist | Solicitor review of all templates before agent can use them; programmatic clause validation |
| Arrears harassment | AI PM Specialist | Hard-coded frequency limits verified by unit tests; vulnerability keyword detection tested against scenarios |
| Stale knowledge base | Property Knowledge Base | Every schema entity has `last_verified_at` and `expires_at`; automated alerts for stale/expired entries |
| Cross-channel context loss | Multi-Channel Infrastructure | Integration test: call then WhatsApp then email about same issue; verify single conversation thread |
| Cascading agent failures | Multi-Channel Infrastructure | Load test with 20 concurrent conversations; verify circuit breakers trigger; verify graceful degradation |
| Destructive CRM actions | All specialist phases | Penetration test: attempt Tier 3 actions via voice; verify human approval queue; verify audit log |

## Sources

- [Common Voice AI Agent Challenges and How to Fix Them](https://www.beconversive.com/blog/voice-ai-challenges) - Voice AI deployment pitfalls
- [Multi-agent workflows often fail. Here's how to engineer ones that don't](https://github.blog/ai-and-ml/generative-ai/multi-agent-workflows-often-fail-heres-how-to-engineer-ones-that-dont/) - GitHub's analysis of multi-agent failure modes
- [7 Ways Multi-Agent AI Fails in Production](https://www.techaheadcorp.com/blog/ways-multi-agent-ai-fails-in-production/) - Production failure statistics (40% failure rate)
- [Why Multi-Agent AI Systems Fail and How to Fix Them](https://galileo.ai/blog/multi-agent-ai-failures-prevention) - Failure category breakdown (42% specification, 37% coordination, 21% verification)
- [The Hidden Risks of AI in Real Estate](https://www.reapit.com/content-hub/the-hidden-risks-of-ai-in-real-estate-and-how-to-avoid-them) - UK-specific property AI risks
- [The Dangers of Using AI to Draft Tenancy Agreements](https://www.guildofletting.com/blog/the-dangers-of-using-ai-to-draft-tenancy-agreements-why-professional-expertise-remains-essential) - Guild of Letting & Management warning
- [AI in action: preventing rental arrears](https://housingdigital.co.uk/ai-in-action-preventing-rental-arrears-before-it-happens/) - Arrears AI approaches and risks
- [Landlords using AI cause tribunal hearing headaches](https://www.landlordzone.co.uk/news/landlords-using-ai-cause-tribunal-hearing-headaches) - AI accuracy in legal proceedings
- [AI-enhanced rent collection: protecting vulnerable tenants](https://www.accesspaysuite.com/blog/ai-enhanced-rent-collection-protecting-vulnerable-tenants-without-sacrificing-revenue/) - Vulnerability protocols
- [Retell AI vs Vapi comparison](https://www.retellai.com/comparisons/retell-vs-vapi) - Voice platform latency and limitations
- [How to avoid being an estate agency that fails at AI](https://thenegotiator.co.uk/guest-blog/how-to-avoid-being-an-estate-agency-that-fails-at-ai/) - UK estate agency AI adoption failures

---
*Pitfalls research for: AI Voice Agents & Property Management Intelligence for UK Estate Agency CRM*
*Researched: 2026-03-19*

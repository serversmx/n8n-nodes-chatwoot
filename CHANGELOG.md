# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.9.0] - 2026-09-25

A large correctness and hardening release. An independent audit of 0.8.3 against the Chatwoot
4.13–4.18 source found operations that always failed or silently returned wrong data, plus many
API changes since 4.13. This release fixes every critical and high-severity issue found in this
package, most of the medium ones, and adds the tooling n8n requires to verify community packages.

### Fixed

Critical (every call failed, or silently returned nothing/wrong data):

- **Conversation \> Get Many / Filter** always returned an empty list. Chatwoot wraps the list in
  `{ data: { meta, payload } }`; the node read a top-level `payload` that never existed. Fixed by
  reading `data.payload` (and `data.meta` for counts). The **Status** filter also silently fell
  back to Chatwoot's `open`-only default when left unset — it now explicitly sends `all` (see
  Changed below).
- **Message \> Get Many** duplicated large parts of the message history. The cursor-based
  pagination sent the newest message's ID as `before`, which is the wrong direction for Chatwoot's
  reverse-chronological pages; each "page" mostly re-fetched messages already returned. Fixed by
  cursoring from the oldest message of each page.
- **Every DELETE request silently dropped its body.** The shared request helper stripped the body
  for `DELETE`, so any endpoint that needs one failed outright or reported false success:
  **Team \> Delete Agent** (500 from Chatwoot), **Inbox \> Delete Agent** and
  **Conversation Participant \> Remove** (200 OK, nothing removed), and Platform
  **Account User \> Delete** (200 OK, nothing removed).
- **Profile \> Fetch/Update/Set Availability** always 404'd. `/api/v1/profile` is not nested under
  `/accounts/{id}` like every other Application API route; the node built the account-scoped URL
  anyway. Fixed with a dedicated non-account-scoped request path; Update and Set Availability also
  now send the `{ profile: {...} }` wrapper Chatwoot's controller requires.
- **Inbox \> Add Agent / Delete Agent** always 404'd. Chatwoot exposes `/inbox_members` as a
  collection route with `inbox_id` in the body, not `/inbox_members/{inboxId}`. Fixed to match, and
  added the missing **Update Agents** (replace the member list) operation.
- **Platform \> Account Agent Bot** (all 5 operations) always 404'd: agent bots are a top-level
  Platform API resource (`/platform/api/v1/agent_bots`), never nested under an account.
- **Search** (Conversations/Contacts/Messages) crashed with `payload.slice is not a function`, or
  returned nothing, because each Chatwoot search endpoint returns a differently-shaped payload
  (an object keyed by type, not a flat array). Each search type now has its own extraction.
- **Contact \> Import** sent the CSV as a JSON string; Chatwoot requires a multipart upload. Fixed
  to send it as `multipart/form-data` using n8n's binary-data input, matching **Contact \> Export**
  and the `contactable_inboxes` endpoints, which need the same treatment.
- **Audit Log \> Get Many** always returned an empty list (read `payload`; Chatwoot answers
  `{ audit_logs: [...] }`), and its filters (`auditable_type`, `since`, `until`, `types`) were
  silently ignored.
- **CSAT Survey \> Get** for a conversation returned every CSAT response on the account, because
  `conversation_id` was accepted by the node but never sent to Chatwoot.
- **Chatwoot Trigger**'s webhook lifecycle never stored the webhook's ID. Every activation created
  a new Chatwoot webhook instead of reusing the existing one, deactivation never deleted it, and
  reactivating (or renaming the workflow) failed with 422 "Url has already been taken" once orphans
  piled up. The trigger now reads the webhook back from Chatwoot's response, stores its ID, reuses
  it on reactivation, adopts a webhook a previous 0.8.x activation left behind, and deletes it on
  deactivation.

High:

- **Message \> Update** sent `content`, which Chatwoot's inbox-API endpoint ignores; only
  `status`/`external_error` are accepted, so every call was a silent no-op. It now updates delivery
  status (Sent/Delivered/Read/Failed) instead — see Changed below for what this means for existing
  workflows.
- **Message \> Create** had no way to send attachments or a voice note; **Content** was required
  even for an attachment-only message. Added attachment upload (from binary properties) and a
  Send Audio as Voice Message option; Content is no longer required when an attachment is present.
- **Inbox \> Create** for Website and Email channels failed, and inbox-specific fields declared in
  the UI were never sent in the request body.
- **Toggle Priority** and **Conversation \> Update**'s priority field failed with the default
  "None" value on current Chatwoot (422; older versions 500'd). Sending no `priority` (rather than
  an empty string) now clears it.
- Get Many/Search/Filter operations that use **Return All** could stop after Chatwoot's own
  page-count ceiling (page 100 for conversations, for example) without telling the workflow the
  list was incomplete; several such ceilings are now surfaced or worked around per endpoint.

Plus dozens of medium- and low-severity fixes across almost every resource (wrong or missing
request fields, outdated defaults, endpoints that changed shape between Chatwoot 4.13 and 4.18) —
see the audit report for the complete, per-finding list.

### Added

- **Example workflows and screenshots**: importable workflows in `examples/workflows` (with pinned sample data) and README screenshots taken in n8n 2.40.7.
- **HMAC signature verification** for the Chatwoot Trigger (`X-Chatwoot-Signature`,
  `X-Chatwoot-Timestamp`), on by default (see Changed below).
- **Agent Bot / API Channel trigger mode**: a new **Source** option lets the trigger verify
  deliveries sent directly to a manually-configured URL (an agent bot's or an API channel inbox's
  own Webhook URL, or a webhook you manage by hand) instead of only an n8n-managed account webhook.
  Each source has its own signing secret and event list.
- **Trigger filters**: Inbox IDs, Sender Types, Message Types, Private Notes, Ignore Messages From
  User IDs, and Ignore Outgoing WhatsApp Echoes (Evolution API) — the last one drops the
  `message_created` events Evolution's own outbound relay creates for messages n8n already sent.
- **Inbox Created / Inbox Updated** trigger events (Chatwoot's `ENABLE_INBOX_EVENTS`), with channel
  secrets redacted by default (**Redact Channel Secrets** option).
- **`usableAsTool: true`** on the Chatwoot node: it can now be attached as a tool to the **AI
  Agent** node.
- **Automatic retries with backoff** for `429` and idempotent `502`/`503`/`504` responses, honoring
  Chatwoot's `Retry-After` header when present.
- **Conversation**: Append Labels / Remove Labels (in addition to the existing Set Labels),
  Merge With Existing option for Update Custom Attributes, Assign by Agent Bot or Captain
  (AI) Assistant, `sort_by`/`conversation_type`/`source_id`/`updated_within` filters.
- **Contact**: Append Labels / Remove Labels, `source_id` on create, `additional_attributes`,
  `avatar_url`/`blocked` on create, labels filter.
- **Team \> Reset Secret**, **Inbox \> Reset Secret / Rotate HMAC Token**, and other
  previously-missing admin endpoints.
- **Report \> Drilldown**: the list of conversations/messages behind a report metric.
- New Public API options: identity validation (`identifier_hash`) for contacts, CSAT survey
  get/submit, cursor-paginated message history (previously capped at the last 20 messages), and a
  new **\[Public\] Inbox** resource (Get: the API inbox's public settings — name, working hours,
  whether CSAT and identity validation are enforced).
- Expanded test suite: 1007 unit tests across 12 suites (up from 241), including a request-layer
  harness (`test/helpers/mockExecuteFunctions.ts`) that exercises every resource's `execute()`
  branch against mocked HTTP responses.

### Changed / Behavior changes

Several 0.8.3 behaviors were bugs, but existing workflows may depend on them. Each has a
compatibility option that defaults to the old behavior where practical, and defaults to the fixed
behavior where the old one was simply wrong with no reasonable use:

- **Simplify Output** (new option, default **off**) on the handful of operations that returned
  Chatwoot's raw envelope in 0.8.3 (`helpCenter` Get Many Categories/Portals, `inbox` Get Members,
  `slaPolicy` Get Many, `webhook` Create/Get Many/Update): left off, they keep returning the
  complete response (payload plus metadata), so expressions written against 0.8.3's output keep
  working. Turn it on to get one item per record instead.
- **Conversation/Contact \> Set Labels** (the operation that used to be the only "Add Labels")
  keeps its 0.8.3 **replace-all** behavior under its original parameter value, so existing
  workflows are unaffected. The new **Append Labels** and **Remove Labels** operations do what
  "Add Labels" used to sound like it did.
- **Update Custom Attributes** (conversation) now defaults to **replacing** the whole
  `custom_attributes` object, matching 0.8.3. Turn on **Merge With Existing** to merge into the
  current attributes instead (Chatwoot 4.17+).
- **Chatwoot Trigger \> Include Raw Body** keeps returning the parsed JSON body under `rawBody`,
  exactly as in 0.8.3. The new **Include Raw Body Text** option adds `rawBodyText`, the exact bytes
  Chatwoot signed — use it if you need to verify the signature yourself downstream.
- **Verify Signature** defaults to **on**. Existing workflows using the account-webhook source
  (the only source 0.8.x supported) already have a signing secret stored from activation, so
  verification succeeds transparently; turn it off only for a server that never signed its
  requests. New Agent Bot/API Channel sources require a secret unless this is off.
- **Conversation \> Get Many/Filter \> Status = All** now genuinely returns conversations of every
  status. In 0.8.3, leaving Status unset (the field's own default) silently fell back to Chatwoot's
  server-side default of **Open only** — a workflow that looked like it filtered nothing was
  actually always filtering to open conversations.
- **Message \> Update**'s **Content** field is gone (Chatwoot's inbox-API endpoint never applied it
  in 0.8.3 either — this was always a no-op, never a working "edit message" feature). The operation
  now does what Chatwoot's endpoint actually supports: change a message's delivery **Status**
  (Sent/Delivered/Read/Failed).
- **Message \> Get Many**'s pagination order for the fixed page size changed direction (oldest of
  each cursor page, not newest) as part of the duplicate-messages fix above; workflows that relied
  on the specific duplicated rows 0.8.3 returned will see different (correct) results.

### Compatibility

- **Chatwoot**: tested against the documented behavior of 4.13 through 4.18 (current at the time of
  the audit). Chatwoot 4.14+ delivers webhooks through an anti-SSRF filter (SafeFetch): if this n8n
  instance is reachable only by a private address (Docker service name, `localhost`, `10.x`,
  `172.16–31.x`, `192.168.x`), Chatwoot silently drops every delivery unless
  `SAFE_FETCH_ALLOW_PRIVATE_NETWORK=true` is set on the Chatwoot server (the Chatwoot Trigger shows
  a notice about this). Chatwoot 4.14+ also requires an administrator token for Custom Attribute
  Create/Update/Delete (an agent token used to be enough) and can 403 Company operations when the
  account's `companies` feature isn't enabled.
- **n8n**: works on current n8n 2.x. n8n 3.0 (planned for October 2026) disables unverified
  community packages by default — see README for the `N8N_UNVERIFIED_PACKAGES_ENABLED` workaround
  until this package is verified.
- **Evolution API** (WhatsApp): see the README's "Using with Evolution API" section for
  identifier/JID, typing-indicator and attachment notes specific to API-channel inboxes.

## [0.8.3] - 2026-05-06

### Fixed

- **CRITICAL: `conversation.updateCustomAttributes`** silently no-op'd. The fix in v0.4.3 (POST→PATCH) routed through `PATCH /conversations/:id`, but Chatwoot's `permitted_update_params` only permits `:priority` — `custom_attributes` was accepted with 200 OK and silently discarded. Now uses the dedicated `POST /conversations/:id/custom_attributes` endpoint with `attribute_key: null` to set all keys at once. Verified against Chatwoot's `ConversationsController#custom_attributes`.

- **`helpCenter.createPortal` / `updatePortal` / `createCategory` / `createArticle`** were sending unwrapped bodies. Chatwoot's controllers use `params.require(:portal | :category | :article)` so:
  - `createPortal` returned 500 (ParameterMissing)
  - `updatePortal` silently no-op'd (`if params[:portal].present?` guard)
  - `createCategory` / `createArticle` likewise failed with 500
  - Now bodies are properly wrapped: `{ portal: {...} }`, `{ category: {...} }`, `{ article: {...} }`. Verified against Chatwoot's `*Controller#*_params` private methods.

---

## [0.8.2] - 2026-05-06

### Documentation

- **README**: Fixed broken Chatwoot logo link (Chatwoot's CDN returned 404). Now uses the local SVG via GitHub raw URL.
- **README**: Updated stats to reflect v0.8.x (38 resources, 220+ operations)
- **README**: Added documentation for new resources: Reports v2 (16 ops), Live Reports, Summary Reports, Applied SLAs
- **README**: Added WhatsApp `template_params` usage notes for `message.create`

---

## [0.8.1] - 2026-05-06

### Added

- **WhatsApp Template Messages**: New `template_params` JSON option in `message.create` for sending WhatsApp template messages. Supports the standard Chatwoot format: `{"name": "template_name", "category": "MARKETING|UTILITY|AUTHENTICATION", "language": "en_US", "processed_params": {"1": "value1", "2": "value2"}}`. Resolves [#1](https://github.com/RenatoAscencio/n8n-nodes-chatwoot/issues/1).

---

## [0.8.0] - 2026-05-06

### Fixed

- **CRITICAL: Reports API was completely broken** — All report endpoints (`/reports/summary`, `/reports/agents`, `/reports/conversations`, etc.) were being called under `/api/v1/` but Chatwoot only exposes them under `/api/v2/`. Every report call was returning 404 since v0.3.0. Fixed by adding new `chatwootApiV2Request()` helper and routing all reports through v2.

### Added

#### New v2 API Helper

- **`chatwootApiV2Request()`** in GenericFunctions — calls `/api/v2/accounts/{id}/...` for Reports endpoints

#### Report Resource (Expanded)

Existing 4 ops now use v2, plus 12 new ops added (16 total):

- Account Summary, Timeseries, Bot Summary, Bot Metrics, Agent Statistics, Inbox Statistics, Label Statistics, Team Statistics, Conversation Statistics, Conversations Summary, Conversation Traffic, Inbox Label Matrix, First Response Time Distribution, Outgoing Messages Count, Year in Review, Conversation Counts (kept on v1)

#### Live Report Resource — NEW

Real-time conversation metrics:

- Conversation Metrics: Get real-time counts (open, unattended, unassigned, pending)
- Grouped Conversation Metrics: Group counts by team or agent

#### Summary Report Resource — NEW

Per-entity summary metrics with date range:

- Agent / Team / Inbox / Label / Channel summaries

### Technical

- 38 total resources with 220+ operations
- 241 unit tests
- All Reports endpoints now use correct `/api/v2/` base path

---

## [0.7.1 - 0.7.4] - 2026-04-14

Consolidated patch fixes:

- **0.7.4**: contact.create — `inboxId` is now optional (moved to additionalFields)
- **0.7.3**: notification pagination — page-size detection (15/page) instead of incorrect `meta.count` check; toggleTyping — removed undocumented `is_private` field
- **0.7.2**: trigger checkExists — single API call, deletes stale webhook on URL change, propagates auth/network errors; types — added `conversation_typing_on`/`off` to `WebhookSubscription` and `TriggerEventType`
- **0.7.1**: pagination — dynamic page size detection; clone qs to avoid mutation; cursor pagination guard against falsy/unchanged message.id; Array.isArray guards on getAgents/getAgentBots

---

## [0.7.0] - 2026-04-14

### Fixed

- **CRITICAL: conversation.update** used `PUT` instead of `PATCH` — every call would fail with 404/405. Now uses correct `PATCH` method
- **CRITICAL: csatSurvey.get** used non-existent endpoint `/csat_survey/{id}`. Fixed to `GET /csat_survey_responses?conversation_id={id}`
- **All bare JSON.parse calls** (15+ locations) replaced with safe `parseJsonSafe()` helper that returns descriptive errors instead of raw SyntaxError crashes. Affected: conversation.create, conversation.filter, contact.create, contact.update, contact.filter, automationRule.create/update, customFilter.create/update, integration.createHook/updateHook, macro.create/update, campaign.create, platformUser.create/update, publicContact.create/update, publicConversation.create

### Added

- **Applied SLA Resource (Enterprise)** — 3 operations: list applied SLAs, get SLA metrics, download breached conversations CSV
- **Notification Snooze** — snooze a notification until a specified time
- **Profile Set Availability** — directly set online/offline/busy status
- **parseJsonSafe()** utility in GenericFunctions — safe JSON parsing with descriptive errors, handles both string and object inputs

### Technical

- 36 total resources with 200+ operations
- 211 unit tests (2 suites)

---

## [0.6.1] - 2026-04-14

### Fixed

- **Contact Import**: Changed from string CSV to proper multipart file upload using n8n binary data — now works with Read Binary File and HTTP Request nodes

### Added

- **Unit Tests**: Added 130 new resource definition tests (66 → 196 total) covering all 13 resource modules — validates operation structure, alphabetical sorting, displayOptions targeting, and operation counts

### Enhanced

- **README.md**: Updated to reflect 35 resources, 195+ operations, 10 trigger events, and documented all new resources (Macro, Notification, Campaign, Contact Note, Conversation Participant, Company, SLA Policy, Search)

---

## [0.6.0] - 2026-04-14

### Added

#### New Application API Resources

- **Company Resource (Enterprise)** - NEW
  - Get Many: List all companies with sorting
  - Get: Retrieve a company by ID
  - Create: Create a new company
  - Update: Modify company settings
  - Delete: Remove a company
  - Search: Search companies by name or domain

- **SLA Policy Resource (Enterprise)** - NEW
  - Get Many: List all SLA policies
  - Get: Retrieve an SLA policy by ID
  - Create: Create an SLA policy with response/resolution thresholds
  - Update: Modify SLA policy settings
  - Delete: Remove an SLA policy

- **Search Resource (Global)** - NEW
  - Search All: Search across all entities (conversations, contacts, messages)
  - Search Conversations: Search conversations only
  - Search Contacts: Search contacts only
  - Search Messages: Search messages only

### Enhanced

- **Conversation Resource**
  - Transcript: Send conversation transcript via email
  - Toggle Typing: Show/hide typing indicator

- **Contact Resource**
  - Import: Import contacts from CSV data
  - Export: Export contacts as CSV
  - Contactable Inboxes: Get inboxes that can reach a contact

- **Help Center Resource**
  - List Portals: List all help center portals
  - List Categories: List categories in a portal
  - List Articles: List articles in a portal with filters

- **CSAT Survey Resource**
  - Metrics: Get CSAT survey metrics summary
  - Download: Download CSAT survey responses

### Technical

- 35 total resources with 195+ operations
- 3 new resource folders (company, search, slaPolicy)
- 10 new operations on existing resources

---

## [0.5.0] - 2026-03-24

### Added

#### New Application API Resources

- **Macro Resource** - NEW
  - Get Many: List all macros
  - Get: Retrieve a macro by ID
  - Create: Create a new macro with actions
  - Update: Modify macro settings
  - Delete: Remove a macro
  - Execute: Execute a macro on a conversation

- **Notification Resource** - NEW
  - Get Many: List notifications (with read/snoozed/sort filters)
  - Mark Read: Mark a notification as read
  - Mark Unread: Mark a notification as unread
  - Mark All Read: Mark all notifications as read
  - Delete: Remove a notification
  - Unread Count: Get count of unread notifications

- **Campaign Resource** - NEW
  - Get Many: List all campaigns
  - Get: Retrieve a campaign by ID
  - Create: Create a new campaign
  - Update: Modify campaign settings
  - Delete: Remove a campaign

- **Contact Note Resource** - NEW
  - Get Many: List all notes for a contact
  - Create: Create a note on a contact
  - Update: Modify a contact note
  - Delete: Remove a contact note

- **Conversation Participant Resource** - NEW
  - Get Many: List participants of a conversation
  - Add: Add participants to a conversation
  - Remove: Remove participants from a conversation

### Enhanced

- **Conversation Resource**
  - Mute: Mute a conversation
  - Unmute: Unmute a conversation
  - Delete: Delete a conversation
  - Search: Search conversations by query

- **Profile Resource**
  - Update: Update profile (name, email, availability, auto_offline)

- **Chatwoot Trigger Node**
  - Added conversation_typing_on and conversation_typing_off webhook events

### Fixed

- Fixed npm audit vulnerabilities (flatted, minimatch, ajv)

### Technical

- 32 total resources with 160+ operations
- 10 webhook event types supported

---

## [0.4.1] - 2026-02-04

### Fixed

- **HTTP transport**: Prefer `this.helpers.httpRequest` (modern n8n) with automatic fallback to `this.helpers.request` (legacy) via new `performRequest()` wrapper
- **Base URL validation**: `normalizeBaseUrl()` now rejects URLs without `http://` or `https://` protocol, throwing `NodeOperationError` with actionable message
- **Help Center categories dropdown**: `getCategories` loadOptions now fetches real categories from `GET /portals/{slug}/categories` instead of returning an empty stub array

### Added

- **Public API credential test**: Declarative `ICredentialTestRequest` that validates inbox identifier by POSTing a test contact — catches invalid identifiers before workflow execution
- **E2E test runner**: `scripts/e2e-runner.ts` — portable end-to-end test suite for Application, Platform, and Public APIs against a live Chatwoot instance
- **E2E documentation**: `docs/TESTING_E2E.md` setup guide and `docs/E2E_RESULTS.md` run results
- **Audit deliverables**: `docs/AUDIT_REPORT.md`, `docs/SECURITY_REVIEW.md`, `docs/RELEASE_READINESS.md`, `docs/UPSTREAM_PROPOSAL_CHATWOOT.md`

### Improved

- **Unit tests**: Expanded from 19 to 66 tests covering normalizeBaseUrl, URL construction, auth headers, request body handling, pagination patterns, and error mapping
- **Public API credential UX**: Description now clarifies that only Web Widget inboxes (Channel::WebWidget) support the Public API, with instructions to find the UUID identifier

---

## [0.4.0] - 2026-02-03

### Added

This is a **major expansion release** that brings the node to feature parity with ~130+ operations across Application, Platform, and Public APIs. Total resources increased from 15 to 27.

#### New Credentials

- **ChatwootPlatformApi** - Platform API token for managing accounts, users, and agent bots at the platform level
- **ChatwootPublicApi** - Public API authentication using inbox identifier for widget/client-side operations

#### New Application API Resources

- **Profile Resource** - NEW
  - Fetch: Get the authenticated user's profile

- **Help Center Resource** - NEW
  - Create Portal: Create a new help center portal
  - Get Portal: Retrieve portal details by slug
  - Update Portal: Modify portal settings
  - Create Category: Add a category to a portal
  - Create Article: Add an article to a portal

- **Integration Resource** - NEW
  - Get Many: List all integrations
  - Create Hook: Create an integration hook (Dialogflow, Slack, etc.)
  - Update Hook: Modify hook settings
  - Delete Hook: Remove an integration hook

- **Audit Log Resource** - NEW
  - Get Many: Retrieve account audit logs

- **CSAT Survey Resource** - NEW
  - Get: Get CSAT survey for a conversation

#### New Platform API Resources (requires ChatwootPlatformApi credential)

- **Platform Account Resource** - NEW
  - Create: Create a new account
  - Get: Retrieve account details
  - Update: Modify account settings
  - Delete: Remove an account

- **Platform User Resource** - NEW
  - Create: Create a new platform user
  - Get: Retrieve user details
  - Update: Modify user settings
  - Delete: Remove a user
  - Get SSO URL: Generate SSO login URL

- **Account User Resource** - NEW
  - Get Many: List all users in an account
  - Create: Add a user to an account
  - Delete: Remove a user from an account

- **Account Agent Bot Resource** - NEW
  - Get Many: List all account agent bots
  - Get: Retrieve an agent bot by ID
  - Create: Create a new account agent bot
  - Update: Modify agent bot settings
  - Delete: Remove an account agent bot

#### New Public API Resources (requires ChatwootPublicApi credential)

- **Public Contact Resource** - NEW
  - Create: Create a contact via public API
  - Get: Retrieve contact details
  - Update: Update contact information

- **Public Conversation Resource** - NEW
  - Create: Create a conversation via public API
  - Get: Retrieve a conversation
  - Get Many: List all conversations for a contact
  - Resolve: Resolve/toggle conversation status
  - Toggle Typing: Show typing indicator
  - Update Last Seen: Mark messages as seen

- **Public Message Resource** - NEW
  - Create: Send a message via public API
  - Get Many: List messages in a conversation
  - Update: Update a message

### Enhanced

- **Contact Resource**
  - Filter: Filter contacts with advanced criteria
  - Add Labels: Add labels to a contact
  - List Labels: Get all labels for a contact

- **Conversation Resource**
  - Update: Update conversation (custom attributes, team, etc.)
  - Filter: Filter conversations with advanced criteria
  - Update Custom Attributes: Set custom attributes on conversation
  - List Labels: Get all labels for a conversation
  - Get Meta: Get conversation metadata

- **Message Resource**
  - Update: Update an existing message

- **Team Resource**
  - Add Agent: Add an agent to a team
  - Delete Agent: Remove an agent from a team
  - Get Members: List team members
  - Update Agents: Update team agent memberships

- **Inbox Resource**
  - Create: Create a new inbox
  - Add Agent: Add an agent to an inbox
  - Delete Agent: Remove an agent from an inbox
  - Get Members: List inbox members
  - Get Agent Bot: Get associated agent bot
  - Set Agent Bot: Associate an agent bot with inbox

### Technical

- Multi-API architecture supporting Application, Platform, and Public APIs
- Conditional credential selection based on resource type
- Enhanced GenericFunctions for handling different API authentication patterns
- 27 total resources with 130+ operations

---

## [0.3.0] - 2026-02-03

### Added

This release adds 4 more resources and additional operations for existing resources, bringing the total to 15 resources with 55+ operations.

- **Agent Bot Resource** - NEW
  - Get Many: List all agent bots
  - Get: Retrieve an agent bot by ID
  - Create: Create a new agent bot
  - Update: Modify agent bot settings
  - Delete: Remove an agent bot

- **Automation Rule Resource** - NEW
  - Get Many: List all automation rules
  - Get: Retrieve an automation rule by ID
  - Create: Create a new automation rule with conditions and actions
  - Update: Modify automation rule settings
  - Delete: Remove an automation rule

- **Custom Filter Resource** - NEW
  - Get Many: List all custom filters (conversation, contact, report)
  - Get: Retrieve a custom filter by ID
  - Create: Create a new custom filter
  - Update: Modify filter settings
  - Delete: Remove a custom filter

- **Report Resource** - NEW
  - Account Summary: Get account-level report summary
  - Agent Statistics: Get agent conversation metrics
  - Conversation Counts: Get conversation counts by status
  - Conversation Statistics: Get statistics grouped by agent, inbox, team, or channel

### Enhanced

- **Conversation Resource**
  - Create: Create a new conversation
  - Toggle Priority: Set conversation priority (urgent, high, medium, low, none)

- **Message Resource**
  - Delete: Delete a message from a conversation

### Fixed

- **Icon**: Updated to official Chatwoot logo from Simple Icons for better display in n8n

---

## [0.2.0] - 2026-02-03

### Added

This is a major feature release that significantly expands the node's capabilities with 8 new resources, a trigger node, and improved UX.

- **Chatwoot Trigger Node** - NEW
  - Webhook-based trigger that starts workflows when events occur in Chatwoot
  - Auto-registers and manages webhooks in Chatwoot
  - Supports 8 event types: conversation_created, conversation_status_changed, conversation_updated, message_created, message_updated, contact_created, contact_updated, webwidget_triggered

- **Account Resource** - NEW
  - Get: Retrieve account information
  - Update: Modify account settings (name, locale, support email, auto-resolve duration)

- **Agent Resource** - NEW
  - Get Many: List all agents in the account
  - Create: Add a new agent with email, name, and role
  - Update: Modify agent settings (role, availability, auto-offline)
  - Delete: Remove an agent from the account

- **Team Resource** - NEW
  - Get Many: List all teams
  - Get: Retrieve team details
  - Create: Create a new team
  - Update: Modify team settings
  - Delete: Remove a team

- **Inbox Resource** - NEW
  - Get Many: List all inboxes
  - Get: Retrieve inbox details
  - Update: Modify inbox settings (name, greeting, auto-assignment, etc.)

- **Label Resource** - NEW
  - Get Many: List all labels
  - Create: Create a new label with title, color, and description
  - Update: Modify label properties
  - Delete: Remove a label

- **Canned Response Resource** - NEW
  - Get Many: List all canned responses
  - Create: Create a new canned response (short code + content)
  - Update: Modify an existing canned response
  - Delete: Remove a canned response

- **Custom Attribute Resource** - NEW
  - Get Many: List all custom attributes
  - Get: Retrieve a specific attribute by key
  - Create: Create a new custom attribute for contacts or conversations
  - Update: Modify an existing attribute
  - Delete: Remove a custom attribute

- **Webhook Resource** - NEW
  - Get Many: List all webhooks
  - Create: Register a new webhook URL with event subscriptions
  - Update: Modify webhook URL or subscriptions
  - Delete: Remove a webhook

- **Dynamic Dropdowns**
  - Agents: Auto-populated list of agents for assignment
  - Teams: Auto-populated list of teams for assignment
  - Inboxes: Auto-populated list of inboxes for filtering
  - Labels: Auto-populated list of labels for tagging

### Enhanced

- **Conversation Resource**
  - Assign: Assign conversations to agents or teams with dynamic dropdowns
  - Add Labels: Set labels on conversations with multi-select dropdown

- **Contact Resource**
  - Get Conversations: Retrieve all conversations for a specific contact
  - Merge: Merge two contacts into one

### Improved

- **TypeScript Types**: Comprehensive type definitions for all Chatwoot entities
- **Test Suite**: Expanded from 7 to 19 tests with coverage for simplifyResponse
- **README**: Complete redesign with badges, table of contents, Docker instructions, and comprehensive documentation
- **Error Messages**: Improved user-friendly error messages with actionable solutions

### Technical

- Official Chatwoot logo SVG from brand-assets repository
- Modular resource/operation architecture for maintainability
- LoadOptions methods for dynamic dropdown population
- Support for both page-based and cursor-based pagination

## [0.1.2] - 2026-02-03

### Fixed

- Republished package after npm token revocation

## [0.1.1] - 2025-02-03

### Changed

- Renamed package to `@renatoascencio/n8n-nodes-chatwoot` (original name was already taken on npm)
- Added `publishConfig` for scoped public package

## [0.1.0] - 2025-02-03

### Added

- Initial release of @renatoascencio/n8n-nodes-chatwoot
- **Conversation Resource**
  - Get: Retrieve a single conversation by ID
  - Get Many: List conversations with filters (status, inbox, team, labels, search query, assignee type)
  - Update Status: Change conversation status (open, resolved, pending, snoozed)
- **Message Resource**
  - Create: Send a message to a conversation (supports outgoing/incoming, private notes)
  - Get Many: Retrieve all messages from a conversation with cursor-based pagination
- **Contact Resource**
  - Create: Create new contacts with name, email, phone, identifier, and custom attributes
  - Get: Retrieve a single contact by ID
  - Get Many: List contacts with sorting options
  - Update: Update contact fields including custom attributes
  - Delete: Remove a contact
  - Search: Search contacts by name, email, phone, or identifier
- **Authentication**
  - Support for Chatwoot API Access Token
  - Compatible with both Cloud (app.chatwoot.com) and self-hosted instances
  - Credential testing on save
- **Pagination**
  - Automatic page-based pagination for conversations and contacts
  - Cursor-based pagination for messages
  - "Return All" option with configurable limits
- **Error Handling**
  - User-friendly error messages for common HTTP errors (401, 403, 404, 429, 500)
  - Support for n8n's "Continue on Fail" option
  - Input validation for required fields

# Supabase Vault Explanation

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    YOUR APPLICATION                          │
│  (Python backend with Supabase client)                      │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ REST API Call
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                      PostgREST                               │
│  (Only exposes 'public' and 'graphql_public' schemas)      │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ Calls public.vault_create_secret()
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              PUBLIC SCHEMA (Wrapper Functions)               │
│                                                              │
│  public.vault_create_secret(secret, name, desc)             │
│  public.vault_get_secret(secret_id)                         │
│  public.vault_update_secret(secret_id, secret, ...)         │
│  public.vault_delete_secret(secret_id)                      │
│                                                              │
│  These functions have SECURITY DEFINER privilege            │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       │ Calls vault.create_secret()
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                  VAULT SCHEMA (Actual Vault)                 │
│                                                              │
│  ┌─────────────────────────────────────────────┐           │
│  │       vault.secrets (TABLE)                 │           │
│  │  - Stores ENCRYPTED data on disk            │           │
│  │  - secret column contains encrypted blob    │           │
│  │  - Encryption key is NOT in the database    │           │
│  │  - Backups contain ENCRYPTED data           │           │
│  └─────────────────────────────────────────────┘           │
│                       ▲                                      │
│                       │                                      │
│                       │ Encrypts/Decrypts on the fly        │
│                       │                                      │
│  ┌─────────────────────────────────────────────┐           │
│  │   vault.decrypted_secrets (VIEW)            │           │
│  │  - Virtual view, not stored on disk         │           │
│  │  - Decrypts secrets when queried            │           │
│  │  - Has 'decrypted_secret' column            │           │
│  │  - This is what Supabase UI shows you       │           │
│  └─────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow Example: Storing an Airtable Token

### Step 1: OAuth Callback Receives Token
```python
# backend/oauth/routes.py
refresh_token = "sk_live_abc123..."  # From Airtable
```

### Step 2: Call vault.create_secret
```python
# backend/services/vault.py
refresh_secret_id, _ = await create_secret(
    settings,
    name=f"airtable-refresh-{org_id}-{uuid4()}",
    secret=refresh_token,  # The actual token value
    description=f"Airtable refresh token for org {org_id}"
)
# Returns: UUID like "c9b00867-ca8b-44fc-a81d-d20b8169be17"
```

### Step 3: What Happens in the Database

#### In vault.secrets table (encrypted):
```
id:          c9b00867-ca8b-44fc-a81d-d20b8169be17
name:        airtable-refresh-00000000-0000-0000-0000-000000000000-abc
secret:      3mMeOcoG84a5F2uOfy2ugWYDp9sdxvCTmi6kTeT97bvA8rCEsG5DWWZtTU8VVeE=
                     ↑ THIS IS ENCRYPTED - unreadable on disk
key_id:      8c72b05e-b931-4372-abf9-a09cfad18489
nonce:       \x1d3b2761548c4efb2d29ca11d44aa22f
created_at:  2025-11-04 10:30:00
```

#### In vault.decrypted_secrets view (decrypted):
```
id:                c9b00867-ca8b-44fc-a81d-d20b8169be17
secret:            3mMeOcoG84a5F2uOfy2ugWYDp9sdxvCTmi6kTeT97bvA8rCEsG5DWWZtTU8VVeE=
decrypted_secret:  sk_live_abc123...  ← The actual token (decrypted!)
```

**When you click the eye icon in Supabase UI:**
- The UI queries `vault.decrypted_secrets` view
- The view decrypts the data on-the-fly
- You see the actual token value

**Why this is still secure:**
1. Data is ALWAYS encrypted on disk
2. Database backups contain encrypted data
3. Encryption key is NOT stored in the database
4. Supabase manages the encryption key separately
5. Only users with proper permissions can query the decrypted view

### Step 4: Store the Secret ID Reference
```python
# backend/oauth/routes.py
repo.upsert_connection(
    organization_id=org_id,
    provider="airtable",
    refresh_token=None,  # ← NOT storing the actual token here!
    access_token=None,   # ← NOT storing the actual token here!
    refresh_token_secret_id=refresh_secret_id,  # ← Just the UUID reference
    access_token_secret_id=access_secret_id,    # ← Just the UUID reference
    expires_at=expires_at,
    scope=scope,
)
```

#### In integration_connections table:
```
organization_id:           00000000-0000-0000-0000-000000000000
provider:                  airtable
refresh_token:             NULL  ← No token here!
access_token:              NULL  ← No token here!
refresh_token_secret_id:   c9b00867-ca8b-44fc-a81d-d20b8169be17  ← Just the ID
access_token_secret_id:    7095d222-efe5-4cd5-b5c6-5755b451e223  ← Just the ID
expires_at:                2025-11-04 12:00:00
```

## What Are Secret IDs?

**Secret IDs are POINTERS, not the actual secrets.**

Think of it like this:
- **vault.secrets** = A secure vault with numbered boxes
- **Secret ID** = The box number (e.g., "Box #42")
- **Actual Token** = The valuable item inside the box

### Why Use Secret IDs Instead of Storing Tokens Directly?

#### ❌ BAD: Storing tokens directly in integration_connections
```
integration_connections:
  refresh_token: "sk_live_abc123secrettoken"  ← EXPOSED in regular table!
  access_token:  "at_xyz789accesstoken"       ← EXPOSED in regular table!
```
**Problems:**
- Tokens stored in plain text in regular table
- Visible in database dumps
- Accessible by anyone who can query the table
- If someone gains read access to your DB, they get all tokens

#### ✅ GOOD: Using Vault with secret IDs
```
integration_connections:
  refresh_token_secret_id: "c9b00867-ca8b-44fc-a81d-d20b8169be17"  ← Just a UUID
  
vault.secrets:
  id: "c9b00867-ca8b-44fc-a81d-d20b8169be17"
  secret: "3mMeOcoG84a5F2uOfy2ugWYDp9sdxvCTmi6kTeT97bvA8rCEsG5DWWZtTU8VVeE="  ← ENCRYPTED!
```
**Benefits:**
- Tokens are encrypted at rest
- Database dumps contain only encrypted data
- Separate permissions for vault access
- Encryption key managed by Supabase (not in DB)

## How to Retrieve a Token Later

When you need to use the Airtable token to make API calls:

```python
# 1. Get the connection record
connection = repo.get_connection(organization_id, provider="airtable")

# 2. Extract the secret ID (not the token!)
refresh_token_secret_id = connection.refresh_token_secret_id
# This is just: "c9b00867-ca8b-44fc-a81d-d20b8169be17"

# 3. Fetch the actual token from Vault
from backend.services.vault import get_secret

actual_refresh_token = await get_secret(
    settings, 
    secret_id=str(refresh_token_secret_id)
)
# Now you have: "sk_live_abc123..."

# 4. Use the token to call Airtable API
headers = {"Authorization": f"Bearer {actual_refresh_token}"}
```

## Security Model

### Layer 1: Network Security
- Your app calls Supabase over HTTPS
- Service role key authenticates the request

### Layer 2: PostgREST Schema Isolation
- PostgREST only exposes `public` schema
- Direct access to `vault` schema blocked

### Layer 3: Wrapper Functions with SECURITY DEFINER
- Public wrapper functions act as controlled access points
- They have elevated privileges to call vault functions
- You control what parameters they accept

### Layer 4: Vault Encryption
- Vault encrypts data using AES-256-GCM (authenticated encryption)
- Encryption key stored separately from database
- Only decryptable through vault.decrypted_secrets view

### Layer 5: Database Permissions
- RLS (Row Level Security) can be applied
- Grant/revoke access to vault functions per role
- Service role has full access

## Why Supabase UI Shows Decrypted Values

The Supabase dashboard UI:
1. Connects with your service role credentials
2. Queries `vault.decrypted_secrets` view (not the table)
3. The view automatically decrypts on-the-fly
4. Shows you the decrypted value

**This is by design** - you need to be able to see your secrets to manage them. But:
- You're authenticated with proper credentials
- The data is still encrypted at rest
- Backups contain encrypted data
- Anyone who steals a database dump gets encrypted blobs

## Common Questions & Misconceptions

### Q: "What does 'unreadable on disk' mean? What's the disk?"

**Disk = Physical storage (SSD/hard drive)** where database files are saved.

**Without Encryption:**
```
File on disk: integration_connections.dat
Binary: 01110011 01101011 01011111 01101100 01101001...
Readable as: "sk_live_abc123secrettoken"
```
Anyone with file access can read the token.

**With Vault Encryption:**
```
File on disk: vault_secrets.dat
Binary: 11010001 00101110 10110101 01001011 10011100...
Readable as: "3mMeOcoG84a5F2uOfy2ugWYDp9sdxvCTmi6kTeT97bvA8rCEsG5D..."
```
Without the encryption key, it's garbage. Even if someone steals the entire disk.

---

### Q: "If I click the eye icon and see the token, how is it encrypted?"

**It's encrypted ON DISK, decrypted IN MEMORY when you query it.**

```
Disk (Storage)                    Memory (RAM)                   Your Browser
─────────────────                ─────────────────              ──────────────
[encrypted blob]  ──reads──>    [decryption happens]  ──>      "sk_live_abc123"
Always encrypted               Temporary, in RAM               Shown to you
```

**Analogy:** A locked safe
- The safe (disk) contains encrypted documents
- When you authenticate and open it (query), you can read them
- But they're still encrypted in the safe when closed

**Protection:** If someone:
- Steals the hard drive → Gets encrypted blobs (useless)
- Steals a backup → Gets encrypted blobs (useless)
- Hacks your filesystem → Gets encrypted blobs (useless)

They need BOTH:
1. The encrypted data (from disk)
2. The encryption key (stored separately by Supabase)

---

### Q: "What does 'decrypt data on the fly' mean?"

**"On the fly" = "in real-time when you ask for it"**

**Step-by-step when you click the eye icon:**

```
1. You click eye icon in Supabase UI
   ↓
2. UI sends query: SELECT * FROM vault.decrypted_secrets WHERE id = 'uuid';
   ↓
3. Postgres reads encrypted blob from disk file
   [Encrypted: "3mMeOcoG84a5F2uOfy2ugWYDp9sdxvCTmi6kTeT97bvA..."]
   ↓
4. Vault extension fetches encryption key from Supabase's secure storage
   [Key ID: 8c72b05e-b931-4372-abf9-a09cfad18489]
   ↓
5. Decryption happens in Postgres memory (RAM)
   [Decrypted: "sk_live_abc123secrettoken"]
   ↓
6. Postgres returns decrypted value to UI
   ↓
7. UI shows you: "sk_live_abc123secrettoken"
   ↓
8. Decrypted value is discarded from memory (not saved anywhere)
```

**Important:** The decrypted value exists **temporarily in memory only**. It's never written to disk in decrypted form.

**Why "on the fly" matters:**
- Decrypted data doesn't linger
- Not written to logs (if configured properly)
- Not in backups
- Not in replication streams

---

### Q: "If encryption key is not in the database, how can I see it when I click the eye?"

**Great question! The key is stored SEPARATELY from the data.**

**Architecture:**

```
┌──────────────────────────────────────────────────────────────┐
│  SUPABASE INFRASTRUCTURE                                     │
│                                                              │
│  ┌─────────────────────┐        ┌──────────────────────┐   │
│  │  Your Database      │        │  Supabase Key        │   │
│  │  (Postgres)         │        │  Management Service  │   │
│  │                     │        │                      │   │
│  │  vault.secrets:     │        │  Encryption Keys:    │   │
│  │  ┌───────────────┐  │        │  ┌────────────────┐ │   │
│  │  │ Encrypted     │  │        │  │ Key for user A │ │   │
│  │  │ Blob          │  │        │  │ Key for user B │ │   │
│  │  │ key_id: "abc" │──┼────────┼─>│ Key "abc"      │ │   │
│  │  └───────────────┘  │        │  └────────────────┘ │   │
│  └─────────────────────┘        └──────────────────────┘   │
│                                                              │
│  These are in DIFFERENT systems/networks                    │
└──────────────────────────────────────────────────────────────┘
```

**When you query vault.decrypted_secrets:**

1. Postgres finds the `key_id` in the encrypted row
2. Postgres makes an internal call to Supabase's key management service
3. Key service authenticates the request (checks you have service_role permissions)
4. Key service returns the encryption key
5. Postgres uses the key to decrypt
6. You see the decrypted value

**You can see it because:**
- You're authenticated with service_role credentials (admin access)
- The key management service trusts your credentials
- It temporarily provides the key for decryption

**Attackers can't see it because:**
- Even if they steal the database files, they don't have access to Supabase's key service
- The key is not in the stolen data
- Without the key, encrypted blobs are useless

---

### Q: "Which users should see decrypted views in a product with ~50 users?"

**Answer: Only your BACKEND services, not end users.**

**Typical Architecture:**

```
┌─────────────────────────────────────────────────────────┐
│  END USERS (50 users)                                   │
│  - Should NEVER see vault secrets                       │
│  - Don't have database access                           │
│  - Don't have service_role key                          │
└────────────┬────────────────────────────────────────────┘
             │
             │ API calls (HTTPS)
             ▼
┌─────────────────────────────────────────────────────────┐
│  YOUR BACKEND API (FastAPI)                             │
│  - Has service_role credentials                         │
│  - Can query vault.decrypted_secrets                    │
│  - Retrieves tokens when needed                         │
│  - Makes API calls to Airtable on behalf of users      │
└────────────┬────────────────────────────────────────────┘
             │
             │ Uses service_role key
             ▼
┌─────────────────────────────────────────────────────────┐
│  SUPABASE DATABASE                                      │
│  - vault.decrypted_secrets (only backend can access)    │
└─────────────────────────────────────────────────────────┘
```

**Who should have access:**

| Role | Access Level | Why |
|------|-------------|-----|
| **Your Backend Service** | Full access to `vault.decrypted_secrets` | Needs to retrieve tokens to call APIs |
| **Your Developers** | View-only via Supabase dashboard | Debugging and management |
| **End Users** | NO ACCESS | They never interact with vault directly |
| **Database Admins** | Limited (if separate from devs) | Only if absolutely necessary |

**For your 50 users:**
- They authenticate with your app (e.g., JWT tokens)
- Your backend checks their permissions via RLS on other tables
- When a user needs Airtable data, your backend:
  1. Verifies user has permission (via RLS on integration_connections)
  2. Retrieves the Airtable token from vault
  3. Calls Airtable API with the token
  4. Returns data to user
- Users NEVER see or touch the actual Airtable tokens

---

### Q: "Why use Vault instead of just RLS on integration_connections?"

**Great question! They solve DIFFERENT security problems.**

#### RLS (Row Level Security)
**Purpose:** Control **who can access which rows**

```sql
-- RLS Policy Example
CREATE POLICY "users_see_own_org_connections"
ON integration_connections
FOR SELECT
USING (organization_id = auth.uid());
```

**What it protects:**
- User A can't see User B's connections ✅
- Users only see their own organization's data ✅

**What it DOESN'T protect:**
```
If someone gains access to the database:
┌──────────────────────────────────────────────────┐
│  integration_connections table (with RLS)        │
├──────────────────────────────────────────────────┤
│  org_id  | provider | refresh_token             │
├──────────────────────────────────────────────────┤
│  user-1  | airtable | sk_live_abc123...         │  ← EXPOSED!
│  user-2  | airtable | sk_live_xyz789...         │  ← EXPOSED!
└──────────────────────────────────────────────────┘

RLS doesn't matter if attacker has direct database/file access!
```

**Attack Scenarios RLS Doesn't Protect Against:**

1. **Database Backup Stolen:**
   - Attacker downloads your backup file
   - Opens it with any Postgres client
   - RLS policies don't apply to raw file access
   - All tokens are visible in plain text ❌

2. **SQL Injection (worst case):**
   - If you have a SQL injection vulnerability
   - Attacker might bypass RLS
   - Gets all tokens ❌

3. **Insider Threat:**
   - Database administrator goes rogue
   - They have superuser access
   - Can disable RLS policies
   - Sees all tokens ❌

4. **Server Compromise:**
   - Attacker gains filesystem access
   - Reads Postgres data files directly
   - RLS doesn't apply to file-level access
   - All tokens exposed ❌

---

#### Vault Encryption
**Purpose:** Protect data **even if database is compromised**

```
integration_connections:
┌────────────────────────────────────────────────────────┐
│  org_id  | refresh_token_secret_id                     │
├────────────────────────────────────────────────────────┤
│  user-1  | c9b00867-ca8b-44fc-a81d-d20b8169be17        │  ← Just a UUID
│  user-2  | 7095d222-efe5-4cd5-b5c6-5755b451e223        │  ← Just a UUID
└────────────────────────────────────────────────────────┘

vault.secrets:
┌────────────────────────────────────────────────────────┐
│  id                                   | secret          │
├────────────────────────────────────────────────────────┤
│  c9b00867-ca8b-44fc-a81d-d20b8169be17 | 3mMeOcoG84...   │  ← ENCRYPTED
│  7095d222-efe5-4cd5-b5c6-5755b451e223 | lhb3HBFxF+...   │  ← ENCRYPTED
└────────────────────────────────────────────────────────┘
```

**What it protects against:**

1. **Database Backup Stolen:**
   - Attacker gets encrypted blobs only ✅
   - No encryption key = useless data ✅

2. **Filesystem Access:**
   - Attacker reads Postgres data files
   - Sees only encrypted data ✅

3. **Insider Threat:**
   - Even database admin sees encrypted blobs
   - Can't decrypt without key (stored separately) ✅

4. **Compliance Requirements:**
   - GDPR, HIPAA, PCI-DSS require encryption at rest ✅
   - Vault provides this automatically ✅

---

### RLS + Vault = Defense in Depth

**You should use BOTH:**

```
Layer 1: RLS on integration_connections
└─> Controls: User A can't see User B's connections

Layer 2: Secret IDs instead of tokens in integration_connections  
└─> Controls: Even if RLS bypassed, attacker gets UUIDs, not tokens

Layer 3: Vault Encryption
└─> Controls: Even if attacker gets vault table, data is encrypted

Layer 4: Encryption Key Separation
└─> Controls: Key stored separately by Supabase, not in database
```

**Real-world example:**

Without Vault (RLS only):
```
Hacker steals your database backup file
↓
Opens it in any Postgres client
↓
Runs: SELECT * FROM integration_connections;
↓
Gets: "sk_live_abc123secrettoken" for all 50 users
↓
Uses tokens to access all users' Airtable accounts
↓
💀 MASSIVE DATA BREACH
```

With Vault + RLS:
```
Hacker steals your database backup file
↓
Opens it in any Postgres client
↓
Runs: SELECT * FROM integration_connections;
↓
Gets: UUID references like "c9b00867-ca8b-44fc-a81d-d20b8169be17"
↓
Runs: SELECT * FROM vault.secrets;
↓
Gets: "3mMeOcoG84a5F2uOfy2ugWYDp9sdxvCTmi6kTeT97bvA8rCEsG5D..."
↓
Can't decrypt without encryption key (stored separately)
↓
✅ NO BREACH - Data is protected
```

---

### Summary: When to Use What

| Security Concern | Solution | What It Protects |
|-----------------|----------|------------------|
| User A accessing User B's data | **RLS** | Row-level access control |
| Database backup stolen | **Vault** | Encryption at rest |
| Filesystem compromise | **Vault** | Data encrypted on disk |
| Insider threat | **Vault** | Even admins see encrypted data |
| Compliance (GDPR, etc.) | **Vault** | Required encryption standards |
| SQL injection | **RLS + Parameterized queries** | Prevents unauthorized queries |

**Best Practice:**
```python
# ✅ Correct: RLS + Vault + Secret IDs
integration_connections:
  - RLS policy: user sees only their org's connections
  - Column: refresh_token_secret_id (UUID, not token)
  
vault.secrets:
  - Encrypted storage
  - Separate encryption key
```

## Summary

| Concept | What It Is | Example |
|---------|-----------|---------|
| **Secret ID** | UUID pointer to vault entry | `c9b00867-ca8b-44fc-a81d-d20b8169be17` |
| **Actual Token** | The real OAuth token | `sk_live_abc123secrettoken` |
| **vault.secrets** | Table with encrypted data | `secret: "3mMeOcoG84a5..."` (encrypted) |
| **vault.decrypted_secrets** | View that decrypts on-the-fly | Shows: `sk_live_abc123secrettoken` |
| **integration_connections** | Stores secret IDs, not tokens | `refresh_token_secret_id: "c9b00867..."` |

**Key Insight:**
- `refresh_token_secret_id` is NOT the token
- It's the KEY to the safe deposit box that contains the token
- To get the actual token, you must call `vault.get_secret(secret_id)`

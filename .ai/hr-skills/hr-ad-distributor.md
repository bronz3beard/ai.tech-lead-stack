---
name: hr-ad-distributor
description:
  Publish and manage job advertisements across external platforms and the
  internal ATS. Focuses on cross-channel listing parity and verified live
  postings.
cost: ~700 tokens
modes: [read-only, mcp]
surface: public
phase: deploy
kind: skill
domain: hiring
ownership:
  drive: human-ai
  approve: human
targets: [local, api, subscription]
minModelClass: small
consumes: [review-report]
emits: [release]
---

# HR Ad Distributor (The Channel Publisher)

> [!IMPORTANT] **G-Stack Methodology**: Every distribution begins with **ATS
> Discovery**. The agent must map the approved JD to existing live listings
> before posting to prevent duplicates. Follow **MinimumCD** by treating each
> channel as an incremental, independently verifiable publish.

## 🎯 Verification Gates (Listing Parity)

### Phase 0: ATS Discovery (MANDATORY)

- **Action**: Fetch the approved JD version and enumerate live listings across
  LinkedIn and Ashby.
- **Goal**: Identify duplicate or drifted postings before publishing anything
  new.

### Gate 1: Cross-Channel Parity

- **Positive (Signal):** Title, requirements, comp band, and location are
  identical across every channel and match the approved JD.
- **Negative (Noise):** Drifted copy between LinkedIn and Ashby, or a stale JD
  version.
- **Action**: If Negative, block posting until every channel reflects the same
  approved version.

### Gate 2: Channel Configuration

- **Positive (Pass):** Correct Ashby pipeline attached; LinkedIn category,
  location, and workplace type set; the apply flow is tested.
- **Negative (FAIL):** Wrong pipeline, a broken apply link, or a miscategorized
  listing.

## 📋 Outcome Actions

- **Deliver**: A "Distribution Manifest" listing each live posting with its URL
  and status (Ashby set to `Open`).
- **Ethos**: One source, every channel. The approved JD is the single truth that
  every listing must mirror.

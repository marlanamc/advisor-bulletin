# Advisor Portal Test Checklist

For walking the portal end to end before showing it to faculty. Written
2026-09-11, just after the fixes in PR #18 went live.

Every item below is something that **was broken and is now fixed**, or a path
faculty will hit in their first ten minutes. The content is real and verified,
so anything you post that looks good can stay up for students.

**Sign in at** https://ebhcsjobboard.web.app/admin with your `@ebhcs.org` Google
account. **Students see** https://ebhcsjobboard.web.app/

---

## 1. Sign-in

- [ ] Sign in with Google — portal opens, your name shows as the advisor
- [ ] Hard-reload the page — you stay signed in (no re-login)
- [ ] Sign out — lands back on the login screen
- [ ] Sign in with a personal (non-`@ebhcs.org`) Google account — you should get
      *"Please sign in with your @ebhcs.org school Google account."* and **not** a
      generic failure
- [ ] Confirm the **Advisors** tab is visible to you (you're an admin) — Leah
      should see it too; a plain advisor should not

---

## 2. Events — the five date types

This is the section that matters most. Until yesterday, **three of the five
silently threw data away**: "Multiple sessions" kept only the first date,
"Repeats weekly" lost the recurrence, and "Deadline" was stored as a plain
event. No error either way.

After each post, open it on the student side and confirm the date reads right.

### 2a. Deadline → real content

> **Title:** Register for free English classes at the library
> **Category:** English Class (ESOL)
> **When:** Deadline — **October 2, 2026**
> **Description:** Boston Public Library runs Boston's only year-round, 100%
> free ESOL program. Registration for the fall/winter session closes October 2.
> Classes are for adults 18+ living in Massachusetts, at four levels from
> Beginner to Advanced. An assessment is required before you start.
> **Link:** https://www.bpl.org/ell/
> **Phone:** 617-859-2446

- [ ] Posts without error
- [ ] Shows as a **deadline** ("Apply by" / due framing), not a plain event date
- [ ] Appears on the student calendar on the right date

### 2b. Date range

> **Title:** Fall English class session at the library
> **Category:** English Class (ESOL)
> **When:** Date range — **September 14 – December 18, 2026**
> **Description:** The fall and winter ESOL session runs September through
> December at Boston Public Library branches, including East Boston. Free for
> adults 18+ in Massachusetts.
> **Link:** https://www.bpl.org/ell/

- [ ] Posts without error
- [ ] Both start **and** end date survive
- [ ] Student side shows a range, not a single date

### 2c. Repeats weekly ← *was silently losing the recurrence*

> **Title:** English conversation group
> **Category:** English Class (ESOL)
> **When:** Repeats weekly — pick a weekday, give it a start and end date
> **Description:** Free drop-in conversation groups with volunteer English
> speakers. Many in-person groups need no registration — just show up. Call to
> ask which branch and time works for you.
> **Link:** https://www.bpl.org/ell/
> **Phone:** 617-859-2446

- [ ] Posts without error
- [ ] **The weekday survives** — reopen it for editing and confirm the weekday is
      still selected. This is the exact thing that used to vanish.
- [ ] Student side describes it as weekly, not as a date range

### 2d. Multiple sessions ← *was keeping only the first date*

> **Title:** Two hiring events at MassHire Downtown Boston
> **Category:** Career Fair
> **When:** Multiple sessions — **September 15, 2026** and **September 23, 2026**
> **Description:** MassHire Downtown Boston is holding a Facilities and
> Operations job fair on September 15, and a virtual hiring event for Low
> Voltage Technicians on September 23. Free. First-time users create a profile
> on MyMassGov.
> **Link:** https://masshiredowntownboston.org/job-fairs/
> **Phone:** 617-399-3100

- [ ] Posts without error
- [ ] **Both dates survive** — reopen for editing and confirm you see two session
      rows, not one. This is the bug that would have bitten a workshop series.
- [ ] Both dates show on the student calendar
- [ ] Try adding a **third** date, save, reopen — all three still there

### 2e. Single event date

> Use the September 15 MassHire job fair on its own.

- [ ] Posts without error and shows the right single date

---

## 3. Bulletins and categories

- [ ] Post one bulletin in each of a few categories — **Job Opportunity**,
      **Training / Workshop**, **Housing**, **Food**, **Announcement**
- [ ] None of them error
- [ ] Each shows the right emoji and colour on the student feed
- [ ] Filter the student feed by category and confirm each post appears under
      the filter you'd expect
- [ ] Switch the student page to Spanish — categories are translated

A training one worth posting for real:

> **Title:** Free English classes plus help finding a job
> **Category:** Training / Workshop
> **Description:** JVS Boston's English 2 Employment program combines free
> English classes with job search support for immigrants and refugees. Classes
> run Monday to Friday, mornings and evenings. Open enrollment — they will help
> you find out if you qualify. You need English as a non-native language and
> work authorization, or a pathway to it.
> **Link:** https://www.jvs-boston.org/our-services/e2e-rapid-english/
> **Phone:** 617-399-3131
> **Location:** 75 Federal St, 3rd Floor, Boston, MA 02110

- [ ] Posts and reads well in the feed

---

## 4. Resources

### 4a. A normal resource

> **English title:** MassHire Downtown Boston Career Center
> **Category:** Jobs
> **Description:** A free state-funded career centre. Job search help,
> workshops, hiring events, and training referrals. Open to anyone looking for
> work — no cost.
> **Website:** https://masshiredowntownboston.org/
> **Phone:** 617-399-3100
> **Address:** 75 Federal St, 3rd Floor, Boston, MA 02110

- [ ] Publishes without error
- [ ] Shows under **Jobs** in Find Help with the briefcase icon (not a globe)
- [ ] Call and Directions buttons work from a phone

### 4b. A phone-only resource ← *newly possible*

Until yesterday the composer demanded a website, so an organization reachable
only by phone could not be added at all.

- [ ] Add any resource with a **phone number but no website** — it should save
- [ ] Now try one with **neither** a website nor a phone — it should be refused,
      with a message telling you to add one or the other

### 4c. The two consulates ← *were permanently un-editable*

- [ ] Find **Consulate of Honduras — Chelsea** in the portal
- [ ] Click **Verified today** — it should stamp, not fail with *"blocked by
      security rules"*. This was impossible until the rules deployed.
- [ ] Same for **Consulate General of Cape Verde — Quincy**
- [ ] Check the Honduras phone now reads **617-819-4885** — I changed it from
      617-571-7974 based on directory agreement. **Worth calling to confirm.**

---

## 5. Error messages ← *all used to say the same unhelpful thing*

Every one of these used to surface as *"Error saving resource. Please try
again."* or, worse, a security warning. Trip each deliberately.

- [ ] Post a bulletin with **no title** → should ask for a title, and must **not**
      mention security rules
- [ ] Post an event with no name → should ask for an event name
- [ ] Publish a resource with **no English title** → *"English title is required
      for resources."*
- [ ] Save an event as "Multiple sessions" with only **one** date → *"Please add
      at least two session dates."*
- [ ] Save "Repeats weekly" with no weekday → should say to choose a weekday and
      dates
- [ ] Submit with **no category** chosen → inline message, scrolls to the picker

---

## 6. Student side

- [ ] Everything you posted appears on https://ebhcsjobboard.web.app/
- [ ] Calendar shows each event on the right date
- [ ] Search finds your posts by title and by description
- [ ] Switch to Spanish — posts show Spanish titles/summaries where you set them
- [ ] Open on your phone — cards, Call, Directions and the calendar all behave
- [ ] Scroll the feed — the pinned Help row shrinks **once** and stays put (it
      used to flip between sizes as you scrolled; fixed in PR #19)

---

## 7. Clean up

- [ ] Delete any test post you don't want students to see
- [ ] Anything real and accurate — the BPL, MassHire and JVS ones — can stay
- [ ] Double-check nothing half-finished is left published

---

## If something goes wrong

Note **what you clicked, what you expected, and exactly what the message said**.
The wording matters now: after PR #18 the portal is supposed to tell you what is
actually wrong, so a vague or misleading message is itself a bug worth reporting.

## Content caveats

Details were verified live on 2026-09-11 against each organization's own site.
Programs change. The BPL October 2 registration deadline in particular is
time-sensitive, and the two MassHire hiring events pass in late September — check
before leaving those posted much past then.

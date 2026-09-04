# Loom walkthrough — 5 minutes

Screen recording with voiceover. `[SCREEN]` is what to show, `[SAY]` is what to
read out. Narration is written to be spoken, not read — short sentences, no
jargon that is not immediately explained.

## Before you hit record

Open these tabs, in this order, so you never hunt for one on camera:

1. `https://betway-slipstream-web.vercel.app`
2. `https://github.com/annnnnet/betway-slipstream` — scrolled to the **Architecture** section of the README
3. `https://betway-slipstream-production.up.railway.app/docs`
4. Firebase App Distribution → the release page
5. VS Code on `apps/api/src/betway/betway.client.ts`

Also:

- Close anything with credentials on screen (Railway/Vercel/Supabase dashboards).
- Have these codes ready to paste. Verified working today — re-check one before
  recording, they rotate weekly:
  `BW6E9AA915` (5 legs, odds 114.52) · `BW6E87AB26` (3 legs, odds 5.54)
- Zoom the browser to ~125% so text is readable in the recording.

---

## 0:00 – 0:25 · What this is

**[SCREEN]** The landing page.

**[SAY]**
> This is Slipstream. It works with Betway Nigeria booking codes.
> A booking code is a short string that stands for a bet — people share them in
> group chats, and you normally cannot see what is inside one until you load it
> on Betway.
> This does four things: decode a code, build a new one, convert an existing
> one, and verify that the codes it produces are really the bet you asked for.

---

## 0:25 – 1:15 · Decode

**[SCREEN]** Paste `BW6E9AA915`, click Decode. Let the slip render. Scroll it slowly.

**[SAY]**
> I paste a code and it resolves against Betway's live API.
> You get every leg: the selection, the market it came from, the match, the
> kickoff time, and the price in both decimal and fractional form.
> The total odds and what a thousand naira would return are at the top.
> Everything here is live — these are real prices, right now.

**[SCREEN]** Point at a greyed-out leg if one is present. If not, skip this line.

**[SAY]**
> If a leg has been settled or suspended, it is dimmed and it says which of the
> three — the selection, the market, or the match — is the one that died.

---

## 1:15 – 2:00 · Build

**[SCREEN]** Build tab → Football → Premier League → pick a fixture → tap 2–3 prices → Generate booking code.

**[SAY]**
> The builder goes the other way. Sport, league, match, and then Betway's live
> markets for that match — there are over a hundred per football game.
> I pick a few, the slip on the right totals them up, and I generate a code.

**[SCREEN]** The new code appears with the verification panel below it.

**[SAY]**
> And that is a real Betway booking code. I can open it on Betway right now.

---

## 2:00 – 3:00 · Convert and verify — the important part

**[SCREEN]** Go to the decoded slip from earlier, click **Convert to a new code**.
Wait for the verification panel. Scroll to the two fingerprints.

> **Convert one of Betway's featured codes here, not one you built yourself.**
> Converting a code you just minted returns *the same code* — you submitted that
> exact ordered set, so the deterministic encoder maps straight back to it. It is
> correct, it verifies, and the UI explains it — but on camera you would have to
> justify why nothing changed. Betway's own codes store their legs in a different
> order from the one the decode returns, so re-booking them mints a visibly new
> code with matching fingerprints, which is the point you are making.
>
> Verified today: `BW6E87AE8D`, `BW6E9A96F2` and `BW6E9A9CD8` all converted to
> new codes. Some featured codes fail to convert because their events have
> already started — try yours right before recording.

**[SAY]**
> Convert takes an existing slip and re-books the same selections as a new code.
> The part I care about most is underneath.
> I do not just tell you the code worked. After generating it, the server loads
> that code back off Betway and compares what came back against what I asked
> for — and it shows you the comparison.
> These two lines are the fingerprints: the sorted list of outcome IDs from the
> bet I submitted, and from the slip Betway returns. They match, so the bet
> survived the round trip.
> If a leg were missing, it would be listed here and this would say failed.
> Price changes are shown too, but they do not fail the check — odds move
> between the two calls as a matter of course.

**[SCREEN]** Click **Open on Betway** → their site loads the slip.

**[SAY]**
> And here it is on Betway's own site, from the code we generated.

---

## 3:00 – 3:50 · Architecture

**[SCREEN]** GitHub README → the first Mermaid diagram.

**[SAY]**
> The architecture is a Next.js web app and a Flutter app, both talking to one
> NestJS API, which is the only thing that talks to Betway.
> Postgres holds a short-lived cache and a log of every code. It is deliberately
> not critical — if the database is down, decoding and converting still work.
> Betway publishes no API documentation, so I read their production JavaScript
> bundle to find the endpoints. They turn out to be completely public — no key,
> no session, no bot protection.

**[SCREEN]** Scroll to the second Mermaid diagram (the create-and-verify sequence).

**[SAY]**
> This is the encode path. The important line is in the middle: never trust the
> success response — load the code back and diff it.
> The Flutter app talks to my API rather than to Betway, so if Betway changes
> something I fix it with a deploy instead of an app store release.

---

## 3:50 – 4:35 · The trickiest decision

**[SCREEN]** README → "Four things the live tests taught us", the determinism block.

**[SAY]**
> The trickiest thing I found was this.
> Betway's encoder is deterministic on the *ordered* list of selections. Send
> the same selections twice and you get the same code back. Send them in a
> different order and you get a different code.
> That breaks the obvious way to verify a conversion. You cannot compare code
> strings — the same bet legitimately has several valid codes, and sometimes
> converting returns the exact code you started with.
> So identity is not the code. It is the sorted set of outcome IDs — the
> fingerprint you saw earlier. Order-independent, because the order you picked
> your legs in is not part of the bet.
> That one finding shaped the whole verification design, and it came out of a
> test I wrote against production, not from reading anything.

---

## 4:35 – 5:00 · Flutter, and wrap up

**[SCREEN]** Firebase App Distribution release page. Then the API `/docs` page briefly.

**[SAY]**
> The Flutter app is a one-screen slip view, built and distributed by GitHub
> Actions to Firebase App Distribution — no Android toolchain on my machine.
> The iOS path is written up in the README; the short version is that the build
> is the easy part and Apple's signing and per-device provisioning is not.
> The API is documented with OpenAPI, there are around eighty tests including a
> live suite that checks Betway's contract has not changed, and everything is
> in the repo.
> Thanks for watching.

---

## If you run long

Cut in this order — each is the least load-bearing thing remaining:

1. The greyed-out-leg line at 1:15
2. The `/docs` shot at the end
3. The second Mermaid diagram at 3:35 — the first one carries the architecture

Do **not** cut the fingerprint explanation at 2:00 or the determinism finding at
3:50. The brief asks for architecture and the trickiest technical decision, and
those two sections are the answer to both.

"""Prompt template for turning a raw caption transcript into on-site content."""

# Fixed taxonomy for the "topics" field. Every episode is tagged against
# this same list wherever possible, instead of Claude inventing fresh
# wording per episode — that's what makes future topic-hub pages (grouping
# episodes by subject) actually cluster instead of fragmenting into
# one-off tags that never match across episodes. Add to this list over
# time rather than letting individual runs freelance new categories.
CANONICAL_TOPICS = [
    "Capital Raising & Funding",
    "M&A",
    "Investor Perspective",
    "Regulatory & Compliance",
    "Rescheduling & Federal Policy",
    "State Regulation",
    "Litigation & Legal",
    "Taxation & 280E",
    "Banking & Payments",
    "Retail & Dispensary Operations",
    "Cultivation & Extraction",
    "Supply Chain & Distribution",
    "Branding & Marketing",
    "International Markets",
    "Labor & Workforce",
    "Real Estate",
    "Data & Technology",
    "Consumer Trends",
    "Medical & Research",
    "MSOs & Multi-State Operators",
]


def get_transcript_prompt(
    guest_name: str, company: str, episode_title: str, raw_transcript: str
) -> str:
    return f"""You are producing on-site content for a cannabis business podcast episode page from a raw, unlabeled auto-generated caption transcript.

Episode: {episode_title}
Guest: {guest_name or "unknown"}
Company: {company or "unknown"}

Raw transcript (YouTube auto-generated captions — no speaker labels, no punctuation cleanup, and it may contain errors, especially around names, brands, and industry jargon):
---
{raw_transcript}
---

Produce a single JSON object and nothing else (no markdown fences, no commentary before or after) with these exact keys:

- "cleaned_transcript": the full transcript reformatted into readable paragraphs with proper punctuation. Add "Bryan Fields:" / "{guest_name or 'Guest'}:" speaker labels at each turn, inferred from conversational context (you won't have true speaker diarization — make your best reasonable inference from turn-taking and content, and don't invent content that wasn't said). Bryan Fields is the podcast host. Fix obvious transcription errors in names, brands, and industry-specific terms using the episode/guest/company context above. This must be the full conversation cleaned up, not a summary or a shortened version.
- "summary": a single tight 2-3 sentence paragraph summarizing what the episode covers and why it matters — written as a standalone answer to "what is this episode about," suitable for a meta description or a direct search/AI-answer snippet. Not a list, a paragraph.
- "takeaways": an array of 5-8 short, standalone bullet-point strings capturing the most important points made in the episode.
- "faq": an array of 5-10 objects, each with "question" and "answer" string keys, phrased as self-contained question/answer pairs that would be useful to a reader even outside the context of the full episode.
- "quotes": an array of 3-5 objects, each with "speaker" (either "Bryan Fields" or the guest's name) and "quote" string keys — short, notable pull quotes from the conversation, close to verbatim.
- "topics": an array of 2-5 topic tags covering the subjects discussed. Choose from this fixed list wherever a tag reasonably applies, so tags stay consistent across episodes for grouping purposes: {", ".join(CANONICAL_TOPICS)}. Only introduce a new tag outside this list if none of them fit even loosely, and if you do, phrase it in the same "Title Case With &" style as the list above.
- "entities": an object with "companies" and "people" keys, each an array of strings — other companies and people mentioned by name in the conversation (beyond the guest and their own company), only ones actually named in the transcript, no guessing or inferring ones that weren't said.

Output strict, valid JSON only."""

"""Prompt template for turning a raw caption transcript into on-site content."""


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

- "cleaned_transcript": the full transcript reformatted into readable paragraphs with proper punctuation. Add "Host:" / "{guest_name or 'Guest'}:" speaker labels at each turn, inferred from conversational context (you won't have true speaker diarization — make your best reasonable inference from turn-taking and content, and don't invent content that wasn't said). Fix obvious transcription errors in names, brands, and industry-specific terms using the episode/guest/company context above. This must be the full conversation cleaned up, not a summary or a shortened version.
- "takeaways": an array of 5-8 short, standalone bullet-point strings capturing the most important points made in the episode.
- "faq": an array of 5-10 objects, each with "question" and "answer" string keys, phrased as self-contained question/answer pairs that would be useful to a reader even outside the context of the full episode.
- "quotes": an array of 3-5 short, notable pull quotes from the conversation, close to verbatim.
- "topics": an array of 4-8 short topic tags (2-4 words each) covering the subjects discussed, suitable for grouping this episode with others on similar topics.

Output strict, valid JSON only."""

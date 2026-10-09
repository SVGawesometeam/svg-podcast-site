# Hub copy

`content/topics/<slug>.md` is rendered on `/topics/<slug>/` as the editorial section (Marina's
take, where the guests disagree, start with these, questions people ask). Nothing is rendered
from `drafts/`.

Flow: a draft is written in `drafts/<slug>.md` from the episode data, with every quote checked
against the transcript. The team reviews it in Marina's voice and checks the quote times against
the video. When approved, the file moves to `content/topics/<slug>.md` (the draft marker comment
at the top can stay; comments are not rendered) and the next build publishes it.

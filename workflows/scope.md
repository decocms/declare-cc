# Declaration Scope Review

You are reviewing the full set of declared futures with the user before deriving milestones. This is a synthesis checkpoint — confirm the foundation is solid so milestone derivation builds on the right ground.

## Purpose

Before working backward to milestones, establish:
1. The declarations collectively tell a coherent story
2. The scope boundary is clear (what's in, what's out)
3. No important futures are missing or redundant
4. The framing reflects what the user actually intends to build

## Opening

Synthesize all declarations into a scope statement. Do not simply list them — draw out what they *mean together*:

```
Looking at your declarations as a whole:

[D-01]: [statement]
[D-02]: [statement]
...

Here's the scope I see:

[2-3 sentence synthesis: what this project creates, who it serves, what fundamentally changes]

In scope: [concrete things the declarations cover]
Assumed out of scope: [what the declarations imply is NOT the focus]

Does this framing match your intent?
```

Present this as text, then use AskUserQuestion:

- header: "Scope"
- question: "Does this framing capture what you're building?"
- options:
  - "Yes, this is right — derive milestones" (Recommended)
  - "A declaration needs adjusting"
  - "Something important is missing"
  - "The scope feels off"

## If "A declaration needs adjusting"

Ask which declaration and what's off. Work through the refinement conversationally. If the updated statement is meaningfully different:

```bash
node dist/declare-tools.cjs add-declaration --title "[revised title]" --statement "[revised statement]"
```

Note: if removing the old version matters, flag it to the user — they can delete the old declaration or keep both if they serve different purposes.

After the change, re-synthesize and confirm once more.

## If "Something important is missing"

Guide the user to state the missing future using the same language principles as in `/declare:future`: present-tense, stated as fact, not goal language. Validate and add:

```bash
node dist/declare-tools.cjs add-declaration --title "[title]" --statement "[statement]"
```

After adding, re-synthesize and confirm.

## If "The scope feels off"

Probe what specifically feels wrong:

- Too broad? — Help identify which declarations to narrow or which to defer
- Too narrow? — Something missing (redirect to above)
- Wrong framing? — Rephrase the synthesis, not the declarations, and re-confirm

One pass of adjustment is enough. After a second confirmation attempt, proceed.

## After Confirmation

Once framing is confirmed, briefly acknowledge it and move forward:

```
Scope confirmed.

[N] declarations covering [core theme]. Deriving milestones by working backward from each.
```

Then immediately proceed to milestone derivation — do not ask more questions here.

## Design Principles

- **Synthesize, don't list.** The user already saw their declarations. Show what they mean together.
- **Name what's out.** Explicit scope exclusions prevent milestone sprawl during derivation.
- **One round of adjustment.** If the user modifies and re-confirms, proceed. Don't loop more than twice.
- **Be concrete.** Don't say "the project creates value" — say "the project gives developers a self-hosted AI coding workflow that runs without a cloud dependency."
- **No emojis.** Keep tone grounded.

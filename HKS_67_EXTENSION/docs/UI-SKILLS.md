# Supplied UI skills

Source: https://github.com/jakubkrehel/skills
Inspected snapshot: `592aedc` (cloned during this task). MIT, copyright 2026 Jakub Krehel.

All supplied skill folders were copied into `/home/user/skills/jakubkrehel/` in this Arena workspace. This is **not** a global installation into your own editor or laptop, and no arbitrary remote installer was executed. The extension does not ship or require those skills at runtime.

Applied guidance: evidence-led interface review; native controls/dialog and visible focus; keyboard menu and Escape behavior; exact outgoing-data review; non-color-only coverage/error labels; readable font floors; narrow/workspace layouts; selectable full text; reduced motion; contrast measurement rather than estimates. Reviewed interface/layout/accessibility/writing/typography/colors/UI guidance. Neo-brutalist borders and hard shadows were retained deliberately to match the requested style.

Verification: automated axe audits of setup, review and AI dialog; 320/640/780/1280 CSS viewport overflow checks; Chrome fixture tests of dropdown, previews, HTML injection, consent and key clearing. The selected-tab hover contrast failure found by axe was fixed. Long comments now have an explicit full-text disclosure instead of unreachable clipping.

Not verified: assistive-technology user testing, actual OS-level 200% browser zoom on every browser, every locale/RTL screen, all laptop hardware, desktop Excel visual rendering, live paid model responses or ChatGPT's UI/account limits. A 640px CSS viewport is a constrained-layout test, not a claim of exhaustive zoom certification.

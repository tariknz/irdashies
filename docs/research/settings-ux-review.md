# Settings UX review — 5 November 2026

## Method and research

This pass evaluates task success and interaction cost separately from the seven-category aesthetic review. Google's [HEART paper](https://research.google/pubs/measuring-the-user-experience-on-a-large-scale-user-centered-metrics-for-web-applications/) provides the goals-to-signals-to-metrics approach. Here, the goal is to configure overlays efficiently and recover safely from navigation or input mistakes. The measures are deterministic completion of ten declared tasks, necessary interactions, focus behavior and error recovery.

Interaction requirements come from W3C's [bypass blocks guidance](https://www.w3.org/WAI/WCAG22/Understanding/bypass-blocks.html), [modal dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/), [disclosure navigation example](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/examples/disclosure-navigation/), [dragging alternatives](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html), [target size minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html), and [labels or instructions](https://www.w3.org/WAI/WCAG22/Understanding/labels-or-instructions.html). These sources inform the protocol; they do not validate a custom numerical UX score.

Ten tasks were declared before the fixes. Before/after runs use the actual SettingsLayout in isolated Storybook fixtures at 808×656, Chrome with native keyboard input, mocked persistence and no installed profile. One scripted run per condition supplies the comparison. Failed navigation checks caused by checking a lazy heading before it loaded were corrected to wait for the heading before the baseline was recorded. Raw browser results and the executable audit are retained in the local review archive outside the repository.

## Quantitative results

| Task                                         | Before UX fixes | After UX fixes | Observed measure                                                                                                                             |
| -------------------------------------------- | --------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| T1: Return from Relative to General          | Pass            | Pass           | Two activations, no sidebar scrolling                                                                                                        |
| T2: Find and open Fuel through search        | Pass            | Pass           | One text entry and one link activation; one matching result                                                                                  |
| T3: Recover from no search results           | Pass            | Pass           | One clear operation; app navigation remains available                                                                                        |
| T4: Bypass repeated navigation by keyboard   | Fail            | Pass           | Before: 66 focusable controls precede the first main control. After: Tab then Enter focuses main directly; the next Tab reaches its controls |
| T5: Change Header time format                | Pass            | Pass           | One selection in a visibly labelled Format field                                                                                             |
| T6: Move Session Time up without dragging    | Fail            | Pass           | One Enter activation of Move up updates the actual order                                                                                     |
| T7: Cancel a destructive confirmation safely | Fail            | Pass           | Modal checks improve from 2/5 to 5/5                                                                                                         |
| T8: Dismiss group choices with Escape        | Fail            | Pass           | Picker closes and focus returns to its trigger                                                                                               |
| T9: Correct a duplicate driver ID            | Pass            | Pass           | Associated written error appears; correction clears invalid state in place                                                                   |
| T10: Preview overlay font independently      | Pass            | Pass           | Sample becomes Inter/700; settings font remains unchanged                                                                                    |

**Scripted task checks: 6/10 before → 10/10 after.** This is test coverage of the selected workflows, not a population task-success estimate or a 10/10 usability score.

The five modal checks are safe initial Cancel focus, backward Tab containment, forward Tab containment, Escape dismissal and focus restoration. Initial focus and Escape already worked. Both focus boundaries and returning to the reset trigger failed before the fix and pass afterwards. Background elements are also made inert while the dialog is active, with prior inert state restored on close. An additional component regression check verifies that confirming a deletion returns focus to main when the invoking control no longer exists.

The 66 preceding controls are a DOM-derived tab-order count, including offscreen scroll-list controls that remain keyboard reachable. The new shortcut adds one navigation focus stop when unused; it provides an optional direct path rather than removing navigation. No human task-time reduction is claimed.

## Changes and rationale

- Rename the ambiguous Workspace disclosure to **App settings**. The user's question about its meaning is a direct qualitative signal, not evidence of a measured improvement in discoverability.
- Provide **Skip to settings** as the first keyboard target and focus the main region after route navigation. It appears when focused and does not consume persistent desktop space.
- Add always-available 36×36px Move up/Move down controls to settings reorder rows, alongside the existing drag handle. They support pointer activation and native keyboard buttons, disable at boundaries and retain focus in the moved row. The existing reorder callback remains the persistence boundary.
- Contain confirmation focus, make background branches inert, preserve safe initial focus, and restore the invoker on cancellation. A short message is associated with the dialog.
- Give the driver group disclosure Escape dismissal, Tab-away closing, selected-state feedback and focus return. It remains a set of native buttons, without claiming unsupported combobox/listbox keyboard behavior.

These fixes change settings interactions and the generic sortable hook's optional move callbacks. They add no telemetry processing, storage schema, IPC, font downloads or new dependencies. Other sorting consumers retain their current drag behavior unless they render the new settings controls.

## Limits and next evidence

No participants, satisfaction survey, SUS score, real-user completion time, retention or first-use discoverability rate were measured. An automated task pass cannot establish those outcomes. No screen-reader compatibility certification, complete WCAG audit, live iRacing test or native free-drag verification is claimed.

A later participant study should use these same task definitions, recruit both new and existing users, record unassisted completion, errors, time and post-task ease, and counterbalance interface order. Keep those observations separate from these deterministic checks and the aesthetic ratings. Do not manufacture participant scores to fill this baseline.

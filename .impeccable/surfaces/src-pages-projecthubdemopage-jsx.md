---
version: 1
slug: "src-pages-projecthubdemopage-jsx"
primary_target: "src/pages/ProjectHubDemoPage.jsx"
related_targets: ["src/components/ProjectHub.jsx","src/components/ProjectSolutionsPlan.jsx","src/projectHub.css"]
---

## Scope and mode

- Primary surface: `/catalogo/demo/project-hub`.
- Mode: Operate.
- Preserve all existing content, actions, navigation destinations, data mapping and interaction behavior.

## Audience and job

- A NEXOR client needs to understand project status quickly, see what is moving and identify anything that requires their attention.
- The page must remain comprehensible without project-management or software-development terminology.

## Content and constraints

- Keep the NEXOR and client identities together without competing.
- Keep the current project summary, contract action, metrics, expandable solution timeline and navigation.
- Light theme remains the client default; mobile must retain the same task hierarchy.

## Chosen direction

- Briefing modular: an asymmetric executive briefing organized around “where we are”, “what is moving” and “what needs attention”.
- Memorable moment: project progress and pending attention form one compact briefing plate before the schedule evidence.
- Signature interaction: each solution expands in place inside the single three-month schedule; selecting an activity opens its exact detail without duplicating the evidence in another view.
- Mobile adaptation: the schedule becomes a vertical expandable list with explicit state labels and no horizontal timeline.

## Unresolved decisions

- Expansion to other NEXOR surfaces follows only after this route is verified.

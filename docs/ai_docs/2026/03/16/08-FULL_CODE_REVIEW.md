# Comprehensive Code Review & Implementation Directive (kaedevn-monorepo)

**Baseline Commit:** `a300068ce282c1b8d6b4d569e6fe843fa6988017`
**Date:** 2026-03-16
**Reviewer:** Gemini CLI

## 1. Executive Summary
This report identifies critical technical debts and missing integrations across the monorepo. Claude Code should use this as a roadmap for the next development phase.

---

## 2. Detailed Technical Findings

### A. Web Renderer: GPU Memory Leak
- **Issue:** `TextureCache.ts` evicts old textures but doesn't call `texture.destroy(true)`.
- **Impact:** GPU memory consumption will grow indefinitely, leading to crashes on Nintendo Switch.
- **Directive:** Modify `evictOldest()` in `packages/web/src/renderer/TextureCache.ts` to explicitly destroy the evicted texture.

### B. Battle System: Incomplete Resource Management
- **Issue:** `applyAction.ts` lacks MP consumption logic. `SkillDef.mpCost` is defined in types but ignored in the execution loop.
- **Impact:** Skills can be used infinitely regardless of the actor's MP.
- **Directive:** 
    1. Update `applyAction` to check if `actor.mp >= skill.mpCost`.
    2. Subtract `mpCost` from the actor's state upon successful skill execution.
    3. Add a log entry for "Insufficient MP" or handle it as an invalid action.

### C. Map System: Race Conditions & State Inconsistency
- **Issue 1 (Race Condition):** No lock mechanism exists to prevent multiple simultaneous event triggers. If a player triggers an event and moves to another tile before the first scenario finishes, a second scenario might start.
- **Issue 2 (Passability):** `canPass()` checks tile coordinates but doesn't account for NPCs or players in the middle of a move animation (interpolation).
- **Directive:**
    1. Implement a `isBusy` or `isScenarioRunning` check in `MapSystem.checkEventTrigger`.
    2. Ensure NPC move routes respect the `through` property and collision with the moving player.

### D. Inventory System: Gold Integration
- **Issue:** `InventorySystem.ts` only tracks item quantities. Gold is managed separately or missing in some flows.
- **Directive:** Add `gold: number` to `InventorySystem` class with `addGold`/`spendGold` methods, ensuring they sync with `SaveData.inventory.gold`.

### E. KSC Compiler: Lexer Fragility
- **Issue:** Lexer is strictly matched against whitespace. `choice { ` (with a trailing space) may fail to parse.
- **Directive:** Audit lexer regex patterns in `packages/compiler` to use `\s*` more aggressively.

---

## 3. GitHub Issue / Task List for Claude Code

### Task 1: [Critical] PixiJS Memory Lifecycle Fix
- **Target:** `packages/web/src/renderer/TextureCache.ts`
- **Goal:** Release GPU textures on eviction.

### Task 2: Implement MP Consumption in Battle
- **Target:** `packages/battle/src/core/applyAction.ts`
- **Goal:** Make skills cost MP and validate before use.

### Task 3: Map System Collision & Trigger Robustness
- **Target:** `packages/web/src/systems/MapSystem.ts`
- **Goal:** Prevent dual-triggering events and fix "moving-into-occupied-tile" bugs.

### Task 4: UI Integration for Shop & Equipment
- **Target:** `packages/web/src/renderer/WebOpHandler.ts`
- **Goal:** Implement `@shop [itemIds]` and `@equip` script commands to open the respective screens.

---

## 4. Architectural Note
Phase 7's RPG mechanics are currently "islands" of logic. The immediate priority is to bridge these islands via `WebOpHandler` and `InventorySystem` to create a cohesive game loop.

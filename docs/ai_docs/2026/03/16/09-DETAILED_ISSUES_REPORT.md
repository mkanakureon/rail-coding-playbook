# Detailed Code Review & GitHub Issue Report

**Baseline Commit:** `a300068ce282c1b8d6b4d569e6fe843fa6988017` (HEAD)
**Date:** 2026-03-16
**Status:** Comprehensive Review & Final Audit Completed

---

## 1. Compiler & Core Logic (packages/compiler, packages/interpreter)

### Issue 1: Compiler lacks source mapping and robust error recovery
- **Commit:** a300068
- **Severity:** High
- **Description:** The compiler produces an IR (`Op[]`) that lacks any connection to the original source code. This makes debugging compiled scripts extremely difficult as runtime errors cannot report the original line number. Additionally, the parser crashes on the first error, providing a poor developer experience.
- **Proposed Fix:** 
  1. Update the `Op` type in `@kaedevn/core` to include optional `line` and `column` fields.
  2. Modify `Tokenizer` to include source locations in tokens.
  3. Update `Parser` to propagate these locations to `Op` objects and implement a "panic-mode" recovery (e.g., skipping to the next newline or closing brace on error).

### Issue 2: Interpreter fragile argument parsing fails on strings with commas
- **Commit:** a300068
- **Severity:** High (Upgraded from Medium)
- **Description:** In `Interpreter.handleExpression`, function arguments are split by `split(",")`. This results in incorrect argument counts if a string literal contains a comma, leading to runtime failures (e.g., `showText("Hello, world")`).
- **Proposed Fix:** Replace the `split(",")` logic in `handleExpression` with a call to the `Evaluator`'s tokenizer or a proper CSV-aware parser that respects quoted strings.

---

## 2. Web Renderer & Concurrency (packages/web)

### Issue 3: Race conditions in WebOpHandler due to lack of concurrency locks
- **Commit:** a300068
- **Severity:** High (Upgraded from Medium)
- **Description:** `WebOpHandler.ts` does not implement an `isBusy` or `lock` mechanism for asynchronous operations like `@bg` or `@ch`. If multiple visual commands are sent in rapid succession (e.g., from a tight script loop), transitions can overlap, causing `bg_new` and `ch_new` sprites to be leaked or incorrectly removed.
- **Proposed Fix:**
  1. Add a `private isBusy = false;` flag or a `Promise` queue to `WebOpHandler`.
  2. Wrap transition methods (`bgSet`, `chSet`) in a lock/unlock pattern to ensure one completes before the next begins.

### Issue 4: [Critical] GPU Memory Leak in TextureCache
- **Commit:** a300068
- **Description:** `TextureCache.ts` evicts old textures but doesn't call `texture.destroy(true)`. In PixiJS, removing a reference is insufficient; `.destroy()` must be called to release GPU resources.
- **Proposed Fix:** Update `evictOldest()` in `TextureCache.ts` to call `entry.texture.destroy(true)`.

---

## 3. RPG & Battle System (packages/battle, packages/web/ui)

### Issue 5: Implement MP Consumption and Validation in Battle
- **Commit:** a300068
- **Severity:** Medium
- **Description:** `applyAction.ts` ignores `SkillDef.mpCost`. Actors can use expensive skills even with 0 MP.
- **Proposed Fix:**
  1. Update `applyAction` to validate `actor.mp >= skill.mpCost`.
  2. Subtract `mpCost` from the actor's state upon successful skill execution.

### Issue 6: Integrate Gold Management into InventorySystem
- **Commit:** a300068
- **Severity:** Medium
- **Description:** `InventorySystem.ts` only tracks item quantities. To support Shop and Battle Reward features properly, it should manage the player's gold balance.
- **Proposed Fix:**
  1. Add `gold: number` property to `InventorySystem`.
  2. Add `addGold(n: number)` and `spendGold(n: number)` methods.
  3. Update `toJSON` and `loadJSON` to include gold.

### Issue 7: UI Integration for Shop & Equipment Screens
- **Commit:** a300068
- **Severity:** Low
- **Description:** `ShopScreen.ts` and `EquipmentScreen.ts` are implemented as PixiJS components but are not reachable via script commands.
- **Proposed Fix:**
  1. Add `@shop [itemIds]` and `@equip` Op handlers to `WebOpHandler.ts`.
  2. Integrate with the `InventorySystem` for gold and item transactions.

---

## 4. Save Data & State Integrity

### Issue 8: Inconsistency between SaveData interface and Interpreter state
- **Commit:** a300068
- **Severity:** High (Upgraded from Medium)
- **Description:** The `SaveData` interface in `@kaedevn/core` defines a complex v2 schema, but `Interpreter.getState()` and `WebOpHandler` do not fully capture or restore Map state and RPG variables.
- **Proposed Fix:**
  1. Refactor `Interpreter.getState()` and `GameState` to conform to the `SaveData` v2 schema.
  2. Update `WebOpHandler.getViewState` to include data from `MapSystem` and `InventorySystem`.

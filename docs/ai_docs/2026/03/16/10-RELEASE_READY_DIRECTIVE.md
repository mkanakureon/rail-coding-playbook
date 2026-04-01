# Release Readiness & Final Polish Directive (kaedevn-monorepo)

**Baseline Commit:** `a300068ce282c1b8d6b4d569e6fe843fa6988017`
**Date:** 2026-03-16
**Status:** Pre-release Audit Completed

## 1. Executive Summary
The engine has reached a significant milestone with Phase 2-9 implementations. However, to ensure a stable production release, several "last-mile" technical debts must be resolved. This document serves as the final punch-list for Claude Code.

---

## 2. Critical Release Blockers (High Severity)

### A. Resource Management: GPU Memory Leak
- **File:** `packages/web/src/renderer/TextureCache.ts`
- **Issue:** Evicted textures are not destroyed, leading to inevitable crashes on memory-constrained hardware (e.g., Nintendo Switch).
- **Directive:** Ensure `entry.texture.destroy(true)` is called in `evictOldest()`.

### B. Engine Stability: Concurrency Race Conditions
- **File:** `packages/web/src/renderer/WebOpHandler.ts`
- **Issue:** No protection against rapid-fire script commands. Overlapping transitions for backgrounds (`@bg`) and characters (`@ch`) lead to sprite leaks.
- **Directive:** Implement an `isBusy` flag or a command queue to serialize visual transitions.

### C. Data Integrity: Incomplete Save State
- **File:** `packages/web/src/renderer/WebOpHandler.ts` (line 622)
- **Issue:** `getViewState` / `restoreViewState` does not yet capture/restore the full state of the Map system and RPG variables (Inventory/Gold).
- **Directive:** Bridge `MapSystem.getMapViewState()` and `InventorySystem` data into the `SaveData` v2 structure.

---

## 3. Core Logic & Developer Experience (Medium Severity)

### D. Interpreter: String Parsing Bug
- **File:** `packages/interpreter/src/Interpreter.ts` (or relevant evaluator)
- **Issue:** Argument splitting using `.split(',')` fails when string literals contain commas.
- **Directive:** Use a more robust regex or parser to split arguments while respecting quoted strings.

### E. Battle System: Resource Validation
- **File:** `packages/battle/src/core/applyAction.ts`
- **Issue:** `mpCost` is ignored. Skills are free.
- **Directive:** Implement MP sufficiency checks and consumption logic.

### F. Compiler: Error Traceability
- **Package:** `packages/compiler`
- **Issue:** Lack of line/column metadata in Ops makes runtime error debugging nearly impossible for script writers.
- **Directive:** Inject source map metadata (line numbers) into the `Op` interface.

---

## 4. Feature Integration (Low Severity)

### G. Unreferenced UI Components
- **Files:** `ShopScreen.ts`, `EquipmentScreen.ts`
- **Issue:** These screens are implemented as PixiJS components but cannot be triggered via KSC.
- **Directive:** Add `@shop` and `@equip` Op handlers to `WebOpHandler.ts` and integrate them with the `InventorySystem`.

---

## 5. Verification Checklist for Claude Code
- [ ] Run `npm run typecheck` after each fix.
- [ ] Add unit tests for the `Interpreter` string parsing fix.
- [ ] Perform a manual check of the `@bg` transition with a high-speed script to verify the `isBusy` lock.
- [ ] Verify that a saved game correctly restores the player's position on the map and their gold/inventory.

## Architectural Note
The project structure is solid, but the "glue" between the new RPG features (Phase 7-9) and the core engine (Interpreter/WebOpHandler) is currently the weakest link. Priority should be given to **System Integration** and **Memory Stability**.

# Modular Architecture Plan: Transforming TipsLadderBuilder into a Financial Platform

## 1. Vision
The goal is to evolve TipsLadderBuilder from a specialized TIPS ladder tool into a flexible **Financial Planning Platform**. By adopting a "plugin" or "module" architecture, we can support diverse financial strategies (e.g., portfolio tracking, variable withdrawals, inflation-protected ladders) while maintaining a unified user experience and shared data foundation.

## 2. Core Architecture: The Module Registry Pattern
The system will shift from a monolithic design to a registry of independent modules. Each module will implement a standard interface, allowing the core application to dynamically render UI and execute logic based on the "active" module.

### 2.1 The `FinancialModule` Interface
Every module must adhere to a common contract to ensure compatibility with the platform's navigation, persistence, and visualization layers.

```typescript
/**
 * Standard interface for a financial tool/plugin.
 */
interface FinancialModule<TState, TParams, TResult> {
  id: string;              // Unique slug (e.g., 'tips-ladder-optimizer')
  name: string;            // Display name
  description: string;     // Short summary for the module picker
  
  // State & Persistence
  store: {
    subscribe: (run: (value: TState) => void) => () => void;
    save: (state: TState) => void;
    load: () => TState;
    reset: () => void;
    publicData: Readable<any>; // Data exposed for other modules to consume
  };

  // Logic & Calculation
  engine: {
    calculate: (params: TParams) => TResult;
    project: (state: TState) => ProjectionData;
  };

  // UI Components (Svelte)
  ui: {
    Icon: ComponentType;      // Sidebar icon
    Config: ComponentType;    // The 'Design' / Input view
    Dashboard: ComponentType; // High-level status cards (Widget-sized)
    Analysis: ComponentType;  // Deep-dive / 'Track' view (Full-page)
  };
}
```

## 3. UI Architecture: The Shell & Slot Model
To support multiple modules, the UI will move from a hardcoded page structure to a **Composite View** model.

### 3.1 The Application "Shell"
The main application layout (the Shell) provides the navigation sidebar and header but remains agnostic of the content. It defines **Slots** where modules can "mount" their components:
- **Primary View Slot:** Renders the active module's main analysis or configuration page.
- **Widget Slot:** Renders small summary cards from *any* active module into a side-panel or dashboard.
- **Global Toast/Alert Slot:** Allows modules to push notifications (e.g., "Portfolio Drift Detected") even when they are not the "active" view.

### 3.2 Composite Dashboards
The platform will support a **Master Dashboard** that aggregates components from all enabled modules. This allows a user to see their TIPS ladder floor, their total stock allocation, and their "Safe to Spend" withdrawal rate in a single unified view.

### 3.3 Cross-Module Communication
Modules can interact with each other via their `publicData` stores:
- **The Portfolio Module** exposes `totalPortfolioBalance`.
- **The TIPS Module** exposes `guaranteedRealIncomeFloor`.
- **The Withdrawal Module** subscribes to both to calculate a dynamic spending rate:
  `spending = fn($portfolioBalance, $tipsFloor)`

## 4. Proposed Directory Structure
We will move from "Layer-based" organization to "Feature-based" organization.

```text
src/lib/
├── modules/
│   ├── tips-ladder/          # Current TIPS logic (refactored)
│   │   ├── engine/           # Math & Algorithms
│   │   ├── components/       # TIPS-specific UI (Summary.svelte, Detail.svelte)
│   │   └── store.ts          # TIPS-specific state
│   ├── portfolio-manager/    # NEW: Asset allocation & drift
│   └── merton-withdrawals/   # NEW: Dynamic spending rates
├── shared/                   # Common utilities
│   ├── math/                 # Yield curves, inflation adj, IRR
│   ├── date/                 # Financial year logic, maturity dates
│   └── data/                 # CSV parsing, fetch wrappers
└── core/                     # Platform "Glue"
    ├── registry.ts           # Module registration & switching
    └── layout-engine.ts      # Shared navigation & shell logic (Slots & Dashboards)
```

## 5. Module Roadmap

### Phase 1: TIPS Specialization (Current Scope)
Even with a TIPS-only focus, modularity allows for different "modes" of laddering:
- **The Optimizer:** For users building a ladder from scratch with a lump sum.
- **The Income Tracker:** For retirees focused on monthly cash flow from maturing bonds.

### Phase 2: Total Portfolio Integration
- **Asset Allocation Module:** Tracks stocks vs. bonds vs. TIPS.
- **Drift Analysis:** Alerts the user when their portfolio deviates from a target (e.g., 60/40) and suggests rebalancing trades.

### Phase 3: Advanced Retirement Spending
- **Merton-Inspired Variable Withdrawals:** Implements Robert Merton's *Integrated Life-Cycle Management*. 
- This module consumes data from the **TIPS Module** (the floor) and the **Portfolio Module** (the upside) to calculate a monthly "Safe to Spend" amount that adjusts dynamically with market performance.

## 6. Implementation Strategy

### Step 1: Shared Logic Extraction
Identify code in `rebalance-engine.ts` and `csv-parser.ts` that is universally useful (e.g., `parseCSV`, `formatCurrency`, `getDaysInYear`) and move it to `src/lib/shared/`.

### Step 2: Encapsulation
Wrap the existing TIPS state (from `ladderStore`) and the logic (from `runRebalance`) into a `TipsLadderModule` object that implements the interface.

### Step 3: Module Switching UI
Update the main layout to include a "Module Picker." When a user switches modules, the platform:
1. Swaps the active store.
2. Re-renders the navigation items.
3. Dynamically imports the required UI components.

## 8. User Orchestration & Customization
To prevent "feature bloat," users will have direct control over how modules are integrated and displayed.

### 8.1 Module Manager
A dedicated settings page allows users to toggle specific financial tools on or off. Enabling a module adds its specific icons to the sidebar and its widgets to the available pool.

### 8.2 Data Wiring (The "Connect" UI)
For modules that depend on others (e.g., Variable Withdrawals), a simple configuration interface allows users to "wire" inputs:
- **Source Selection:** "Use data from [TIPS Module A] as my inflation-protected floor."
- **Integration Logic:** "Apply [Merton Calculation] to my [Vanguard Portfolio] balance."

### 8.3 Widget-Based Dashboard Builder
Users can "stitch" their own views using a grid-based dashboard:
- **Add Widgets:** Select from a library of components (e.g., "Yield Curve," "Asset Drift," "Spending Gauge").
- **Layout Persistence:** The custom layout is saved to the user's local state, providing a personalized command center.

## 9. Benefits of This Approach
1. **Maintainability:** Bugs in the portfolio logic won't break the TIPS laddering tool.
2. **Scalability:** New financial models (like I-Bond ladders or Social Security optimization) can be added as self-contained plugins.
3. **Holistic Views:** Users can create custom dashboards that combine views from multiple modules.
4. **User Clarity:** Users can choose to use the "Simple TIPS Tracker" or the "Full Retirement Suite" without being overwhelmed by UI elements they don't need.

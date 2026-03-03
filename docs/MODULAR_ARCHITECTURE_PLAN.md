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
- **Global Toast/Alert Slot:** Allows modules to push notifications.

### 3.2 Composite Dashboards
The platform will support a **Master Dashboard** that aggregates components from all enabled modules.

### 3.3 Cross-Module Communication
Modules can interact via their `publicData` stores. For example, the Withdrawal module subscribes to the Portfolio balance and the TIPS floor to calculate a dynamic spending rate.

## 4. Proposed Directory Structure
```text
src/lib/
├── modules/
│   ├── tips-ladder/          # Current TIPS logic
│   │   ├── engine/           # Math & Algorithms
│   │   ├── components/       # TIPS-specific UI
│   │   └── store.ts          # TIPS-specific state
│   ├── portfolio-manager/    # Merton-inspired Asset Allocation
│   │   ├── engine/           # Amortization & Elm Wealth assumptions
│   │   ├── components/       # Allocation & Risk UI
│   │   └── store.ts          # Portfolio state
│   └── smart-withdrawals/    # Merton-inspired Dynamic Spending
│       ├── engine/           # Joint Life Expectancy & Merton formula
│       ├── components/       # Spending & Floor UI
│       └── store.ts          # Withdrawal state
├── shared/                   # Common utilities (Math, Date, Data)
└── core/                     # Platform "Glue" (Registry, Layout Engine)
```

## 5. Module Details

### 5.1 TIPS Ladder Module
- **Focus:** Building and tracking inflation-protected income ladders.
- **Output:** Provides the "Real Income Floor" for withdrawal strategies.

### 5.2 Total Portfolio Module (Merton-Inspired)
- **Concept:** Constant amortization of the total portfolio balance.
- **Input:** Asset Allocation (e.g., Equity/Bond ratio) serves as a **proxy for risk**.
- **Market Data:** Integrates **Elm Wealth's quarterly "market assumptions"** for expected returns on Global Equities and TIPS.
- **Logic:** Dynamically updates expected future returns based on the chosen allocation and current market assumptions.

### 5.3 Smart Withdrawal Module (Merton-Inspired)
- **Concept:** Dynamic spending rate based on Robert Merton's *Integrated Life-Cycle Management*.
- **Logic:** 
    - Calculates spending using **Joint Life Expectancy** models.
    - Includes a **Conservatism/Safety Margin** parameter (User-designated).
    - Integrates the TIPS "Floor" and Portfolio "Upside".
- **Goal:** Provide a sustainable, adjusting spending rate that reacts to market performance and remaining life expectancy.

## 6. Implementation Strategy

### Step 1: Shared Logic Extraction
Move generic utilities (CSV parsing, date math, currency formatting) to `src/lib/shared/`.

### Step 2: Encapsulation & Refactoring
1. Move existing TIPS code to `src/lib/modules/tips-ladder/`.
2. Implement the `FinancialModule` interface and `ModuleRegistry`.
3. Create the `Total Portfolio` and `Smart Withdrawal` module scaffolds.

### Step 3: Integration of Advanced Logic
1. Implement the Merton amortization and joint life expectancy engines.
2. Integrate Elm Wealth market assumption data fetching.

### Step 4: UI Shell Migration
Update the main layout to support the "Shell & Slot" model and the "Module Picker."

## 7. User Orchestration & Customization
- **Module Manager:** Toggle features on/off.
- **Data Wiring:** Connect the TIPS "Floor" to the Withdrawal "Engine".
- **Dashboard Builder:** Drag-and-drop widgets from different modules.

## 8. Benefits
- **Extensibility:** Easily add new strategies (e.g., I-Bonds).
- **Precision:** Uses real-world market assumptions and life-expectancy models.
- **Flexibility:** Allocation as a risk proxy allows for personalized retirement paths.

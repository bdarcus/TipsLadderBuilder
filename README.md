# TIPS Ladder Builder

A robust engine for building and rebalancing TIPS (Treasury Inflation-Protected Securities) ladders. It ensures your ladder produces a target real income (DARA) every year while using duration matching to cover maturity gaps.

## Features

- **Rebalance Mode**: Sell excess holdings from "bracket" years to fund newly available years.
- **Full Rebuild Mode**: Generate an "Ideal Ladder" from scratch or by filling every rung in an existing one.
- **New Investor Support**: Build a complete ladder starting with $0 in TIPS using initial cash.
- **Real-time Data**: Fetches live prices and RefCPI directly from TreasuryDirect and FiscalData.
- **Mathematical Rigor**: Uses professional fixed-income math (Yield-from-Price, Macaulay Duration).

## Installation

Ensure you have [Node.js](https://nodejs.org/) installed (v18+ recommended).

```bash
# Clone the repository
git clone https://github.com/aerokam/TipsLadderBuilder.git
cd TipsLadderBuilder

# Install dependencies (none required for CLI, but needed for tests)
npm install
```

## CLI Usage

Run the tool using `node rebalance.js`.

### 1. Interactive Build Wizard
The easiest way to start is to run the script without arguments and follow the prompts:
```bash
node rebalance.js
```

### 2. Rebalancing an Existing Ladder
Provide a CSV of your holdings (format: `CUSIP,Qty`).
```bash
# Basic rebalance with inferred DARA
node rebalance.js data/holdings.csv

# Rebalance to a specific target annual income ($10,000)
node rebalance.js data/holdings.csv --dara 10000

# Full rebuild (fill every empty rung)
node rebalance.js data/holdings.csv --dara 10000 --method Full
```

### 3. Building a New Ladder from Cash
Specify your available funds and the ladder range.
```bash
node rebalance.js --cash 50000 --dara 5000 --start-year 2026 --end-year 2035
```

### CLI Flags

| Flag | Description |
|------|-------------|
| `--dara AMOUNT` | Target Annual Real Amount (payout per year). |
| `--method Gap\|Full` | `Gap` (default) rebalances missing rungs; `Full` rebuilds everything. |
| `--cash AMOUNT` | Initial extra cash to invest. |
| `--start-year YYYY`| The first year of the ladder. |
| `--end-year YYYY` | The last year of the ladder. |

## Output

The tool generates an `output.html` file in your data folder (or current directory). This file contains:
- **Trades Table**: Exactly what to buy/sell (Qty Delta) and the estimated cost.
- **ARA Verification**: A projection of your ladder's income for every year.
- **Weight Analysis**: Verification of duration-matching bracket weights.

## Testing

Run the automated test suite to verify math and engine logic:
```bash
npm test
```

## License

MIT License. See [LICENSE](LICENSE) for details.

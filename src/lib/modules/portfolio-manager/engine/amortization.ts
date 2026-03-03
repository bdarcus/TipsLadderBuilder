/**
 * Calculates the constant real amortization amount for a given portfolio balance,
 * expected real rate of return, and time horizon.
 */
export function calculateConstantAmortization(balance: number, realRate: number, yearsRemaining: number): number {
	if (yearsRemaining <= 0) return balance;
	if (realRate === 0) return balance / yearsRemaining;

	// Annuity formula for real spending
	// PMT = (P * r) / (1 - (1 + r)^(-n))
	return (balance * realRate) / (1 - Math.pow(1 + realRate, -yearsRemaining));
}

/**
 * Projects the portfolio balance into the future based on the amortization income.
 */
export function projectPortfolio(balance: number, realRate: number, horizon: number, incomePerYear: number): number[] {
	const projection: number[] = [balance];
	let currentBalance = balance;
	for (let i = 0; i < horizon; i++) {
		currentBalance = (currentBalance - incomePerYear) * (1 + realRate);
		projection.push(Math.max(0, currentBalance));
	}
	return projection;
}

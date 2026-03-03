/**
 * Period Life Table probabilities (Approximate SSA 2020 Data)
 * Returns probability of surviving one more year given current age.
 */
function getProbSurvival(age: number, gender: 'male' | 'female'): number {
	// Simplified Gompertz-Makeham approximation
	// p(x) = exp(-exp((x-M)/b))
	const M = gender === 'female' ? 88.5 : 83.2;
	const b = gender === 'female' ? 9.5 : 9.2;
	
	const qx = Math.exp((age - M) / b) / 100; // rough mortality rate
	return Math.max(0, 1 - qx);
}

/**
 * Calculates probability of surviving N years from now.
 */
export function getProbSurvivingNYears(age: number, gender: 'male' | 'female', n: number): number {
	let cumulativeProb = 1.0;
	for (let i = 0; i < n; i++) {
		cumulativeProb *= getProbSurvival(age + i, gender);
	}
	return cumulativeProb;
}

/**
 * Calculates the Joint Probability of survival for a group.
 * P(at least one alive) = 1 - P(all dead)
 */
export function getJointSurvivalProb(people: { age: number; gender: 'male' | 'female' }[], n: number): number {
	if (people.length === 0) return 0;
	let probAllDead = 1.0;
	for (const p of people) {
		const probAlive = getProbSurvivingNYears(p.age, p.gender, n);
		probAllDead *= (1 - probAlive);
	}
	return 1 - probAllDead;
}

/**
 * Finds the age/year where the survival probability hits a target (e.g. 5% chance of being alive).
 */
export function calculateTargetHorizon(people: { age: number; gender: 'male' | 'female' }[], targetProb: number): number {
	if (people.length === 0) return 30;
	
	for (let n = 1; n < 60; n++) {
		const jointProb = getJointSurvivalProb(people, n);
		if (jointProb < targetProb) {
			return n;
		}
	}
	return 60;
}

/**
 * Conservatism margin (0.0 to 1.0) maps to a target survival probability.
 * 0.0 (aggressive) = 50% chance of survival (median LE)
 * 1.0 (conservative) = 5% chance of survival (plan for very long life)
 */
export function getTargetProbFromMargin(margin: number): number {
	const minProb = 0.50; // Median
	const maxProb = 0.05; // 95th percentile
	return minProb - (margin * (minProb - maxProb));
}

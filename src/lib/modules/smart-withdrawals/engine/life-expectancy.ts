/**
 * Simple life expectancy calculation based on age, gender, and a conservatism margin.
 * Conservatism margin (0.0 to 1.0) shifts the target age toward the "tail" of the mortality curve.
 */
export function calculateTargetAge(age: number, gender: 'male' | 'female', margin: number): number {
	const baseLE = gender === 'female' ? 86 : 82; // simplified average life expectancy at 65
	const maxAge = 110;
	return baseLE + margin * (maxAge - baseLE);
}

/**
 * Calculates the joint life expectancy for multiple people.
 * This is a simplified model taking the maximum target age of the group.
 */
export function calculateJointTargetAge(people: { age: number; gender: 'male' | 'female' }[], margin: number): number {
	if (people.length === 0) return 95;
	const targetAges = people.map(p => calculateTargetAge(p.age, p.gender, margin));
	return Math.max(...targetAges);
}

/**
 * Calculates the years of income needed based on the current age and target age.
 */
export function calculateYearsRemaining(people: { age: number; gender: 'male' | 'female' }[], margin: number): number {
	if (people.length === 0) return 30;
	const currentMaxAge = Math.max(...people.map(p => p.age));
	const targetAge = calculateJointTargetAge(people, margin);
	return Math.max(1, targetAge - currentMaxAge);
}

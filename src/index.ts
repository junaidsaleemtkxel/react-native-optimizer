// React Native Optimizer Plugin API
export type OptimizerResult = {
	bundleSize?: number;
	unusedDependencies?: string[];
	heavyDependencies?: { name: string; size: number }[];
	unoptimizedImages?: string[];
	issues?: string[];
	reportPath?: string;
};

import { getSourceFiles, findUnusedImports } from './unusedImports';

export async function optimizeProject(projectPath: string): Promise<OptimizerResult> {
	// Example: Only unused imports for now, extend as needed
	const files = getSourceFiles(projectPath);
	const unusedImports: string[] = [];
	files.forEach(f => {
		const unused = findUnusedImports(f);
		unusedImports.push(...unused);
	});
	return {
		bundleSize: undefined,
		unusedDependencies: unusedImports,
		heavyDependencies: [],
		unoptimizedImages: [],
		issues: [],
		reportPath: undefined,
	};
}

// Usage example (for docs):
// import { optimizeProject } from 'react-native-optimizer';
// const result = await optimizeProject(process.cwd());
// console.log(result);

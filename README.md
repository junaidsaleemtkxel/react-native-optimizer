# React Native Optimizer

## Overview
React Native Optimizer is a developer tool and plugin that automatically analyzes, audits, and optimizes React Native apps for performance, bundle size, and code health.

## Installation
```sh
npm install --save-dev react-native-optimizer
```

Or with yarn:
```sh
yarn add --dev react-native-optimizer
```

## Usage (Plugin API)
Import and use the optimizer in your scripts or build tools:
```ts
import { optimizeProject } from 'react-native-optimizer';

(async () => {
	const result = await optimizeProject(process.cwd());
	console.log(result);
})();
```

## Usage (CLI)
You can also use the CLI directly:
```sh
npx rnopt analyze
```

## What It Does
- Detects unused or heavy dependencies
- Finds unoptimized images and large assets
- Analyzes inefficient JS and component renders
- Audits build settings (Hermes, ProGuard, etc.)
- Flags poorly handled runtime patterns

## Example Output
```
✅ Bundle size: 11.2 MB
⚠️ Found 6 unoptimized images.
Report saved: optimizer-report.html
```

## License
MIT
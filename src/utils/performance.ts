// src/utils/performance.ts
import { logger } from './logger';

export class PerformanceMonitor {
  private startTimes = new Map<string, number>();
  private metrics = new Map<string, number[]>();

  start(label: string): void {
    this.startTimes.set(label, performance.now());
  }

  end(label: string): number {
    const startTime = this.startTimes.get(label);
    if (!startTime) {
      logger.warn(`No start time found for performance label: ${label}`);
      return 0;
    }

    const duration = performance.now() - startTime;
    this.startTimes.delete(label);

    // Store metrics for analysis
    if (!this.metrics.has(label)) {
      this.metrics.set(label, []);
    }
    this.metrics.get(label)!.push(duration);

    logger.debug(`${label}: ${duration.toFixed(2)}ms`);
    return duration;
  }

  getMetrics(label: string): { avg: number; min: number; max: number; count: number } | null {
    const times = this.metrics.get(label);
    if (!times || times.length === 0) return null;

    return {
      avg: times.reduce((a, b) => a + b, 0) / times.length,
      min: Math.min(...times),
      max: Math.max(...times),
      count: times.length
    };
  }

  reset(): void {
    this.startTimes.clear();
    this.metrics.clear();
  }

  getAllMetrics(): Record<string, ReturnType<PerformanceMonitor['getMetrics']>> {
    const result: Record<string, ReturnType<PerformanceMonitor['getMetrics']>> = {};
    for (const [label] of this.metrics) {
      result[label] = this.getMetrics(label);
    }
    return result;
  }
}

export const performanceMonitor = new PerformanceMonitor();

// Decorator for automatic performance monitoring
export function measurePerformance(label?: string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;
    const perfLabel = label || `${target.constructor.name}.${propertyName}`;

    descriptor.value = async function (...args: any[]) {
      performanceMonitor.start(perfLabel);
      try {
        const result = await method.apply(this, args);
        return result;
      } finally {
        performanceMonitor.end(perfLabel);
      }
    };
  };
}

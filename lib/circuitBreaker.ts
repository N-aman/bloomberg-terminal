/**
 * Circuit Breaker Pattern Implementation
 * Protects downstream API endpoints against cascading failures by tracking
 * consecutive errors and providing automatic cooldown recovery (CLOSED -> OPEN -> HALF_OPEN).
 */
export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  failureThreshold?: number;
  cooldownMs?: number;
}

export class CircuitBreakerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitBreakerError';
  }
}

export class CircuitBreaker {
  private failureCount = 0;
  private state: CircuitState = 'CLOSED';
  private nextAttempt = Date.now();
  private readonly failureThreshold: number;
  private readonly cooldownMs: number;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.cooldownMs = options.cooldownMs ?? 30000;
  }

  public getState(): CircuitState {
    if (this.state === 'OPEN' && Date.now() >= this.nextAttempt) {
      this.state = 'HALF_OPEN';
    }
    return this.state;
  }

  public isOpen(): boolean {
    return this.getState() === 'OPEN';
  }

  public recordSuccess(): void {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  public recordFailure(): void {
    this.failureCount++;
    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.cooldownMs;
    }
  }

  public reset(): void {
    this.failureCount = 0;
    this.state = 'CLOSED';
    this.nextAttempt = Date.now();
  }
}

const breakers = new Map<string, CircuitBreaker>();

export function getCircuitBreaker(key: string, options?: CircuitBreakerOptions): CircuitBreaker {
  // Normalize key to base domain/route
  const normalizedKey = key.split('?')[0];
  let breaker = breakers.get(normalizedKey);
  if (!breaker) {
    breaker = new CircuitBreaker(options);
    breakers.set(normalizedKey, breaker);
  }
  return breaker;
}

export function resetAllCircuitBreakers(): void {
  breakers.clear();
}


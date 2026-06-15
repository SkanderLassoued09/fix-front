import { Injectable } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { MessageService } from 'primeng/api';
import { firstValueFrom } from 'rxjs';
import { filter, take } from 'rxjs/operators';

/** One mutation in a (possibly serialized) chain. */
export interface SafeMutationStep {
    /** A `gql` DocumentNode. */
    mutation: any;
    variables?: Record<string, any>;
    /**
     * Optional guard run on the step's `data` before continuing the chain.
     * Return a string to abort with that error message (treated as failure),
     * or void/undefined to proceed.
     */
    check?: (data: any) => string | void;
}

export interface RunChainOptions {
    /** Anti double-submit key — a second run with the same key while one is in
     *  flight is ignored. Include an id for per-row concurrency if needed. */
    key: string;
    /** Mutations run STRICTLY in order; step N+1 only fires after N succeeds,
     *  and any failure aborts the rest (no partial cascade). */
    steps: SafeMutationStep[];
    successToast?: { summary: string; detail: string };
    /** Defaults to a generic French error toast. Pass `null` to suppress. */
    errorToast?: { summary: string; detail: string } | null;
    /** Mirrors the component's spinner flag (set true on start, false on end). */
    onLoading?: (loading: boolean) => void;
}

/**
 * Central safe-mutation runner. One place that guarantees, for every call site:
 *   1. error ALWAYS handled — single toast, loading reset on every path;
 *   2. anti double-submit (per `key`);
 *   3. drops Apollo's `useMutationLoading` loading frame (waits for the result);
 *   4. serialized cascades — step N+1 runs only after N succeeds; failure aborts;
 *   5. no subscription leak — `firstValueFrom` unsubscribes after the result.
 *
 * Resolves with the LAST step's `data` on success; rejects on the first failure
 * (already toasted). Callers `await` it and only run post-success UI (close
 * modal, refresh) after it resolves.
 */
@Injectable({ providedIn: 'root' })
export class MutationRunner {
    private readonly inFlight = new Set<string>();

    constructor(
        private readonly apollo: Apollo,
        private readonly toast: MessageService,
    ) {}

    /** True while a run with this key is in flight (for `[disabled]` binding). */
    isBusy(key: string): boolean {
        return this.inFlight.has(key);
    }

    async runChain(opts: RunChainOptions): Promise<any> {
        if (this.inFlight.has(opts.key)) {
            return Promise.reject(new Error('mutation-in-flight'));
        }
        this.inFlight.add(opts.key);
        opts.onLoading?.(true);
        try {
            let last: any = null;
            for (const step of opts.steps) {
                const frame: any = await firstValueFrom(
                    this.apollo
                        .mutate({
                            mutation: step.mutation,
                            variables: step.variables,
                            // surface GraphQL errors in the frame instead of throwing
                            errorPolicy: 'all',
                            useMutationLoading: true,
                        })
                        // drop the intermediate loading frame; take the result
                        .pipe(
                            filter((r: any) => !r?.loading),
                            take(1),
                        ),
                );
                if (frame?.errors?.length) {
                    throw frame.errors[0];
                }
                const reason = step.check?.(frame?.data);
                if (reason) throw new Error(reason);
                last = frame?.data;
            }
            if (opts.successToast) {
                this.toast.add({ severity: 'success', ...opts.successToast });
            }
            return last;
        } catch (err) {
            if (opts.errorToast !== null) {
                this.toast.add({
                    severity: 'error',
                    summary: opts.errorToast?.summary ?? 'Erreur',
                    detail:
                        opts.errorToast?.detail ??
                        'Opération impossible. Réessayez.',
                });
            }
            throw err;
        } finally {
            this.inFlight.delete(opts.key);
            opts.onLoading?.(false);
        }
    }

    /** Convenience for a single mutation (the common case). */
    run(
        opts: Omit<RunChainOptions, 'steps'> & {
            mutation: any;
            variables?: Record<string, any>;
        },
    ): Promise<any> {
        const { mutation, variables, ...rest } = opts;
        return this.runChain({ ...rest, steps: [{ mutation, variables }] });
    }
}

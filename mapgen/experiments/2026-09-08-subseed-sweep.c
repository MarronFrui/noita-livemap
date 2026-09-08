/* Sub-seed sweeper (2026-09-08) — probes the wang fill's runtime seed by
 * brute-forcing the TLS sub-RNG state S = trunc(sub_seed) over [0, 2^31).
 *
 * Walk replica of experiments/2026-09-07-area-seed-candidates.mjs
 * vertexGrid()'s sub-level part (asm-exact per ABOUT_MATH §7novies):
 *   TLS Random seed = sub; one Next() warm-up; then per gen vertex
 *   (row-major, i in [0,xmax), j in [0,ymax)):  color = nextU() % cc[(i-j+1)&3]
 *   nextU = trunc(state * 4.656612875e-10 * 2147483645.0)   [binary const]
 *   Next  = Schrage Lehmer step, state in [0, 2^31-1]
 * NO rep-reduce here (prefilter only): informative vertices flip ~11% by
 * rep-reduce, so the abort threshold (default 25%) must stay above that.
 * Survivors are re-judged by the authoritative JS judge.
 *
 * Build: gcc -O3 -march=native -funroll-loops -o subsweep subseed_sweep.c -lpthread
 * Run:   ./subsweep key_91.bin <dI> <dJ> <threads> [sBegin sEnd] [abortPct]
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdint.h>
#include <pthread.h>

#define XMAX 70
#define YMAX 32
#define NC0 2
#define NC1 1
#define NC2 2
#define NC3 1

static const double C1 = 4.656612875e-10; /* bits 685f1c000000003e, VA 0x11df988 */
static const double C2 = 2147483645.0;

static uint8_t expected[YMAX][XMAX]; /* 0xFF = no check */
static const int8_t cclut[4] = { NC0, NC1, NC2, NC3 };

/* Lehmer step, exact mod 2^31-1 via fold (2^31 == 1 mod M); state != 0 */
static inline uint32_t step(uint32_t x) {
    uint64_t v = 16807ULL * (uint64_t)x;
    uint32_t s = (uint32_t)((v >> 31) + (v & 2147483647ULL));
    s = (uint32_t)((s >> 31) + (s & 2147483647ULL)); /* s < 2^31+2^24 after first fold */
    if (s >= 2147483647ULL) s = (uint32_t)(s - 2147483647ULL);
    return s;
}

/* reference Schrage (must match step) */
static inline uint32_t step_ref(uint32_t x) {
    uint32_t q = x / 127773u;
    uint32_t v = 16807u * x - 2147483647u * q;
    int32_t vi = (int32_t)v;
    if (vi <= 0) vi = (int32_t)((uint32_t)vi + 2147483647u);
    return (uint32_t)vi;
}

static inline uint32_t nextU(uint32_t *st) {
    *st = step(*st);
    return (uint32_t)((double)*st * C1 * C2);
}

static int g_dI, g_dJ, g_thr;
static double g_abortPct = 0.25;
static uint64_t g_s0 = 0, g_s1 = 2147483647ULL;
static int g_nthreads = 16;

typedef struct { uint64_t scanned, survivors; } ThreadStat;
static ThreadStat stats[64];

static void *worker(void *arg) {
    long tid = (long)arg;
    uint64_t lo = g_s0, hi = g_s1;
    for (uint64_t S = lo + (uint64_t)tid; S < hi; S += (uint64_t)g_nthreads) {
        stats[tid].scanned++;
        uint32_t st = step((uint32_t)S); /* TLS warm-up */
        uint32_t mism = 0, checked = 0;
        uint32_t budget0 = 8;
        int done = 0;
        for (int j = 0; j < YMAX && !done; j++) {
            const uint8_t *erow = expected[j];
            for (int i = 0; i < XMAX; i++) {
                uint32_t u = nextU(&st);
                uint8_t e = erow[i];
                if (e != 0xFFu) {
                    uint32_t color = u % (uint32_t)cclut[(i - j + 1) & 3];
                    checked++;
                    if (color != (uint32_t)e) {
                        mism++;
                        if (mism > budget0 && (double)mism > g_abortPct * (double)checked) { done = 1; break; }
                    }
                }
            }
        }
        if (!done) {
            stats[tid].survivors++;
            printf("SURVIVOR S=%u mism=%u checked=%u rate=%.3f\n", (unsigned)S, mism, checked,
                   checked ? (double)mism / (double)checked : 0.0);
            fflush(stdout);
        }
    }
    return NULL;
}

int main(int argc, char **argv) {
    /* hash mode: print FNV-1a of the pre-reduce grid for one S (C<->JS crosscheck) */
    if (argc == 3 && strcmp(argv[1], "--hash") == 0) {
        uint32_t S = (uint32_t)strtoul(argv[2], NULL, 0);
        uint32_t st = step(S);
        uint64_t h = 1469598103934665603ULL;
        for (int j = 0; j < YMAX; j++) {
            for (int i = 0; i < XMAX; i++) {
                uint32_t u = nextU(&st);
                uint32_t color = u % (uint32_t)cclut[(i - j + 1) & 3];
                h ^= color; h *= 1099511628211ULL;
            }
        }
        printf("%016llx\n", (unsigned long long)h);
        return 0;
    }
    if (argc < 5) { fprintf(stderr, "usage: %s key.bin dI dJ threads [sBegin sEnd] [abortPct] | %s --hash S\n", argv[0], argv[0]); return 1; }
    const char *keyfile = argv[1];
    g_dI = atoi(argv[2]);
    g_dJ = atoi(argv[3]);
    g_nthreads = atoi(argv[4]);
    if (argc >= 7) { g_s0 = strtoull(argv[5], NULL, 0); g_s1 = strtoull(argv[6], NULL, 0); }
    if (argc >= 8) g_abortPct = atof(argv[7]);

    /* sanity: step == step_ref on a sample incl. edges */
    for (uint64_t t = 0; t < 200000; t++) {
        uint32_t x = (uint32_t)((t * 2654435761ULL) % 2147483646ULL) + 1u;
        if (step(x) != step_ref(x)) { fprintf(stderr, "step mismatch at %u\n", x); return 2; }
    }
    if (step(1u) != step_ref(1u) || step(2147483646u) != step_ref(2147483646u)) {
        fprintf(stderr, "step edge mismatch\n"); return 2;
    }

    FILE *f = fopen(keyfile, "rb");
    if (!f) { perror("keyfile"); return 3; }
    uint32_t hdr[4];
    if (fread(hdr, 4, 4, f) != 4 || hdr[0] != 0x5355424b) { fprintf(stderr, "bad magic\n"); return 3; }
    if (hdr[1] != XMAX || hdr[2] != YMAX) { fprintf(stderr, "dim mismatch %u %u\n", hdr[1], hdr[2]); return 3; }
    uint32_t nOff = hdr[3];
    int found = 0;
    for (uint32_t o = 0; o < nOff; o++) {
        int16_t di, dj;
        if (fread(&di, 2, 1, f) != 1 || fread(&dj, 2, 1, f) != 1) { fprintf(stderr, "eof\n"); return 3; }
        if (fread(expected, 1, XMAX * YMAX, f) != XMAX * YMAX) { fprintf(stderr, "eof\n"); return 3; }
        if (di == (int16_t)g_dI && dj == (int16_t)g_dJ) { found = 1; break; }
    }
    fclose(f);
    if (!found) { fprintf(stderr, "offset (%d,%d) not in keyfile (even parity?)\n", g_dI, g_dJ); return 4; }

    uint32_t nchk = 0;
    for (int j = 0; j < YMAX; j++) for (int i = 0; i < XMAX; i++) if (expected[j][i] != 0xFFu) nchk++;
    fprintf(stderr, "offset (%d,%d): %u checked vertices; S in [%llu,%llu) thr=%d abort=%.2f\n",
            g_dI, g_dJ, nchk, (unsigned long long)g_s0, (unsigned long long)g_s1, g_nthreads, g_abortPct);

    pthread_t th[64];
    for (long t = 0; t < g_nthreads; t++) pthread_create(&th[t], NULL, worker, (void *)t);
    for (long t = 0; t < g_nthreads; t++) pthread_join(th[t], NULL);
    uint64_t sc = 0, sv = 0;
    for (long t = 0; t < g_nthreads; t++) { sc += stats[t].scanned; sv += stats[t].survivors; }
    printf("DONE scanned=%llu survivors=%llu\n", (unsigned long long)sc, (unsigned long long)sv);
    return 0;
}

# RPC Benchmark Report

## Environment

- Node.js: v22.17.0
- Platform: win32 10.0.26200 x64

## Config

- Warmup Requests: 500
- Total Requests: 5000
- Concurrency: 50
- Rounds: 3
- Payload Sizes:
  - small: 100 bytes
  - medium: 10 KB
  - large: 100 KB

## Median Results

| case | qps | avg(ms) | p50(ms) | p95(ms) | p99(ms) | max(ms) | failed |
|---|---:|---:|---:|---:|---:|---:|---:|
| json-small | 15669.76 | 3.18 | 3.09 | 3.95 | 4.13 | 4.42 | 0 |
| protobuf-small | 13945.42 | 3.57 | 3.52 | 4.60 | 5.03 | 5.41 | 0 |
| json-medium | 7625.71 | 6.53 | 6.26 | 10.62 | 12.04 | 14.49 | 0 |
| protobuf-medium | 8245.52 | 6.04 | 5.63 | 9.87 | 11.21 | 13.82 | 0 |
| json-large | 1266.27 | 39.35 | 41.36 | 49.01 | 54.15 | 57.00 | 0 |
| protobuf-large | 1228.04 | 40.50 | 42.16 | 50.99 | 58.11 | 59.20 | 0 |
| json-small-no-compression | 16882.56 | 2.95 | 2.94 | 3.24 | 3.63 | 3.80 | 0 |
| json-small-gzip | 8324.10 | 5.99 | 5.83 | 7.62 | 9.60 | 9.71 | 0 |
| json-medium-no-compression | 9156.10 | 5.44 | 5.15 | 8.26 | 8.81 | 10.93 | 0 |
| json-medium-gzip | 4122.42 | 12.10 | 11.94 | 13.98 | 16.03 | 16.54 | 0 |
| json-large-no-compression | 1280.03 | 38.92 | 40.71 | 48.65 | 53.24 | 55.52 | 0 |
| json-large-gzip | 735.98 | 67.81 | 67.26 | 72.76 | 74.06 | 75.57 | 0 |
| connection-pool-1 | 8623.52 | 5.78 | 5.44 | 9.08 | 10.00 | 11.98 | 0 |
| connection-pool-2 | 8061.37 | 6.19 | 6.10 | 8.25 | 9.20 | 10.48 | 0 |
| connection-pool-4 | 7644.04 | 6.53 | 6.53 | 8.62 | 9.28 | 10.35 | 0 |
| discovery-healthy | 5971.65 | 0.17 | 0.16 | 0.19 | 0.21 | 0.39 | 0 |
| discovery-failover | 2658.71 | 0.38 | 0.37 | 0.42 | 0.46 | 0.67 | 0 |

## Round Details

### json-small

| round | qps | avg(ms) | p50(ms) | p95(ms) | p99(ms) | max(ms) | failed |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 12784.03 | 3.90 | 3.53 | 6.16 | 7.50 | 7.75 | 0 |
| 2 | 15669.76 | 3.18 | 3.09 | 3.95 | 4.13 | 4.42 | 0 |
| 3 | 16038.33 | 3.11 | 3.01 | 4.44 | 4.72 | 5.30 | 0 |

### protobuf-small

| round | qps | avg(ms) | p50(ms) | p95(ms) | p99(ms) | max(ms) | failed |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 13945.42 | 3.57 | 3.52 | 4.60 | 5.03 | 5.41 | 0 |
| 2 | 15443.92 | 3.23 | 3.09 | 4.27 | 5.23 | 5.40 | 0 |
| 3 | 12776.16 | 3.90 | 3.63 | 5.73 | 6.50 | 6.78 | 0 |

### json-medium

| round | qps | avg(ms) | p50(ms) | p95(ms) | p99(ms) | max(ms) | failed |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 6421.96 | 7.76 | 7.46 | 12.78 | 14.86 | 18.51 | 0 |
| 2 | 7625.71 | 6.53 | 6.26 | 10.62 | 12.04 | 14.49 | 0 |
| 3 | 7785.59 | 6.40 | 6.19 | 10.40 | 12.01 | 16.60 | 0 |

### protobuf-medium

| round | qps | avg(ms) | p50(ms) | p95(ms) | p99(ms) | max(ms) | failed |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 8245.52 | 6.04 | 5.63 | 9.87 | 11.21 | 13.82 | 0 |
| 2 | 8305.72 | 5.98 | 5.78 | 9.39 | 10.35 | 14.00 | 0 |
| 3 | 7633.82 | 6.53 | 6.27 | 10.32 | 11.97 | 14.41 | 0 |

### json-large

| round | qps | avg(ms) | p50(ms) | p95(ms) | p99(ms) | max(ms) | failed |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 1254.41 | 39.71 | 41.82 | 49.61 | 56.20 | 57.40 | 0 |
| 2 | 1271.75 | 39.19 | 41.13 | 48.93 | 52.08 | 60.49 | 0 |
| 3 | 1266.27 | 39.35 | 41.36 | 49.01 | 54.15 | 57.00 | 0 |

### protobuf-large

| round | qps | avg(ms) | p50(ms) | p95(ms) | p99(ms) | max(ms) | failed |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 1230.70 | 40.48 | 42.03 | 50.76 | 57.82 | 60.47 | 0 |
| 2 | 1201.05 | 41.49 | 42.19 | 52.81 | 59.82 | 70.02 | 0 |
| 3 | 1228.04 | 40.50 | 42.16 | 50.99 | 58.11 | 59.20 | 0 |

### json-small-no-compression

| round | qps | avg(ms) | p50(ms) | p95(ms) | p99(ms) | max(ms) | failed |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 16782.95 | 2.97 | 2.95 | 3.34 | 3.63 | 4.33 | 0 |
| 2 | 17183.71 | 2.90 | 2.86 | 3.21 | 3.38 | 3.44 | 0 |
| 3 | 16882.56 | 2.95 | 2.94 | 3.24 | 3.63 | 3.80 | 0 |

### json-small-gzip

| round | qps | avg(ms) | p50(ms) | p95(ms) | p99(ms) | max(ms) | failed |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 7708.25 | 6.47 | 6.19 | 8.74 | 12.05 | 12.75 | 0 |
| 2 | 8324.10 | 5.99 | 5.83 | 7.62 | 9.60 | 9.71 | 0 |
| 3 | 8531.05 | 5.85 | 5.67 | 7.28 | 8.33 | 9.07 | 0 |

### json-medium-no-compression

| round | qps | avg(ms) | p50(ms) | p95(ms) | p99(ms) | max(ms) | failed |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 9504.86 | 5.24 | 4.88 | 8.09 | 8.96 | 11.45 | 0 |
| 2 | 9156.10 | 5.44 | 5.15 | 8.26 | 8.81 | 10.93 | 0 |
| 3 | 8847.85 | 5.63 | 5.34 | 8.61 | 9.34 | 11.84 | 0 |

### json-medium-gzip

| round | qps | avg(ms) | p50(ms) | p95(ms) | p99(ms) | max(ms) | failed |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 4122.42 | 12.10 | 11.94 | 13.98 | 16.03 | 16.54 | 0 |
| 2 | 4154.50 | 12.01 | 11.86 | 13.29 | 13.66 | 14.93 | 0 |
| 3 | 4100.23 | 12.17 | 12.04 | 14.11 | 15.07 | 15.24 | 0 |

### json-large-no-compression

| round | qps | avg(ms) | p50(ms) | p95(ms) | p99(ms) | max(ms) | failed |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 1280.03 | 38.92 | 40.71 | 48.65 | 53.24 | 55.52 | 0 |
| 2 | 1258.73 | 39.61 | 41.67 | 49.90 | 53.74 | 55.99 | 0 |
| 3 | 1313.42 | 37.93 | 39.80 | 48.76 | 53.17 | 54.47 | 0 |

### json-large-gzip

| round | qps | avg(ms) | p50(ms) | p95(ms) | p99(ms) | max(ms) | failed |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 730.22 | 68.35 | 67.80 | 73.63 | 76.34 | 78.24 | 0 |
| 2 | 737.02 | 67.71 | 67.25 | 72.02 | 78.44 | 80.29 | 0 |
| 3 | 735.98 | 67.81 | 67.26 | 72.76 | 74.06 | 75.57 | 0 |

### connection-pool-1

| round | qps | avg(ms) | p50(ms) | p95(ms) | p99(ms) | max(ms) | failed |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 8623.52 | 5.78 | 5.44 | 9.08 | 10.00 | 11.98 | 0 |
| 2 | 8371.23 | 5.95 | 5.75 | 9.54 | 12.47 | 15.29 | 0 |
| 3 | 9266.21 | 5.37 | 5.12 | 8.40 | 9.41 | 12.63 | 0 |

### connection-pool-2

| round | qps | avg(ms) | p50(ms) | p95(ms) | p99(ms) | max(ms) | failed |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 8347.77 | 5.97 | 5.92 | 8.04 | 8.93 | 10.61 | 0 |
| 2 | 8061.37 | 6.19 | 6.10 | 8.25 | 9.20 | 10.48 | 0 |
| 3 | 8017.18 | 6.22 | 6.09 | 8.59 | 9.86 | 11.11 | 0 |

### connection-pool-4

| round | qps | avg(ms) | p50(ms) | p95(ms) | p99(ms) | max(ms) | failed |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 7183.00 | 6.94 | 6.94 | 9.21 | 9.86 | 10.89 | 0 |
| 2 | 7644.04 | 6.53 | 6.53 | 8.62 | 9.28 | 10.35 | 0 |
| 3 | 7770.02 | 6.42 | 6.43 | 8.45 | 9.00 | 9.85 | 0 |

### discovery-healthy

| round | qps | avg(ms) | p50(ms) | p95(ms) | p99(ms) | max(ms) | failed |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 5651.05 | 0.18 | 0.16 | 0.25 | 0.37 | 1.31 | 0 |
| 2 | 5982.09 | 0.17 | 0.16 | 0.18 | 0.20 | 0.44 | 0 |
| 3 | 5971.65 | 0.17 | 0.16 | 0.19 | 0.21 | 0.39 | 0 |

### discovery-failover

| round | qps | avg(ms) | p50(ms) | p95(ms) | p99(ms) | max(ms) | failed |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 2631.42 | 0.38 | 0.37 | 0.42 | 0.71 | 0.84 | 0 |
| 2 | 2665.38 | 0.37 | 0.37 | 0.41 | 0.50 | 0.67 | 0 |
| 3 | 2658.71 | 0.38 | 0.37 | 0.42 | 0.46 | 0.67 | 0 |


## Notes

- QPS is calculated from successful requests only.
- Median results are selected by median QPS across rounds.
- Latency is measured on the client side around each RPC call.
- Each benchmark case starts its own server and client to avoid cross-case state pollution.
- Round details are preserved to make benchmark variance visible.
- The current Protobuf serializer uses a typed protobuf envelope while params/result are still JSON encoded, so it is not a pure schema-level Protobuf benchmark.

## Observations

- small payload: JSON is 12.36% faster than Protobuf by median QPS. JSON p95=3.95ms, Protobuf p95=4.60ms.
- medium payload: Protobuf is 8.13% faster than JSON by median QPS. JSON p95=10.62ms, Protobuf p95=9.87ms.
- large payload: JSON is 3.11% faster than Protobuf by median QPS. JSON p95=49.01ms, Protobuf p95=50.99ms.
- small payload compression: no compression is 102.82% faster than gzip by median QPS. no-compression p95=3.24ms, gzip p95=7.62ms.
- medium payload compression: no compression is 122.11% faster than gzip by median QPS. no-compression p95=8.26ms, gzip p95=13.98ms.
- large payload compression: no compression is 73.92% faster than gzip by median QPS. no-compression p95=48.65ms, gzip p95=72.76ms.
- connection pool: best median QPS is connection-pool-1 (8623.52 QPS). pool-2 vs pool-1=-6.52%, pool-4 vs pool-1=-11.36%. p95 latency: pool-1=9.08ms, pool-2=8.25ms, pool-4=8.62ms.
- discovery failover: failover median QPS is -55.48% vs healthy discovery. healthy p95=0.19ms, failover p95=0.42ms, failover failed=0.

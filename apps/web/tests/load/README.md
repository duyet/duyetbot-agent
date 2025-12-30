# Load Testing with k6

This directory contains k6 load testing scripts for DuyetBot Web.

## Prerequisites

Install k6:
```bash
# macOS
brew install k6

# Linux
sudo apt-get install k6

# Or download from https://k6.io/
```

## Available Tests

### 1. Smoke Test (`smoke-test.js`)
Quick validation test with low load (5 VUs). Ideal for:
- Quick health checks
- Pre-deployment validation
- Development testing

Run locally:
```bash
# Against localhost
k6 run tests/load/smoke-test.js

# Against production
k6 run --env URL=https://duyetbot-web.duyet.workers.dev tests/load/smoke-test.js
```

### 2. API Load Test (`api-load-test.js`)
Higher load test for API endpoints (up to 50 VUs). Tests:
- Health endpoint
- Chat history API
- Models endpoint
- Chat creation

Run with authentication:
```bash
# Requires valid bearer token
k6 run --env URL=https://duyetbot-web.duyet.workers.dev --env TOKEN=your_token tests/load/api-load-test.js
```

Run without authentication (guest mode):
```bash
k6 run --env URL=https://duyetbot-web.duyet.workers.dev tests/load/api-load-test.js
```

## Key Metrics

### Thresholds
- **Response Time**: p(95) < 500ms (smoke), < 1000ms (API load)
- **Error Rate**: < 5%
- **Success Rate**: > 95%

### Important Metrics to Monitor
1. **http_req_duration**: Request latency
2. **http_req_failed**: Failed requests
3. **errors**: Custom error rate metric
4. **vus**: Active virtual users
5. **http_reqs**: Requests per second

## Best Practices

### Cloudflare Workers Considerations
- Start with low load to avoid triggering DDoS protection
- Use gradual ramp-up patterns
- Monitor Cloudflare Analytics alongside k6 results
- Test from multiple geographic locations for edge validation

### When to Run
- **Pre-deployment**: Smoke test against staging
- **Post-deployment**: Validate production performance
- **After changes**: Test after significant code changes
- **Periodically**: Weekly or monthly performance monitoring

### Interpreting Results
- **High error rate**: Check Cloudflare dashboards for rate limiting
- **Slow response times**: May indicate cold starts or database issues
- **Consistent failures**: Possible service degradation or deployment issues

## Output Formats

Generate HTML report:
```bash
k6 run --out json=test-results.json tests/load/smoke-test.js
```

Generate with summary:
```bash
k6 run --summary-export=summary.json tests/load/smoke-test.js
```

## Integration with CI/CD

Example GitHub Actions workflow:
```yaml
- name: Load test
  run: |
    k6 run --env URL=${{ env.PRODUCTION_URL }} tests/load/smoke-test.js
```

## References

- [k6 Documentation](https://k6.io/docs/)
- [Cloudflare Workers Testing](https://developers.cloudflare.com/workers/development-testing/)
- [Grafana Cloud k6 Best Practices](https://grafana.com/blog/performance-testing-best-practices-how-to-prepare-for-peak-demand-with-grafana-cloud-k6/)

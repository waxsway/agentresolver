# Security Policy

## Reporting a vulnerability

Please report suspected security vulnerabilities privately through GitHub Security Advisories:

https://github.com/waxsway/agentresolver/security/advisories/new

Do not include secrets, private keys, seed phrases, payment signatures, or unrelated personal data in a report.

## Scope

Security reports are welcome for the AgentResolver application and its public API/MCP/x402 surfaces. The presence of a public endpoint, `security.txt`, repository, or source code is **not** authorization to access third-party systems, private networks, accounts, wallets, or data.

Good-faith reports should avoid destructive testing, persistence, social engineering, denial-of-service, automated high-volume traffic, accessing data that is not your own, or spending/transferring funds.

## Payment and wallet boundary

AgentResolver is designed as a non-custodial service. It does not require a caller to disclose private keys or seed phrases. A caller independently controls payment authorization. Never send wallet secrets in a vulnerability report.

## Response

Reports will be reviewed on a best-effort basis. Please provide reproducible steps, affected route/version, impact, and the minimum proof necessary to demonstrate the issue.

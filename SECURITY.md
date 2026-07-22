# Security policy

## Supported versions

Security updates are provided for the latest `v1` release line.

| Version | Supported |
| --- | --- |
| `v1.x` | Yes |
| `< v1.0` | No |

## Reporting a vulnerability

Please do not disclose security vulnerabilities in a public issue.

Use [GitHub private vulnerability reporting](https://github.com/MacRimi/repo-growth/security/advisories/new) and include:

- A description of the vulnerability and its impact
- The affected version or commit
- Reproduction steps or a proof of concept
- Any suggested mitigation, if available

Reports will be acknowledged as soon as possible. Confirmed issues will be addressed privately before coordinated disclosure.

## Security model

Repo Growth deliberately has no runtime dependencies and requires only the permissions documented in its example workflow. Consumers should keep the workflow token restricted to:

```yaml
permissions:
  contents: write
```

The token is used to read repository metrics and commit generated files. It is never written to the SVG or history JSON.

# SoftEther VPN Manager Core (isolated module)

This directory contains the first portable manager-core vertical slice created for the SoftEther VPN Client Manager proposal.

It includes profile validation, opaque credential references, speed classification, serialized connection operations, explicit status transitions, and a strict CLI command parser. Tests are under `tests/vpnmanager`.

The parent repository is currently a Node.js Job Queue System rather than a SoftEther source tree. Therefore this module is intentionally isolated and does not claim to integrate with the existing Node.js application or SoftEther Cedar protocol. The next integration step requires placing these files in a real SoftEther fork and connecting the operation adapter to the existing `vpnclient`/`vpncmd` APIs.

## Test

```sh
make -C tests/vpnmanager test
```

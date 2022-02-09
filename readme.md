# Cloudflare DDNS CLI

A simple CLI tool that updates Cloudflare DNS records dynamically (DDNS) with your current IP address (IPv6 supported), compatible with Cloudflare API v4.

## Installation

```sh
npm i -g cf-ddns-cli
```

## Usage

```sh
cf-ddns --key API_KEY --zone ZONE_ID --name RECORD_NAME
```

### Proxied

```sh
cf-ddns --key API_KEY --zone ZONE_ID --name RECORD_NAME --proxied
```

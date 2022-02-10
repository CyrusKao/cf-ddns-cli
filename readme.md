# Cloudflare DDNS CLI

A simple CLI tool that updates Cloudflare DNS records dynamically (DDNS) with your current IP address (IPv6 supported), compatible with Cloudflare API v4.

> See the full instruction at [my blog post](https://nocache.org/p/setup-cloudflare-dynamic-dns-ddns-with-cli-on-windows-mac-linux).

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

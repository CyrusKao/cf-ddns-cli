#!/usr/bin/env node

import { OutgoingHttpHeaders } from 'http2';
import arg from 'arg';
import fs from 'fs';
import https from 'https';
import { ipVersion } from 'is-ip';

enum DDNS_IP_Versions {
	v4,
	v6,
}

interface DDNS_IP {
	version: DDNS_IP_Versions;
	ip: string;
}

function request(url: string, method?: string, headers?: OutgoingHttpHeaders, data?: string) {
	return new Promise<string>((resolve, reject) => {
		const req = https.request(url, {
			headers: headers,
			method: method,
		}, (res) => {
			let result = '';

			res
				.setEncoding('utf-8')
				.on('error', reject)
				.on('data', (chunk) => {
					result += chunk;
				})
				.on('end', () => {
					resolve(result);
				});
		}).on('error', reject);

		if (data) {
			req.write(data);
		}

		req.end();
	});
}

async function getIP(): Promise<DDNS_IP> {
	const lines = (await request('https://www.cloudflare.com/cdn-cgi/trace')).split('\n');

	for (let i = 0, l = lines.length; i < l; i++) {
		const line = lines[i];

		if (line.startsWith('ip=')) {
			const ip = line.slice(3);

			switch (ipVersion(ip)) {
				case 4:
					return {
						version: DDNS_IP_Versions.v4,
						ip: ip,
					};
				case 6:
					return {
						version: DDNS_IP_Versions.v6,
						ip: ip,
					};
			}
		}
	}

	throw new Error('Failed to find IP address.');
}

async function update(key: string, zone: string, name: string, proxied: boolean) {
	async function requestAPI(path: string, method: string, data?: Record<string, any>) {
		const headers: OutgoingHttpHeaders = {
			Authorization: `Bearer ${key}`,
		};

		if (data) {
			headers['Content-Type'] = 'application/json';
		}

		const result = JSON.parse(await request(`https://api.cloudflare.com/client/v4/zones/${zone}${path}`, method, headers, data && JSON.stringify(data)));

		if (!result.success) {
			throw new Error(`Failed to request ${path}, please check your API key.`);
		}

		return result;
	}

	const timestamp = Date.now();
	const info = await getIP();
	const target = {
		type: info.version === DDNS_IP_Versions.v4 ? 'A' : 'AAAA',
		name: name,
		content: info.ip,
		ttl: 1,
		proxied: proxied,
	};
	const records = await requestAPI(`/dns_records?name=${name}`, 'GET');
	const recordsCount = records.result_info.count;

	if (recordsCount) {
		if (recordsCount > 1) {
			throw new Error('Multiple records found, please remove them manually.');
		}

		const record = records.result[0];

		let outdated = false;

		for (const field in target) {
			if (record[field] !== target[field as keyof typeof target]) {
				outdated = true;
				break;
			}
		}

		if (outdated) {
			console.log('Updateing exist record...');
			await requestAPI(`/dns_records/${record.id}`, 'PUT', target);
		} else {
			console.log('Already up to date.');
		}
	} else {
		console.log('Createing new record...');
		await requestAPI('/dns_records', 'POST', target);
	}

	console.info(`\nResult:`, target);
	console.log(`\nComplete in ${Date.now() - timestamp} ms.`);
}

(async () => {
	try {
		const template = {
			help: {
				type: Boolean,
				alias: 'h',
				description: 'Show usage information.',
			},
			version: {
				type: Boolean,
				alias: 'v',
				description: 'Show version.',
			},
			key: {
				type: String,
				alias: 'k',
				description: 'Cloudflare API key.',
			},
			zone: {
				type: String,
				alias: 'z',
				description: 'Cloudflare zone identifier.',
			},
			name: {
				type: String,
				alias: 'n',
				description: 'DNS record name.',
			},
			proxied: {
				type: Boolean,
				alias: 'p',
				description: 'Whether the record is proxied by Cloudflare. (default: false)',
			},
		};
		const args = (() => {
			try {
				return arg(Object.keys(template).reduce((previous, current) => {
					const arg = template[current as keyof typeof template];

					previous['--' + current] = arg.type;
					previous['-' + arg.alias] = '--' + current;

					return previous;
				}, {} as {
					[K in keyof typeof template as `--${K}`]: typeof template[K]['type'];
				} & Record<string, any>));
			} catch (err) {
				throw new Error(`Invalid argument(s).`);
			}
		})();

		if (args['--help']) {
			const commands = Object.keys(template).map((key) => {
				const command = template[key as keyof typeof template];

				return `--${key}, -${command.alias}	<${command.type.name}>	${command.description}`;
			});

			console.log('\nUsage:\n\n  cf-ddns --key API_KEY --zone ZONE_ID --name RECORD_NAME --proxied IS_PROXIED\n  cf-ddns -k API_KEY -z ZONE_ID -n RECORD_NAME -p\n\nOptions:\n\n  ' + commands.shift() + '\n\n  ' + commands.shift() + '\n\n  ' + commands.join('\n  ') + '\n');
		} else if (args['--version']) {
			console.log(JSON.parse(fs.readFileSync('package.json', 'utf8')).version);
		} else {
			const options = {
				key: args['--key'],
				zone: args['--zone'],
				name: args['--name'],
				proxied: args['--proxied'] || false,
			};

			for (const arg in options) {
				if (options[arg as keyof typeof options] === undefined) {
					throw new Error(`Argument --${arg} is required.`);
				}
			}

			await update(options.key as string, options.zone as string, options.name as string, options.proxied);
		}
	} catch (err) {
		console.error(err instanceof Error ? err.message : err);
		process.exit(1);
	}
})();

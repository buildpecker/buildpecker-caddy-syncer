import type { BunRequest } from "bun";

const email = process.env.SSL_EMAIL!;
const syncSecret = process.env.SYNC_SECRET!;
const askUrl = process.env.ASK_URL!;

type DomainMapping = { customDomain: string; generatedDomain: string };

const domainHandler = async (req: BunRequest) => {
	if (req.headers.get("Authorization") !== `Bearer ${syncSecret}`) {
		return new Response("Unauthorized", { status: 401 });
	}
	try {
		const { domainMappings } = await req.json() as { domainMappings: DomainMapping[] };

		const globalBlock =
			`{\n` +
			`\temail ${email}\n` +
			`\ton_demand_tls {\n\t\task ${askUrl}\n\t}\n` +
			`}\n\n`;

		const importBlock =
			`import manual/*.caddy\n\n`;

		let routes = "";
		domainMappings.forEach(({ customDomain, generatedDomain }, i) => {
			routes +=
				`\t@d${i} host ${customDomain}\n` +
				`\thandle @d${i} {\n` +
				`\t\treverse_proxy https://${generatedDomain} {\n` +
				`\t\t\theader_up Host ${generatedDomain}\n` +
				`\t\t}\n` +
				`\t}\n\n`;
		});

		const siteBlock =
			`https:// {\n` +
			`\ttls {\n\t\ton_demand\n\t}\n\n` +
			routes +
			`\thandle {\n\t\tabort\n\t}\n` +
			`}\n`;

		Bun.write("Caddyfile", globalBlock + importBlock + siteBlock);

		await fetch("http://docker/containers/caddy-dns/restart", {
			method: "POST",
			unix: "/var/run/docker.sock",
		});
	} catch (err) {
		return new Response(err instanceof Error ? err.message : `${err}`, {
			status: 400
		});
	}
	return new Response(null, { status: 200 });
};

const server = Bun.serve({
	port: 3333,
	routes: { "/custom-domain": { POST: domainHandler } },
});

console.log(`Server is running on ${server.url}`);

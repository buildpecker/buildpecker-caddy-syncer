import type { BunRequest } from "bun";
import { $ } from "bun";

//env
const email = process.env.SSL_EMAIL!;
const containerName = process.env.CONTAINER_NAME!;

type DomainMapping = {
	customDomain: string;
	generatedDomain: string;
}

const domainHandler = async (req: BunRequest) => {
	try {
		const { domainMappings } = await req.json() as {
			domainMappings: DomainMapping[]
		};
		const emailRecord = `{\n email ${email} \n}\n`
		let domainString = "";
		domainMappings.forEach(({ customDomain, generatedDomain }) => {
			domainString += `${customDomain} {\n reverse_proxy https://${generatedDomain} {\n  header_up Host ${generatedDomain}\n }\n}\n\n`;
		})
		Bun.write("Caddyfile", emailRecord + "\n" + domainString);
		const proc = await $`docker restart ${containerName}`.quiet();

		if (proc.exitCode !== 0) throw new Error(proc.stderr.toString())

	} catch (err) {
		return new Response(err instanceof Error ? err.message : `${err}`, { status: 400 });
	}

	return new Response(null, { status: 200 });
}

const server = Bun.serve({
	port: 3333,
	routes: {
		"/custom-domain": {
			POST: domainHandler
		}
	}
});

console.log(`Server is running on ${server.url}`)

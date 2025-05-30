import { HeaderConfiguration } from "@/components/header-provider";
import siteConfig from "@/site.config";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/_authenticated/dashboard/_layout/")(
	{
		component: RouteComponent,
		beforeLoad: () => ({
			title: `${siteConfig.siteTitle} - Dashboard`,
		}),
		ssr: true,
	},
);

function RouteComponent() {
	return (
		<>
			<HeaderConfiguration
				headerDescription="Manage your Apps and view your usage."
				headerTitle="Dashboard"
			/>
		</>
	);
}

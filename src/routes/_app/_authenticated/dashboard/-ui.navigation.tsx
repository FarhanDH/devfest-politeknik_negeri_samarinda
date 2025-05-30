import { LogOut, Settings } from "lucide-react";

import { Button } from "@/components/retroui/Button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Logo } from "@/components/ui/logo";
import { ThemeSwitcher } from "@/components/ui/theme-switcher";
import { cn } from "@/lib/utils";
import { SignOutButton } from "@clerk/clerk-react";
import type { Doc } from "@cvx/_generated/dataModel";
import { Link, useMatchRoute, useNavigate } from "@tanstack/react-router";

export function Navigation({ user }: { user: Doc<"users"> }) {
	const matchRoute = useMatchRoute();
	const navigate = useNavigate();
	const isDashboardPath = matchRoute({ to: "/dashboard" });
	const isSettingsPath = matchRoute({ to: "/dashboard/settings" });

	if (!user) {
		return null;
	}

	return (
		<nav className="sticky top-0 z-50 flex w-full flex-col border-b border-border bg-card px-6">
			<div className="mx-auto flex w-full max-w-screen-xl items-center justify-between py-3">
				<div className="flex h-10 items-center gap-2">
					<Link to={"/"} className="flex h-10 items-center gap-1">
						<Logo />
					</Link>

					<div className="mx-auto flex w-full max-w-screen-xl items-center gap-3">
						<Link to={"/dashboard"}>
							<Button
								variant={"link"}
								className={cn(" text-sm text-foreground", {
									"text-primary underline": isDashboardPath,
								})}
							>
								Dashboard
							</Button>
						</Link>

						<Link to={"/dashboard/settings"}>
							<Button
								variant={"link"}
								className={cn(" text-sm text-foreground", {
									"text-primary underline": isSettingsPath,
								})}
							>
								Settings
							</Button>
						</Link>
					</div>
				</div>

				<div className="flex h-10 items-center gap-3">
					<DropdownMenu modal={false}>
						<DropdownMenuTrigger asChild>
							<Button
								variant="link"
								className="h-10 w-10 rounded-full p-0 hover:bg-accent/50"
							>
								{user.profileImage ? (
									<img
										className="h-10 w-10 rounded-full border-2 border-black object-cover"
										alt={user.username ?? user.email}
										src={user.profileImage}
									/>
								) : (
									<div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-black bg-primary text-sm font-medium text-foreground">
										{(user?.username || user?.email || "U")
											.charAt(0)
											.toUpperCase()}
									</div>
								)}
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent sideOffset={8} align="end">
							<DropdownMenuItem className="flex-col items-start">
								<p className="text-sm font-medium text-foreground">
									{user?.username || ""}
								</p>
								<p className="text-sm text-muted-foreground">{user?.email}</p>
							</DropdownMenuItem>

							<DropdownMenuSeparator className="mx-0 my-2 h-[1px] bg-border" />

							<DropdownMenuItem
								className="h-9 w-full cursor-pointer justify-between rounded-md px-2"
								onClick={() => navigate({ to: "/dashboard/settings" })}
							>
								<span className="text-sm text-foreground">Settings</span>
								<Settings className="h-[18px] w-[18px] stroke-[1.5px] text-muted-foreground" />
							</DropdownMenuItem>

							<DropdownMenuItem className="flex h-9 items-center justify-between rounded-md px-2">
								<span className="text-sm text-foreground">Theme</span>
								<ThemeSwitcher />
							</DropdownMenuItem>

							<DropdownMenuSeparator className="mx-0 my-2 h-[1px] bg-border" />

							<SignOutButton redirectUrl="/">
								<DropdownMenuItem className="flex h-9 items-center justify-between rounded-md px-2">
									<span className="text-sm text-foreground">Log Out</span>
									<LogOut className="h-[18px] w-[18px] stroke-[1.5px] text-muted-foreground" />
								</DropdownMenuItem>
							</SignOutButton>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>

			{/* <div className="mx-auto flex w-full max-w-screen-xl items-center gap-3">
				<div
					className={cn(
						"flex h-12 items-center border-b-2",
						isDashboardPath ? "border-primary" : "border-transparent",
					)}
				>
					<Link to={"/dashboard"}>
						<Button
							variant={"link"}
							className={cn("hover:no-underline text-foreground", {
								"text-primary": isDashboardPath,
							})}
						>
							Dashboard
						</Button>
					</Link>
				</div>
				<div
					className={cn(
						"flex h-12 items-center border-b-2",
						isSettingsPath ? "border-primary" : "border-transparent",
					)}
				>
					<Link to={"/dashboard/settings"}>
						<Button
							variant={"link"}
							className={cn("hover:no-underline text-foreground", {
								"text-primary": isSettingsPath,
							})}
						>
							Settings
						</Button>
					</Link>
				</div>
			</div> */}
		</nav>
	);
}

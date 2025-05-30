import { LogOut, Settings } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
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
	// const isBillingPath = matchRoute({ to: BillingSettingsRoute.fullPath });

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
				</div>

				<div className="flex h-10 items-center gap-3">
					<DropdownMenu modal={false}>
						<DropdownMenuTrigger asChild>
							<Button
								variant="ghost"
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
						<DropdownMenuContent
							sideOffset={8}
							className="fixed -right-4 min-w-56 border-2 border-black bg-card p-2 shadow-md"
						>
							<DropdownMenuItem className="group flex-col items-start focus:bg-accent/20">
								<p className="text-sm font-medium text-foreground group-hover:text-primary">
									{user?.username || ""}
								</p>
								<p className="text-sm text-muted-foreground">{user?.email}</p>
							</DropdownMenuItem>

							<DropdownMenuSeparator className="mx-0 my-2 h-[1px] bg-border" />

							<DropdownMenuItem
								className="group h-9 w-full cursor-pointer justify-between rounded-md px-2 hover:bg-accent/20"
								onClick={() => navigate({ to: "/dashboard/settings" })}
							>
								<span className="text-sm text-foreground group-hover:text-primary">
									Settings
								</span>
								<Settings className="h-[18px] w-[18px] stroke-[1.5px] text-muted-foreground group-hover:text-primary" />
							</DropdownMenuItem>

							<DropdownMenuItem className="group flex h-9 items-center justify-between rounded-md px-2 hover:bg-accent/20">
								<span className="text-sm text-foreground group-hover:text-primary">
									Theme
								</span>
								<ThemeSwitcher />
							</DropdownMenuItem>

							<DropdownMenuSeparator className="mx-0 my-2 h-[1px] bg-border" />

							<SignOutButton redirectUrl="/">
								<DropdownMenuItem className="group h-9 w-full cursor-pointer justify-between rounded-md px-2 hover:bg-destructive/10 hover:text-destructive">
									<span className="text-sm text-foreground group-hover:text-destructive">
										Log Out
									</span>
									<LogOut className="h-[18px] w-[18px] stroke-[1.5px] text-muted-foreground group-hover:text-destructive" />
								</DropdownMenuItem>
							</SignOutButton>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>

			<div className="mx-auto flex w-full max-w-screen-xl items-center gap-3">
				<div
					className={cn(
						"flex h-12 items-center border-b-2",
						isDashboardPath ? "border-primary" : "border-transparent",
					)}
				>
					<Link
						to={"/dashboard"}
						className={cn(
							`${buttonVariants({ variant: "ghost", size: "sm" })} text-foreground`,
						)}
					>
						Dashboard
					</Link>
				</div>
				<div
					className={cn(
						"flex h-12 items-center border-b-2",
						isSettingsPath ? "border-primary" : "border-transparent",
					)}
				>
					<Link
						to={"/dashboard/settings"}
						className={cn(
							`${buttonVariants({ variant: "ghost", size: "sm" })} text-foreground`,
						)}
					>
						Settings
					</Link>
				</div>
			</div>
		</nav>
	);
}

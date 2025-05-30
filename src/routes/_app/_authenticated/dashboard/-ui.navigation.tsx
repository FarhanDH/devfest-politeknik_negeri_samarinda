import {
	Check,
	ChevronDown,
	ChevronUp,
	LogOut,
	Settings,
	Slash,
} from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
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
					<Slash className="h-6 w-6 -rotate-12 stroke-[1.5px] text-primary/10" />
					<DropdownMenu modal={false}>
						<DropdownMenuTrigger asChild>
							<Button
								variant="ghost"
								className="gap-2 px-2 data-[state=open]:bg-primary/5"
							>
								<div className="flex items-center gap-2">
									{user.profileImage ? (
										<img
											className="h-8 w-8 rounded-full object-cover"
											alt={user.username ?? user.email}
											src={user.profileImage}
										/>
									) : (
										<span className="h-8 w-8 rounded-full bg-gradient-to-br from-lime-400 from-10% via-cyan-300 to-blue-500" />
									)}

									<p className="text-sm font-medium text-primary/80">
										{user?.username || ""}
									</p>
									{/* <span className="flex h-5 items-center rounded-full bg-primary/10 px-2 text-xs font-medium text-primary/80">
                    {(user.subscription?.planKey &&
                      user.subscription.planKey.charAt(0).toUpperCase() +
                        user.subscription.planKey.slice(1)) ||
                      "Free"}
                  </span> */}
								</div>
								<span className="flex flex-col items-center justify-center">
									<ChevronUp className="relative top-[3px] h-[14px] w-[14px] stroke-[1.5px] text-primary/60" />
									<ChevronDown className="relative bottom-[3px] h-[14px] w-[14px] stroke-[1.5px] text-primary/60" />
								</span>
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent
							sideOffset={8}
							className="min-w-56 bg-card p-2"
						>
							<DropdownMenuLabel className="flex items-center text-xs font-normal text-primary/60">
								Personal Account
							</DropdownMenuLabel>
							<DropdownMenuItem className="h-10 w-full cursor-pointer justify-between rounded-md bg-secondary px-2">
								<div className="flex items-center gap-2">
									{user.profileImage ? (
										<img
											className="h-6 w-6 rounded-full object-cover"
											alt={user.username ?? user.email}
											src={user.profileImage}
										/>
									) : (
										<span className="h-6 w-6 rounded-full bg-gradient-to-br from-lime-400 from-10% via-cyan-300 to-blue-500" />
									)}

									<p className="text-sm font-medium text-primary/80">
										{user.username || ""}
									</p>
								</div>
								<Check className="h-[18px] w-[18px] stroke-[1.5px] text-primary/60" />
							</DropdownMenuItem>

							{/* {user.subscription?.planKey === PLANS.FREE && (
                <>
                  <DropdownMenuSeparator className="mx-0 my-2" />
                  <DropdownMenuItem className="p-0 focus:bg-transparent">
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={() =>
                        navigate({ to: BillingSettingsRoute.fullPath })
                      }
                    >
                      Upgrade to PRO
                    </Button>
                  </DropdownMenuItem>
                </>
              )} */}
						</DropdownMenuContent>
					</DropdownMenu>
				</div>

				<div className="flex h-10 items-center gap-3">
					<DropdownMenu modal={false}>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" className="h-8 w-8 rounded-full">
								{user.profileImage ? (
									<img
										className="min-h-8 min-w-8 rounded-full object-cover"
										alt={user.username ?? user.email}
										src={user.profileImage}
									/>
								) : (
									<span className="min-h-8 min-w-8 rounded-full bg-gradient-to-br from-lime-400 from-10% via-cyan-300 to-blue-500" />
								)}
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent
							sideOffset={8}
							className="fixed -right-4 min-w-56 bg-card p-2"
						>
							<DropdownMenuItem className="group flex-col items-start focus:bg-transparent">
								<p className="text-sm font-medium text-primary/80 group-hover:text-primary group-focus:text-primary">
									{user?.username || ""}
								</p>
								<p className="text-sm text-primary/60">{user?.email}</p>
							</DropdownMenuItem>

							<DropdownMenuItem
								className="group h-9 w-full cursor-pointer justify-between rounded-md px-2"
								onClick={() => navigate({ to: "/dashboard/settings" })}
							>
								<span className="text-sm text-primary/60 group-hover:text-primary group-focus:text-primary">
									Settings
								</span>
								<Settings className="h-[18px] w-[18px] stroke-[1.5px] text-primary/60 group-hover:text-primary group-focus:text-primary" />
							</DropdownMenuItem>

							<DropdownMenuItem
								className={cn(
									"group flex h-9 justify-between rounded-md px-2 hover:bg-transparent",
								)}
							>
								<span className="w-full text-sm text-primary/60 group-hover:text-primary group-focus:text-primary">
									Theme
								</span>
								<ThemeSwitcher />
							</DropdownMenuItem>

							{/* <DropdownMenuItem
                className={cn(
                  "group flex h-9 justify-between rounded-md px-2 hover:bg-transparent",
                )}
              >
                <span className="w-full text-sm text-primary/60 group-hover:text-primary group-focus:text-primary">
                  Language
                </span>
                <LanguageSwitcher />
              </DropdownMenuItem> */}

							<DropdownMenuSeparator className="mx-0 my-2" />

							<SignOutButton redirectUrl="/">
								<DropdownMenuItem className="group h-9 w-full cursor-pointer justify-between rounded-md px-2">
									<span className="text-sm text-primary/60 group-hover:text-primary group-focus:text-primary">
										Log Out
									</span>
									<LogOut className="h-[18px] w-[18px] stroke-[1.5px] text-primary/60 group-hover:text-primary group-focus:text-primary" />
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
							`${buttonVariants({ variant: "ghost", size: "sm" })} text-primary/80`,
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
							`${buttonVariants({ variant: "ghost", size: "sm" })} text-primary/80`,
						)}
					>
						Settings
					</Link>
				</div>
				{/* <div
					className={cn(
						"flex h-12 items-center border-b-2",
						isBillingPath ? "border-primary" : "border-transparent",
					)}
				>
					<Link
						to={BillingSettingsRoute.fullPath}
						className={cn(
							`${buttonVariants({ variant: "ghost", size: "sm" })} text-primary/80`,
						)}
					>
						Billing
					</Link>
				</div> */}
			</div>
		</nav>
	);
}

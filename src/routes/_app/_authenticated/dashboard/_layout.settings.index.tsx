import { HeaderConfiguration } from "@/components/header-provider";
import { Button } from "@/components/retroui/Button";
import { Input } from "@/components/retroui/Input";
import { useDoubleCheck } from "@/components/ui/use-double-check";
import { useAuth, useUser } from "@clerk/clerk-react";
import { convexQuery, useConvexMutation } from "@convex-dev/react-query";
import { api } from "@cvx/_generated/api";
import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Upload } from "lucide-react";
import { useRef } from "react";
import { z } from "zod";

export const Route = createFileRoute(
	"/_app/_authenticated/dashboard/_layout/settings/",
)({
	component: DashboardSettings,
	beforeLoad: () => ({
		title: "Settings",
	}),
	ssr: true,
});

const usernameSchema = z
	.string()
	.min(3, "Username must be at least 3 characters long")
	.max(20, "Username must be at most 20 characters long")
	.regex(
		/^[a-zA-Z0-9_]+$/,
		"Username can only contain letters, numbers, and underscores",
	);

export default function DashboardSettings() {
	const { data: user } = useQuery(convexQuery(api.users.getCurrentUser, {}));
	const { user: clerkUser } = useUser();
	const { signOut } = useAuth();

	const { mutateAsync: updateUsername } = useMutation({
		mutationFn: useConvexMutation(api.users.updateUsername),
	});
	const { mutateAsync: updateUserImage } = useMutation({
		mutationFn: useConvexMutation(api.users.updateUserImage),
	});
	const { mutateAsync: removeUserImage } = useMutation({
		mutationFn: useConvexMutation(api.users.removeUserImage),
	});
	const { mutateAsync: deleteCurrentUserAccount } = useMutation({
		mutationFn: useConvexMutation(api.app.deleteCurrentUserAccount),
	});

	const fileInputRef = useRef<HTMLInputElement>(null);

	const { doubleCheck, getButtonProps } = useDoubleCheck();

	const startUpload = async (files: File[]) => {
		if (!clerkUser) return;
		const { publicUrl, reload } = await clerkUser.setProfileImage({
			file: files[0],
		});

		if (!publicUrl) {
			throw new Error("Failed to upload image");
		}

		if (fileInputRef.current) {
			fileInputRef.current.value = "";
		}

		await updateUserImage({
			imageUrl: publicUrl,
		});

		reload();
	};

	const usernameForm = useForm({
		defaultValues: {
			username: user?.username,
		},
		onSubmit: async ({ value }) => {
			await updateUsername({ username: value.username || "" });
		},
	});

	const handleDeleteAccount = async () => {
		await Promise.all([removeUserImage({}), deleteCurrentUserAccount({})]);
		await signOut({
			redirectUrl: "/",
		});
	};

	if (!user) {
		return null;
	}

	return (
		<>
			<HeaderConfiguration
				headerTitle="Settings"
				headerDescription="Manage your account settings."
			/>
			<div className="flex h-full w-full flex-col gap-6">
				{/* Avatar */}
				<div className="flex w-full flex-col items-start border-2 border-border bg-card shadow-md">
					<div className="flex w-full items-start justify-between p-6">
						<div className="flex flex-col gap-2">
							<h2 className="text-xl font-bold text-foreground">Your Avatar</h2>
							<p className="text-sm font-normal text-muted-foreground">
								This is your avatar. It will be displayed on your profile.
							</p>
						</div>
						<label
							htmlFor="avatar_field"
							className="group relative flex cursor-pointer overflow-hidden border-2 border-border shadow-sm transition active:scale-95"
						>
							{user.profileImage ? (
								<img
									src={user.profileImage}
									className="h-20 w-20 object-cover"
									alt={user.username ?? user.email}
								/>
							) : (
								<div className="h-20 w-20 bg-gradient-to-br from-primary via-accent to-secondary" />
							)}
							<div className="absolute z-10 hidden h-full w-full items-center justify-center bg-primary/80 group-hover:flex">
								<Upload className="h-6 w-6 text-primary-foreground" />
							</div>
						</label>
						<input
							ref={fileInputRef}
							id="avatar_field"
							type="file"
							accept="image/*"
							className="peer sr-only"
							required
							tabIndex={user ? -1 : 0}
							onChange={async (event) => {
								if (!event.target.files) {
									return;
								}
								const files = Array.from(event.target.files);
								if (files.length === 0) {
									return;
								}
								startUpload(files);
							}}
						/>
					</div>
					<div className="flex min-h-14 w-full items-center justify-between border-t-2 border-border bg-secondary px-6">
						<p className="text-sm font-normal text-secondary-foreground">
							Click on the avatar to upload a custom one from your files.
						</p>
						{user.profileImage && (
							<Button
								type="button"
								size="sm"
								variant="secondary"
								onClick={() => {
									removeUserImage({});
								}}
							>
								Reset
							</Button>
						)}
					</div>
				</div>

				{/* Username */}
				<form
					className="flex w-full flex-col items-start border-2 border-border bg-card shadow-md"
					onSubmit={(e) => {
						e.preventDefault();
						e.stopPropagation();
						usernameForm.handleSubmit();
					}}
				>
					<div className="flex w-full flex-col gap-4 p-6">
						<div className="flex flex-col gap-2">
							<h2 className="text-xl font-bold text-foreground">
								Your Username
							</h2>
							<p className="text-sm font-normal text-muted-foreground">
								This is your username. It will be displayed on your profile.
							</p>
						</div>
						<usernameForm.Field
							name="username"
							validators={{
								onSubmit: usernameSchema,
							}}
							children={(field) => (
								<Input
									placeholder="Username"
									autoComplete="off"
									required
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									className={`w-fit text-foreground bg-transparent ${
										field.state.meta?.errors.length > 0 &&
										"border-destructive focus-visible:ring-destructive"
									}`}
								/>
							)}
						/>
						{usernameForm.state.fieldMeta.username?.errors.length > 0 && (
							<p className="text-sm text-destructive">
								{usernameForm.state.fieldMeta.username?.errors.join(" ")}
							</p>
						)}
					</div>
					<div className="flex min-h-14 w-full items-center justify-between border-t-2 border-border bg-secondary px-6">
						<p className="text-sm font-normal text-secondary-foreground">
							Please use 32 characters at maximum.
						</p>
						<Button type="submit" size="sm">
							Save
						</Button>
					</div>
				</form>

				{/* Delete Account */}
				<div className="flex w-full flex-col items-start border-2 border-destructive bg-card shadow-md">
					<div className="flex flex-col gap-2 p-6">
						<h2 className="text-xl font-bold text-foreground">
							Delete Account
						</h2>
						<p className="text-sm font-normal text-muted-foreground">
							Permanently delete your account.
						</p>
					</div>
					<div className="flex min-h-14 w-full items-center justify-between border-t-2 border-destructive bg-destructive/10 px-6">
						<p className="text-sm font-normal text-muted-foreground">
							This action cannot be undone, proceed with caution.
						</p>
						<Button
							size="sm"
							className="bg-destructive text-white hover:bg-destructive/90"
							{...getButtonProps({
								onClick: doubleCheck ? handleDeleteAccount : undefined,
							})}
						>
							{doubleCheck ? "Are you sure?" : "Delete Account"}
						</Button>
					</div>
				</div>
			</div>
		</>
	);
}
